import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Pencil, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import BlockNoteEditor from "./BlockNoteEditor";
import { getAnchoredPopoverPlacement, getSidePopoverPlacement } from "../../utils/popoverPosition";
import { blocksToPlainText, normalizeNoteBlocks } from "../../utils/noteBlocks";

const DAY_LABELS = ["\u65e5", "\u6708", "\u706b", "\u6c34", "\u6728", "\u91d1", "\u571f"];
const TIME_HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const TIME_MINUTES = ["00", "15", "30", "45"];

function Field({ label, children, align = "center" }) {
  const alignClass = align === "start" ? "items-start" : "items-center";
  return (
    <div className={`grid gap-3 rounded-lg px-2 py-2 md:grid-cols-[78px_1fr] ${alignClass}`}>
      <label className="pt-1 text-[12px] font-bold uppercase tracking-[0.14em] text-[#9AA4B2]">{label}</label>
      {children}
    </div>
  );
}

const parseDateValue = (value) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatDateValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (value) => {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${year}/${month}/${day}`;
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const isSameDay = (left, right) =>
  left &&
  right &&
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export default function HandDrawnPopup({
  task,
  availableTags = [],
  statusOptions = [],
  onCreateTag,
  onDeleteTag,
  onRenameTag,
  onClose,
  onUpdate,
  onDelete,
  autoFocusTitle = false
}) {
  const tagMenuRef = useRef(null);
  const tagTriggerRef = useRef(null);
  const statusMenuRef = useRef(null);
  const statusTriggerRef = useRef(null);
  const popupPanelRef = useRef(null);
  const newTagInputRef = useRef(null);
  const titleInputRef = useRef(null);
  const focusedTitleTaskIdRef = useRef(null);
  const deadlineButtonRef = useRef(null);
  const deadlinePickerRef = useRef(null);
  const timeButtonRef = useRef(null);
  const timePickerRef = useRef(null);
  const [tagMenuPosition, setTagMenuPosition] = useState(null);
  const [statusMenuPosition, setStatusMenuPosition] = useState(null);
  const [deadlinePickerPosition, setDeadlinePickerPosition] = useState(null);
  const [timePickerPosition, setTimePickerPosition] = useState(null);
  const [formData, setFormData] = useState({
    title: task.title || "",
    selectedTags: task.tags || [],
    deadline: task.deadline || "",
    scheduledTime: task.scheduledTime || "",
    description: task.description || "",
    noteBlocks: normalizeNoteBlocks(task.noteBlocks, task.description || "")
  });
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [editingNewTag, setEditingNewTag] = useState(false);
  const [newTagDraft, setNewTagDraft] = useState("");
  const [editingTagName, setEditingTagName] = useState("");
  const [editingTagDraft, setEditingTagDraft] = useState("");
  const [isDeadlinePickerOpen, setIsDeadlinePickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [deadlinePickerMonth, setDeadlinePickerMonth] = useState(() => startOfMonth(parseDateValue(task.deadline) || new Date()));

  const selectedTagSet = useMemo(() => new Set(formData.selectedTags), [formData.selectedTags]);
  const selectedDate = useMemo(() => parseDateValue(formData.deadline), [formData.deadline]);
  const formattedDeadline = useMemo(() => formatDateLabel(formData.deadline), [formData.deadline]);
  const selectedStatusId = task.completed ? "completed" : task.statusId || "not-started";
  const selectedStatus = statusOptions.find((status) => status.id === selectedStatusId) || statusOptions[0];
  const [selectedHour = "--", selectedMinute = "--"] = formData.scheduledTime ? formData.scheduledTime.split(":") : [];

  const calculateTagMenuPosition = useCallback(() => {
    if (!tagTriggerRef.current) return null;
    return getSidePopoverPlacement(tagTriggerRef.current, popupPanelRef.current, { width: 400, height: 300 });
  }, []);

  const calculateStatusMenuPosition = useCallback(() => {
    if (!statusTriggerRef.current) return null;
    return getSidePopoverPlacement(statusTriggerRef.current, popupPanelRef.current, { width: 260, height: Math.min(260, statusOptions.length * 44 + 16) });
  }, [statusOptions.length]);

  const deadlineCalendarDays = useMemo(() => {
    const monthStart = startOfMonth(deadlinePickerMonth);
    const startWeekday = monthStart.getDay();
    const gridStart = new Date(monthStart);
    gridStart.setDate(gridStart.getDate() - startWeekday);

    return Array.from({ length: 42 }, (_, index) => {
      const current = new Date(gridStart);
      current.setDate(gridStart.getDate() + index);
      return {
        date: current,
        dateValue: formatDateValue(current),
        inMonth: current.getMonth() === deadlinePickerMonth.getMonth(),
        isToday: isSameDay(current, new Date()),
        isSelected: isSameDay(current, selectedDate)
      };
    });
  }, [deadlinePickerMonth, selectedDate]);

  const pushUpdate = (nextFormData) => {
    const noteBlocks = normalizeNoteBlocks(nextFormData.noteBlocks, nextFormData.description || "");

    onUpdate(task.id, {
      title: nextFormData.title.trim(),
      deadline: nextFormData.deadline || null,
      scheduledTime: nextFormData.scheduledTime || null,
      description: blocksToPlainText(noteBlocks),
      noteBlocks,
      tags: nextFormData.selectedTags
    });
  };

  const handleDeleteTask = () => {
    onDelete?.(task.id);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      pushUpdate(next);
      return next;
    });
  };

  const updateScheduledTime = (scheduledTime) => {
    setFormData((prev) => {
      const next = { ...prev, scheduledTime };
      pushUpdate(next);
      return next;
    });
  };

  const handleNoteBlocksChange = (noteBlocks, plainText) => {
    setFormData((prev) => {
      const next = {
        ...prev,
        noteBlocks,
        description: plainText ?? blocksToPlainText(noteBlocks)
      };
      pushUpdate(next);
      return next;
    });
  };

  const toggleTag = (tag) => {
    setFormData((prev) => {
      const next = {
        ...prev,
        selectedTags: prev.selectedTags.includes(tag) ? prev.selectedTags.filter((item) => item !== tag) : [...prev.selectedTags, tag]
      };
      pushUpdate(next);
      return next;
    });
  };

  const commitNewTag = () => {
    const trimmed = newTagDraft.trim();
    if (!trimmed) {
      setEditingNewTag(false);
      setNewTagDraft("");
      return;
    }

    onCreateTag(trimmed);
    setFormData((prev) => {
      const next = {
        ...prev,
        selectedTags: prev.selectedTags.includes(trimmed) ? prev.selectedTags : [...prev.selectedTags, trimmed]
      };
      pushUpdate(next);
      return next;
    });
    setEditingNewTag(false);
    setNewTagDraft("");
    setIsTagMenuOpen(true);
  };

  const handleRemoveTagOption = (tag) => {
    onDeleteTag(tag);
    setFormData((prev) => {
      const next = {
        ...prev,
        selectedTags: prev.selectedTags.filter((item) => item !== tag)
      };
      pushUpdate(next);
      return next;
    });
  };

  const startEditTag = (tag) => {
    setEditingTagName(tag);
    setEditingTagDraft(tag);
    setEditingNewTag(false);
  };

  const commitEditTag = () => {
    const nextTagName = editingTagDraft.trim();
    if (!editingTagName || !nextTagName) {
      setEditingTagName("");
      setEditingTagDraft("");
      return;
    }

    onRenameTag?.(editingTagName, nextTagName);
    setEditingTagName("");
    setEditingTagDraft("");
  };

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        if (isDeadlinePickerOpen) {
          setIsDeadlinePickerOpen(false);
          return;
        }
        if (editingNewTag) {
          setEditingNewTag(false);
          setNewTagDraft("");
          return;
        }
        if (editingTagName) {
          setEditingTagName("");
          setEditingTagDraft("");
          return;
        }
        if (isTagMenuOpen) {
          setIsTagMenuOpen(false);
          return;
        }
        if (isStatusMenuOpen) {
          setIsStatusMenuOpen(false);
          return;
        }
        if (isTimePickerOpen) {
          setIsTimePickerOpen(false);
          return;
        }
        onClose();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [editingNewTag, editingTagName, isTagMenuOpen, isStatusMenuOpen, isDeadlinePickerOpen, isTimePickerOpen, onClose]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const target = event.target;

      if (
        isDeadlinePickerOpen &&
        deadlinePickerRef.current &&
        !deadlinePickerRef.current.contains(target) &&
        deadlineButtonRef.current &&
        !deadlineButtonRef.current.contains(target)
      ) {
        setIsDeadlinePickerOpen(false);
      }

      if (
        isTagMenuOpen &&
        tagMenuRef.current &&
        !tagMenuRef.current.contains(target) &&
        tagTriggerRef.current &&
        !tagTriggerRef.current.contains(target)
      ) {
        setIsTagMenuOpen(false);
        setEditingNewTag(false);
        setNewTagDraft("");
        setEditingTagName("");
        setEditingTagDraft("");
      }

      if (
        isStatusMenuOpen &&
        statusMenuRef.current &&
        !statusMenuRef.current.contains(target) &&
        statusTriggerRef.current &&
        !statusTriggerRef.current.contains(target)
      ) {
        setIsStatusMenuOpen(false);
      }

      if (
        isTimePickerOpen &&
        timePickerRef.current &&
        !timePickerRef.current.contains(target) &&
        timeButtonRef.current &&
        !timeButtonRef.current.contains(target)
      ) {
        setIsTimePickerOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isTagMenuOpen, isStatusMenuOpen, isDeadlinePickerOpen, isTimePickerOpen]);

  useEffect(() => {
    if (editingNewTag && newTagInputRef.current) {
      newTagInputRef.current.focus();
      newTagInputRef.current.select();
    }
  }, [editingNewTag]);

  useEffect(() => {
    if (!autoFocusTitle || !task?.id || !titleInputRef.current) return;
    if (focusedTitleTaskIdRef.current === task.id) return;

    titleInputRef.current.focus({ preventScroll: true });
    titleInputRef.current.select();
    focusedTitleTaskIdRef.current = task.id;
  }, [autoFocusTitle, task.id]);

  useLayoutEffect(() => {
    if (!isTagMenuOpen || !tagTriggerRef.current) return;

    const updateTagMenuPosition = () => {
      const nextPosition = calculateTagMenuPosition();
      if (nextPosition) setTagMenuPosition(nextPosition);
    };

    const frame = requestAnimationFrame(updateTagMenuPosition);

    return () => cancelAnimationFrame(frame);
  }, [calculateTagMenuPosition, isTagMenuOpen, editingNewTag, availableTags.length, formData.selectedTags.length]);

  useLayoutEffect(() => {
    if (!isStatusMenuOpen || !statusTriggerRef.current) return;

    const updateStatusMenuPosition = () => {
      const nextPosition = calculateStatusMenuPosition();
      if (nextPosition) setStatusMenuPosition(nextPosition);
    };

    const frame = requestAnimationFrame(updateStatusMenuPosition);
    return () => cancelAnimationFrame(frame);
  }, [calculateStatusMenuPosition, isStatusMenuOpen]);

  useEffect(() => {
    if (!isTagMenuOpen) return;

    const handleReposition = () => {
      const nextPosition = calculateTagMenuPosition();
      if (nextPosition) setTagMenuPosition(nextPosition);
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [calculateTagMenuPosition, isTagMenuOpen]);

  useEffect(() => {
    if (!isStatusMenuOpen) return;

    const handleReposition = () => {
      const nextPosition = calculateStatusMenuPosition();
      if (nextPosition) setStatusMenuPosition(nextPosition);
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [calculateStatusMenuPosition, isStatusMenuOpen]);

  useLayoutEffect(() => {
    if (!isDeadlinePickerOpen || !deadlineButtonRef.current) return;

    setDeadlinePickerPosition(getAnchoredPopoverPlacement(deadlineButtonRef.current, { width: 320, height: 396 }));
  }, [isDeadlinePickerOpen, deadlinePickerMonth, formData.deadline]);

  useLayoutEffect(() => {
    if (!isTimePickerOpen || !timeButtonRef.current) return;

    setTimePickerPosition(getAnchoredPopoverPlacement(timeButtonRef.current, { width: 236, height: 286 }));
  }, [isTimePickerOpen, formData.scheduledTime]);

  useEffect(() => {
    if (!isDeadlinePickerOpen) return;

    const handleReposition = () => {
      if (!deadlineButtonRef.current) return;

      setDeadlinePickerPosition(getAnchoredPopoverPlacement(deadlineButtonRef.current, { width: 320, height: 396 }));
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isDeadlinePickerOpen]);

  useEffect(() => {
    if (!isTimePickerOpen) return;

    const handleReposition = () => {
      if (!timeButtonRef.current) return;

      setTimePickerPosition(getAnchoredPopoverPlacement(timeButtonRef.current, { width: 236, height: 286 }));
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isTimePickerOpen]);

  const tagMenu =
    isTagMenuOpen && tagMenuPosition
      ? createPortal(
          <div
            ref={tagMenuRef}
            className="fixed z-[80] overflow-hidden rounded-2xl border border-[#20242A] bg-[#111418] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.48)]"
            style={{
              top: `${tagMenuPosition.top}px`,
              left: `${tagMenuPosition.left}px`,
              width: `${tagMenuPosition.width}px`,
              maxHeight: `${tagMenuPosition.maxHeight}px`
            }}
          >
            <div className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#78D27F]">
              <span className="h-2 w-2 rounded-full bg-[#78D27F]" />
              Tags
            </div>

            <div className="mb-3 max-h-[172px] space-y-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {availableTags.length > 0 ? (
                availableTags.map((tag) => {
                  const checked = selectedTagSet.has(tag);
                  const isEditing = editingTagName === tag;

                  if (isEditing) {
                    return (
                      <div key={tag} className="flex items-center gap-2 rounded-xl border border-[#20242A] bg-[#171B20] px-3 py-2">
                        <span
                          className={clsx(
                            "h-2.5 w-2.5 shrink-0 rounded-full border",
                            checked ? "border-[#60B964] bg-[#60B964]" : "border-[#52525B] bg-[#15161A]"
                          )}
                        />
                        <input
                          value={editingTagDraft}
                          onChange={(event) => setEditingTagDraft(event.target.value)}
                          onBlur={commitEditTag}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitEditTag();
                            }
                            if (event.key === "Escape") {
                              setEditingTagName("");
                              setEditingTagDraft("");
                            }
                          }}
                          className="min-w-0 flex-1 bg-transparent text-sm text-[#F4F4F5] outline-none placeholder:text-[#71717A]"
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={tag}
                      className={clsx(
                        "group flex items-center gap-2 rounded-xl px-3 py-2 transition-colors",
                        checked ? "bg-[#1F3423]" : "hover:bg-[#171B20]"
                      )}
                    >
                      <button type="button" onClick={() => toggleTag(tag)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
                        <span
                          className={clsx(
                            "h-2.5 w-2.5 shrink-0 rounded-full border",
                            checked ? "border-[#60B964] bg-[#60B964]" : "border-[#52525B] bg-[#15161A]"
                          )}
                        />
                        <span className={clsx("truncate", checked ? "text-[#78D27F]" : "text-[#D4D4D8]")}>{tag}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditTag(tag)}
                        className="rounded-md p-1.5 text-[#71717A] opacity-0 transition-colors hover:bg-[#34363D] hover:text-[#F4F4F5] group-hover:opacity-100"
                        title="Rename tag"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTagOption(tag)}
                        className="rounded-md p-1.5 text-[#71717A] opacity-0 transition-colors hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
                        title="Delete tag"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl bg-[#171B20] px-3 py-2 text-sm font-semibold text-[#8B949E]">No tags yet</div>
              )}

              {editingNewTag && (
                <div className="flex items-center gap-2 rounded-xl border border-[#20242A] bg-[#171B20] px-3 py-2">
                  <Pencil className="h-4 w-4 text-[#9CA3AF]" />
                  <input
                    ref={newTagInputRef}
                    value={newTagDraft}
                    onChange={(event) => setNewTagDraft(event.target.value)}
                    onBlur={commitNewTag}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitNewTag();
                      }
                    }}
                    className="flex-1 bg-transparent text-sm text-[#F4F4F5] outline-none"
                    placeholder="New tag"
                  />
                </div>
              )}
            </div>

            {!editingNewTag && (
              <button
                type="button"
                onClick={() => {
                  setEditingNewTag(true);
                  setNewTagDraft("");
                }}
                className="inline-flex items-center gap-2 rounded-md border border-dashed border-[#52525B] px-3 py-2 text-sm font-medium text-[#A1A1AA] transition-colors hover:border-[#60B964] hover:text-[#F4F4F5]"
              >
                <Plus className="h-4 w-4" />
                Add tag
              </button>
            )}
          </div>,
          document.body
        )
      : null;

  const statusMenu =
    isStatusMenuOpen && statusMenuPosition
      ? createPortal(
          <div
            ref={statusMenuRef}
            className="fixed z-[80] overflow-hidden rounded-2xl border border-[#20242A] bg-[#111418] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.48)]"
            style={{
              top: `${statusMenuPosition.top}px`,
              left: `${statusMenuPosition.left}px`,
              width: `${statusMenuPosition.width}px`,
              maxHeight: `${statusMenuPosition.maxHeight}px`
            }}
          >
            <div className="space-y-1">
              {statusOptions.map((status) => {
                const isSelected = status.id === selectedStatusId;

                return (
                  <button
                    key={status.id}
                    type="button"
                    onClick={() => {
                      onUpdate(task.id, { statusId: status.id });
                      setIsStatusMenuOpen(false);
                    }}
                    className={clsx(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors",
                      isSelected ? "bg-[#1F3423] text-[#78D27F]" : "text-[#F7F7F8] hover:bg-[#25272F]"
                    )}
                  >
                    <span className="truncate">{status.name}</span>
                    {isSelected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )
      : null;

  const deadlinePicker =
    isDeadlinePickerOpen && deadlinePickerPosition
      ? createPortal(
          <div
            ref={deadlinePickerRef}
            className="fixed z-50 overflow-hidden rounded-2xl border border-[#20242A] bg-[#111418] shadow-[0_24px_60px_rgba(0,0,0,0.48)]"
            style={{
              top: `${deadlinePickerPosition.top}px`,
              left: `${deadlinePickerPosition.left}px`,
              width: `${deadlinePickerPosition.width}px`,
              maxHeight: `${deadlinePickerPosition.maxHeight}px`
            }}
          >
            <div className="flex items-center justify-between border-b border-[#20242A] px-3 py-3">
              <button
                type="button"
                className="rounded-md p-1 text-[#A1A1AA] transition-colors hover:bg-[#25272F] hover:text-[#F4F4F5]"
                onClick={() => setDeadlinePickerMonth((prev) => addMonths(prev, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="text-sm font-semibold text-[#F4F4F5]">
                {deadlinePickerMonth.getFullYear()}/{deadlinePickerMonth.getMonth() + 1}
              </div>

              <button
                type="button"
                className="rounded-md p-1 text-[#A1A1AA] transition-colors hover:bg-[#25272F] hover:text-[#F4F4F5]"
                onClick={() => setDeadlinePickerMonth((prev) => addMonths(prev, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="px-3 py-3">
              <div className="mb-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">
                {DAY_LABELS.map((label) => (
                  <div key={label}>{label}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {deadlineCalendarDays.map((day) => (
                  <button
                    key={day.dateValue}
                    type="button"
                    onClick={() => {
                      setFormData((prev) => {
                        const next = { ...prev, deadline: day.dateValue };
                        pushUpdate(next);
                        return next;
                      });
                      setIsDeadlinePickerOpen(false);
                    }}
                    className={clsx(
                      "flex h-9 items-center justify-center rounded-xl text-sm transition-colors",
                      day.inMonth ? "text-[#F4F4F5] hover:bg-[#25272F]" : "text-[#52525B] hover:bg-[#25272F]",
                      day.isToday && "border border-[#52525B]",
                      day.isSelected && "bg-[#60B964] text-white hover:bg-[#60B964]"
                    )}
                  >
                    {day.date.getDate()}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#20242A] pt-3">
                <button
                  type="button"
                  className="text-sm font-medium text-[#A1A1AA] transition-colors hover:text-[#F4F4F5]"
                  onClick={() => {
                    setFormData((prev) => {
                      const next = { ...prev, deadline: "" };
                      pushUpdate(next);
                      return next;
                    });
                    setIsDeadlinePickerOpen(false);
                  }}
                >
                  {"\u30af\u30ea\u30a2"}
                </button>

                <button
                  type="button"
                  className="text-sm font-medium text-[#A1A1AA] transition-colors hover:text-[#F4F4F5]"
                  onClick={() => {
                    const today = formatDateValue(new Date());
                    setFormData((prev) => {
                      const next = { ...prev, deadline: today };
                      pushUpdate(next);
                      return next;
                    });
                    setDeadlinePickerMonth(startOfMonth(new Date()));
                    setIsDeadlinePickerOpen(false);
                  }}
                >
                  {"\u4eca\u65e5"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  const timePicker =
    isTimePickerOpen && timePickerPosition
      ? createPortal(
          <div
            ref={timePickerRef}
            className="fixed z-[80] overflow-hidden rounded-2xl border border-[#20242A] bg-[#111418] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.48)]"
            style={{
              top: `${timePickerPosition.top}px`,
              left: `${timePickerPosition.left}px`,
              width: `${timePickerPosition.width}px`,
              maxHeight: `${timePickerPosition.maxHeight}px`
            }}
          >
            <div className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#78D27F]">
              <span className="h-2 w-2 rounded-full bg-[#78D27F]" />
              Time
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="max-h-52 space-y-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TIME_HOURS.map((hour) => {
                  const isSelected = hour === selectedHour;
                  return (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => updateScheduledTime(`${hour}:${selectedMinute === "--" ? "00" : selectedMinute}`)}
                      className={clsx(
                        "flex h-9 w-full items-center justify-center rounded-xl text-sm font-bold transition-colors",
                        isSelected ? "bg-[#1F3423] text-[#78D27F]" : "text-[#E4E7EB] hover:bg-[#25272F]"
                      )}
                    >
                      {hour}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1">
                {TIME_MINUTES.map((minute) => {
                  const isSelected = minute === selectedMinute;
                  return (
                    <button
                      key={minute}
                      type="button"
                      onClick={() => {
                        updateScheduledTime(`${selectedHour === "--" ? "09" : selectedHour}:${minute}`);
                        setIsTimePickerOpen(false);
                      }}
                      className={clsx(
                        "flex h-9 w-full items-center justify-center rounded-xl text-sm font-bold transition-colors",
                        isSelected ? "bg-[#1F3423] text-[#78D27F]" : "text-[#E4E7EB] hover:bg-[#25272F]"
                      )}
                    >
                      {minute}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 border-t border-[#20242A] pt-3">
              <button
                type="button"
                onClick={() => {
                  updateScheduledTime("");
                  setIsTimePickerOpen(false);
                }}
                className="w-full rounded-xl px-3 py-2 text-sm font-bold text-[#AAB4C2] transition-colors hover:bg-[#25272F] hover:text-[#F4F4F5]"
              >
                {"\u6642\u9593\u3092\u89e3\u9664"}
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={popupPanelRef} className="flex h-full flex-col overflow-hidden border-l border-[#2A2D35] bg-[#1C1D22] shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
      <div className="flex shrink-0 items-center justify-between border-b border-[#34363D] px-7 py-5">
        <button
          type="button"
          className="rounded-md p-2 text-[#A1A1AA] transition-colors hover:bg-[#25272F] hover:text-[#F4F4F5]"
          onClick={onClose}
          title="Close"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="rounded-md p-2 text-[#A1A1AA] transition-colors hover:bg-red-500/10 hover:text-red-300"
          onClick={handleDeleteTask}
          title="Delete task"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="space-y-6">
          <div>
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => onUpdate(task.id, { completed: !task.completed })}
                className={clsx(
                  "mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                  task.completed
                    ? "border-[#60B964] bg-[#60B964] text-[#06100D]"
                    : "border-[#3F4652] bg-transparent text-transparent hover:border-[#60B964]/80 hover:bg-[#60B964]/10"
                )}
                title={task.completed ? "未完了に戻す" : "完了にする"}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <input
                ref={titleInputRef}
                name="title"
                value={formData.title}
                onChange={handleChange}
                className={clsx(
                  "min-w-0 flex-1 border-0 bg-transparent px-0 py-1 text-[30px] font-bold leading-tight outline-none placeholder:text-[#7B8490]",
                  task.completed ? "text-[#8B949E] line-through decoration-[#8B949E]/80 decoration-2" : "text-[#F7F7F8]"
                )}
                placeholder={"\u7121\u984c"}
              />
            </div>
          </div>

          <div className="space-y-1 border-y border-[#34363D]/80 py-4">

          <Field label={"\u671f\u9650"}>
            <div className="relative">
              <button
                ref={deadlineButtonRef}
                type="button"
                onClick={() => {
                  setDeadlinePickerMonth(startOfMonth(parseDateValue(formData.deadline) || new Date()));
                  setIsDeadlinePickerOpen((prev) => !prev);
                }}
                className="inline-flex min-h-9 w-fit max-w-full items-center gap-2 rounded-md border border-transparent px-2.5 py-1.5 text-left text-sm font-semibold transition-colors hover:border-[#34363D] hover:bg-[#25272F] focus:border-[#60B964] focus:outline-none focus:ring-2 focus:ring-[#60B964]/20"
              >
                <div className="min-w-0 flex-1">
                  <div className={clsx("text-sm font-semibold", formData.deadline ? "text-[#F7F7F8]" : "text-[#B4BDCA]")}>
                    {formData.deadline ? formattedDeadline : "\u65e5\u4ed8\u306a\u3057"}
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold text-[#AAB4C2]">{formData.deadline ? "\u671f\u9650" : "\u671f\u9650\u3092\u8a2d\u5b9a"}</div>
                </div>

                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#A1A1AA]">
                  <CalendarDays className="h-4 w-4" />
                </div>
              </button>
            </div>
          </Field>

          <Field label={"\u6642\u9593"}>
            <div className="flex items-center gap-2">
              <button
                ref={timeButtonRef}
                type="button"
                onClick={() => {
                  setIsTimePickerOpen((prev) => !prev);
                  setIsDeadlinePickerOpen(false);
                  setIsTagMenuOpen(false);
                  setIsStatusMenuOpen(false);
                }}
                className={clsx(
                  "inline-flex min-h-9 min-w-[132px] items-center justify-between gap-3 rounded-md border px-2.5 py-1.5 text-left text-sm font-semibold outline-none transition-colors",
                  isTimePickerOpen
                    ? "border-[#60B964] bg-[#25272F] text-[#F7F7F8] ring-2 ring-[#60B964]/20"
                    : "border-transparent text-[#F7F7F8] hover:border-[#34363D] hover:bg-[#25272F]"
                )}
              >
                <span className={clsx("tabular-nums", formData.scheduledTime ? "text-[#F7F7F8]" : "text-[#B4BDCA]")}>
                  {formData.scheduledTime || "--:--"}
                </span>
                <Clock className="h-4 w-4 shrink-0 text-[#A1A1AA]" />
              </button>

              <button
                type="button"
                onClick={() => updateScheduledTime("")}
                className="rounded-md px-2.5 py-1.5 text-sm font-semibold text-[#8B949E] transition-colors hover:bg-[#25272F] hover:text-[#F4F4F5]"
              >
                {"\u89e3\u9664"}
              </button>
            </div>
          </Field>

          <Field label={"\u30bf\u30b0"} align="start">
            <div className="relative">
              <button
                ref={tagTriggerRef}
                type="button"
                onClick={() => {
                  setIsTagMenuOpen((prev) => !prev);
                  setIsStatusMenuOpen(false);
                  setEditingNewTag(false);
                  setNewTagDraft("");
                }}
                className="flex min-h-9 w-full items-center justify-between rounded-md border border-transparent px-2.5 py-1.5 text-left transition-colors hover:border-[#34363D] hover:bg-[#25272F]"
              >
                <div className="flex min-w-0 flex-wrap gap-2">
                  {formData.selectedTags.length > 0 ? (
                    formData.selectedTags.map((tag) => (
                      <span key={tag} className="rounded-full bg-[#25272F] px-2.5 py-1 text-xs font-medium text-[#D4D4D8]">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm font-semibold text-[#B4BDCA]">{"\u30bf\u30b0\u306a\u3057"}</span>
                  )}
                </div>
                <ChevronDown className={clsx("h-4 w-4 shrink-0 text-[#9CA3AF] transition-transform", isTagMenuOpen && "rotate-180")} />
              </button>

              {tagMenu}
            </div>
          </Field>

          <Field label="ステータス">
            <div className="relative">
              <button
                ref={statusTriggerRef}
                type="button"
                onClick={() => {
                  setIsStatusMenuOpen((prev) => !prev);
                  setIsTagMenuOpen(false);
                  setEditingNewTag(false);
                  setNewTagDraft("");
                  setEditingTagName("");
                  setEditingTagDraft("");
                }}
                className="flex min-h-9 w-full items-center justify-between rounded-md border border-transparent px-2.5 py-1.5 text-left text-sm font-semibold text-[#F7F7F8] outline-none transition-colors hover:border-[#34363D] hover:bg-[#25272F] focus:border-[#60B964] focus:ring-2 focus:ring-[#60B964]/20"
              >
                <span className="truncate">{selectedStatus?.name || "未設定"}</span>
                <ChevronDown className={clsx("h-4 w-4 shrink-0 text-[#9CA3AF] transition-transform", isStatusMenuOpen && "rotate-180")} />
              </button>
              {statusMenu}
            </div>
          </Field>
        </div>

        <BlockNoteEditor blocks={formData.noteBlocks} onChange={handleNoteBlocksChange} />
        </div>
      </div>

      {deadlinePicker}
      {timePicker}
    </div>
  );
}




