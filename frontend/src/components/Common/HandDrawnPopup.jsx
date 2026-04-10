import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getRecurrenceSummary, REPEAT_PRESETS } from "../../utils/recurrence";

const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

function Field({ label, children, align = "center" }) {
  const alignClass = align === "start" ? "md:items-start" : "md:items-center";
  return (
    <div className={`grid gap-3 md:grid-cols-[84px_1fr] ${alignClass}`}>
      <label className="pt-1 text-sm font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function PopupSelect({ value, options, onChange, buttonClassName = "", menuWidth = 260, menuLabel = "" }) {
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    const updatePosition = () => {
      if (!buttonRef.current) return;

      const rect = buttonRef.current.getBoundingClientRect();
      const width = Math.min(menuWidth, window.innerWidth - 24);
      const gap = 8;
      const menuHeight = 320;
      const top = Math.min(window.innerHeight - 12, rect.bottom + gap);
      const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);

      setPosition({
        top,
        left,
        width,
        maxHeight: Math.max(180, Math.min(menuHeight, window.innerHeight - top - 12))
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    const handlePointerDown = (event) => {
      const target = event.target;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [open, menuWidth]);

  const selectedLabel = options.find((option) => option.value === value)?.label || "";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={clsx(
          "flex w-full items-center justify-between rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300 hover:bg-white focus:border-slate-400 focus:outline-none",
          buttonClassName
        )}
      >
        <span className={clsx("min-w-0 flex-1 truncate text-sm font-medium", selectedLabel ? "text-slate-900" : "text-slate-400")}>
          {selectedLabel || menuLabel}
        </span>
        <ChevronDown className={clsx("ml-3 h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-50 overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
              style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                width: `${position.width}px`,
                maxHeight: `${position.maxHeight}px`
              }}
            >
              <div className="max-h-full overflow-y-auto p-2">
                {options.map((option) => {
                  const selected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className={clsx(
                        "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors",
                        selected ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <span>{option.label}</span>
                      {selected ? <Check className="h-4 w-4 text-slate-900" /> : <span className="h-4 w-4" />}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
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

const createDefaultRecurrenceState = (task) => {
  return {
    recurrencePreset: task.placementType === "recurring" ? task.recurrence?.preset || "weekly" : "none",
    recurrenceInterval: task.recurrence?.interval ? String(task.recurrence.interval) : "1",
    recurrenceUnit: task.recurrence?.unit || "week",
    deadlineOffsetDays: String(task.recurrence?.deadlineOffsetDays ?? 0)
  };
};

const buildRecurrencePayload = (formData) => {
  const preset = formData.recurrencePreset || "none";

  if (preset === "none") {
    return {
      placementType: "manual",
      recurrence: null
    };
  }

  const payload = {
    preset,
    deadlineOffsetDays: Math.max(0, Number(formData.deadlineOffsetDays) || 0)
  };

  if (preset === "weekly") {
    return {
      placementType: "recurring",
      recurrence: payload
    };
  }

  if (preset === "custom") {
    payload.interval = Math.max(1, Number(formData.recurrenceInterval) || 1);
    payload.unit = formData.recurrenceUnit || "week";
  }

  return {
    placementType: "recurring",
    recurrence: payload
  };
};

export default function HandDrawnPopup({
  task,
  availableTags = [],
  onCreateTag,
  onDeleteTag,
  onClose,
  onUpdate,
  autoFocusTaskTitle = false
}) {
  const tagMenuRef = useRef(null);
  const tagTriggerRef = useRef(null);
  const newTagInputRef = useRef(null);
  const titleInputRef = useRef(null);
  const focusedTitleTaskIdRef = useRef(null);
  const deadlineButtonRef = useRef(null);
  const deadlinePickerRef = useRef(null);
  const [tagMenuDirection, setTagMenuDirection] = useState("down");
  const [deadlinePickerPosition, setDeadlinePickerPosition] = useState(null);
  const [formData, setFormData] = useState({
    title: task.title || "",
    selectedTags: task.tags || [],
    deadline: task.deadline || "",
    description: task.description || "",
    ...createDefaultRecurrenceState(task)
  });
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [editingNewTag, setEditingNewTag] = useState(false);
  const [newTagDraft, setNewTagDraft] = useState("");
  const [isDeadlinePickerOpen, setIsDeadlinePickerOpen] = useState(false);
  const [deadlinePickerMonth, setDeadlinePickerMonth] = useState(() => startOfMonth(parseDateValue(task.deadline) || new Date()));

  const selectedTagSet = useMemo(() => new Set(formData.selectedTags), [formData.selectedTags]);
  const selectedDate = useMemo(() => parseDateValue(formData.deadline), [formData.deadline]);
  const formattedDeadline = useMemo(() => formatDateLabel(formData.deadline), [formData.deadline]);

  const deadlineCalendarDays = useMemo(() => {
    const monthStart = startOfMonth(deadlinePickerMonth);
    const startWeekday = (monthStart.getDay() + 6) % 7;
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
    const recurrence = buildRecurrencePayload(nextFormData);
    onUpdate(task.id, {
      title: nextFormData.title.trim(),
      deadline: nextFormData.deadline || null,
      description: nextFormData.description,
      tags: nextFormData.selectedTags,
      ...recurrence
    });
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
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
        if (isTagMenuOpen) {
          setIsTagMenuOpen(false);
          return;
        }
        onClose();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [editingNewTag, isTagMenuOpen, isDeadlinePickerOpen, onClose]);

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
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isTagMenuOpen, isDeadlinePickerOpen]);

  useEffect(() => {
    if (editingNewTag && newTagInputRef.current) {
      newTagInputRef.current.focus();
      newTagInputRef.current.select();
    }
  }, [editingNewTag]);

  useEffect(() => {
    if (!autoFocusTaskTitle || !task?.id || !titleInputRef.current) return;
    if (focusedTitleTaskIdRef.current === task.id) return;

    titleInputRef.current.focus();
    titleInputRef.current.select();
    focusedTitleTaskIdRef.current = task.id;
  }, [autoFocusTaskTitle, task.id]);

  useLayoutEffect(() => {
    if (!isTagMenuOpen || !tagTriggerRef.current) return;

    const frame = requestAnimationFrame(() => {
      if (!tagTriggerRef.current) return;

      const rect = tagTriggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setTagMenuDirection(spaceBelow < 320 && spaceAbove > spaceBelow ? "up" : "down");
    });

    return () => cancelAnimationFrame(frame);
  }, [isTagMenuOpen, editingNewTag, availableTags.length, formData.selectedTags.length]);

  useLayoutEffect(() => {
    if (!isDeadlinePickerOpen || !deadlineButtonRef.current) return;

    const rect = deadlineButtonRef.current.getBoundingClientRect();
    const pickerWidth = 332;
    const pickerHeight = 412;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < pickerHeight && spaceAbove > spaceBelow;
    const top = openUp ? Math.max(12, rect.top - 16 - pickerHeight) : Math.min(window.innerHeight - 12, rect.bottom + 12);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - pickerWidth - 12);

    setDeadlinePickerPosition({
      top,
      left,
      width: Math.min(pickerWidth, window.innerWidth - 24)
    });
  }, [isDeadlinePickerOpen, deadlinePickerMonth, formData.deadline]);

  useEffect(() => {
    if (!isDeadlinePickerOpen) return;

    const handleReposition = () => {
      if (!deadlineButtonRef.current) return;

      const rect = deadlineButtonRef.current.getBoundingClientRect();
      const pickerWidth = 332;
      const pickerHeight = 412;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < pickerHeight && spaceAbove > spaceBelow;
      const top = openUp ? Math.max(12, rect.top - 16 - pickerHeight) : Math.min(window.innerHeight - 12, rect.bottom + 12);
      const left = Math.min(Math.max(12, rect.left), window.innerWidth - pickerWidth - 12);

      setDeadlinePickerPosition({
        top,
        left,
        width: Math.min(pickerWidth, window.innerWidth - 24)
      });
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isDeadlinePickerOpen]);

  const deadlinePicker =
    isDeadlinePickerOpen && deadlinePickerPosition
      ? createPortal(
          <div
            ref={deadlinePickerRef}
            className="fixed z-50 rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]"
            style={{
              top: `${deadlinePickerPosition.top}px`,
              left: `${deadlinePickerPosition.left}px`,
              width: `${deadlinePickerPosition.width}px`
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <button
                type="button"
                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                onClick={() => setDeadlinePickerMonth((prev) => addMonths(prev, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="text-sm font-semibold text-slate-900">
                {deadlinePickerMonth.getFullYear()}/{deadlinePickerMonth.getMonth() + 1}
              </div>

              <button
                type="button"
                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                onClick={() => setDeadlinePickerMonth((prev) => addMonths(prev, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 py-3">
              <div className="mb-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
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
                      "flex h-10 items-center justify-center rounded-xl text-sm transition-colors",
                      day.inMonth ? "text-slate-800 hover:bg-slate-50" : "text-slate-300 hover:bg-slate-50/80",
                      day.isToday && "border border-slate-300",
                      day.isSelected && "bg-slate-900 text-white hover:bg-slate-900"
                    )}
                  >
                    {day.date.getDate()}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
                  onClick={() => {
                    setFormData((prev) => {
                      const next = { ...prev, deadline: "" };
                      pushUpdate(next);
                      return next;
                    });
                    setIsDeadlinePickerOpen(false);
                  }}
                >
                  クリア
                </button>

                <button
                  type="button"
                  className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
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
                  今日
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">詳細</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">タスク編集</div>
        </div>
        <button
          type="button"
          className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-5">
          <div>
            <input
              ref={titleInputRef}
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-2xl font-semibold text-slate-900 outline-none transition-colors placeholder:text-slate-300 focus:border-slate-400"
              placeholder="タスク名"
            />
          </div>

          <Field label="説明" align="start">
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
              placeholder="メモを追加"
            />
          </Field>

          <Field label="自動配置" align="start">
            <div className="space-y-3">
              <PopupSelect
                value={formData.recurrencePreset}
                menuLabel="自動配置を選択"
                menuWidth={280}
                onChange={(value) =>
                  setFormData((prev) => {
                    const next = { ...prev, recurrencePreset: value };
                    pushUpdate(next);
                    return next;
                  })
                }
                options={REPEAT_PRESETS}
              />

              {formData.recurrencePreset === "custom" && (
                <div className="grid grid-cols-[110px_1fr] gap-2">
                  <input
                    type="number"
                    min="1"
                    value={formData.recurrenceInterval}
                    onChange={(event) =>
                      setFormData((prev) => {
                        const next = { ...prev, recurrenceInterval: event.target.value };
                        pushUpdate(next);
                        return next;
                      })
                    }
                    className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition-colors hover:border-slate-300 focus:border-slate-400"
                  />

                  <PopupSelect
                    value={formData.recurrenceUnit}
                    menuLabel="単位を選択"
                    menuWidth={220}
                    onChange={(value) =>
                      setFormData((prev) => {
                        const next = { ...prev, recurrenceUnit: value };
                        pushUpdate(next);
                        return next;
                      })
                    }
                    options={[
                      { value: "day", label: "日ごと" },
                      { value: "week", label: "週ごと" },
                      { value: "month", label: "月ごと" },
                      { value: "year", label: "年ごと" }
                    ]}
                  />
                </div>
              )}

              {formData.recurrencePreset !== "none" && (
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  自動配置: {getRecurrenceSummary({ ...task, placementType: "recurring", recurrence: buildRecurrencePayload(formData).recurrence, deadline: formData.deadline })}
                </div>
              )}
            </div>
          </Field>

          <Field label="期限">
            {formData.recurrencePreset === "none" ? (
              <div className="relative">
                <button
                  ref={deadlineButtonRef}
                  type="button"
                  onClick={() => {
                    setDeadlinePickerMonth(startOfMonth(parseDateValue(formData.deadline) || new Date()));
                    setIsDeadlinePickerOpen((prev) => !prev);
                  }}
                  className="flex w-full items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300 hover:bg-white focus:border-slate-400 focus:outline-none"
                >
                  <div className="min-w-0 flex-1">
                    <div className={clsx("text-sm font-semibold", formData.deadline ? "text-slate-900" : "text-slate-400")}>
                      {formData.deadline ? formattedDeadline : "日付を選択"}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-slate-400">{formData.deadline ? "期限" : "期限を設定"}</div>
                  </div>

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-[20px] border border-slate-200 bg-slate-50/70 px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => {
                        const next = {
                          ...prev,
                          deadlineOffsetDays: String(Math.max(0, (Number(prev.deadlineOffsetDays) || 0) - 1))
                        };
                        pushUpdate(next);
                        return next;
                      })
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
                    aria-label="相対期限を減らす"
                  >
                    -
                  </button>

                  <div className="min-w-0 flex-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formData.deadlineOffsetDays}
                      onChange={(event) =>
                        setFormData((prev) => {
                          const next = { ...prev, deadlineOffsetDays: event.target.value };
                          pushUpdate(next);
                          return next;
                        })
                      }
                      className="w-full bg-transparent text-center text-2xl font-semibold tracking-tight text-slate-900 outline-none placeholder:text-slate-300"
                      placeholder="0"
                    />
                    <div className="mt-0.5 text-center text-[11px] font-medium text-slate-400">何日後に期限にするか</div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => {
                        const next = {
                          ...prev,
                          deadlineOffsetDays: String((Number(prev.deadlineOffsetDays) || 0) + 1)
                        };
                        pushUpdate(next);
                        return next;
                      })
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
                    aria-label="相対期限を増やす"
                  >
                    +
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[0, 1, 3, 7, 14, 30].map((days) => {
                    const selected = Number(formData.deadlineOffsetDays) === days;
                    return (
                      <button
                        key={days}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => {
                            const next = { ...prev, deadlineOffsetDays: String(days) };
                            pushUpdate(next);
                            return next;
                          })
                        }
                        className={clsx(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                          selected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                        )}
                      >
                        {days === 0 ? "当日" : `${days}日後`}
                      </button>
                    );
                  })}
                </div>

                <div className="text-xs text-slate-500">
                  自動配置の予定日からの相対期限です。例えば「3日後」なら、各回の予定日の3日後が締切になります。
                </div>
              </div>
            )}
          </Field>

          <Field label="タグ" align="start">
            <div className="relative">
              <button
                ref={tagTriggerRef}
                type="button"
                onClick={() => {
                  setIsTagMenuOpen((prev) => !prev);
                  setEditingNewTag(false);
                  setNewTagDraft("");
                }}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-slate-300"
              >
                <div className="flex min-w-0 flex-wrap gap-2">
                  {formData.selectedTags.length > 0 ? (
                    formData.selectedTags.map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">タグを選択</span>
                  )}
                </div>
                <ChevronDown className={clsx("h-4 w-4 shrink-0 text-slate-400 transition-transform", isTagMenuOpen && "rotate-180")} />
              </button>

              {isTagMenuOpen && (
                <div
                  ref={tagMenuRef}
                  className={clsx(
                    "absolute left-0 right-0 z-20 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.12)]",
                    tagMenuDirection === "up" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"
                  )}
                >
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">タグ一覧</div>

                  <div className="mb-3 max-h-40 space-y-1 overflow-y-auto pr-1">
                    {availableTags.length > 0 ? (
                      availableTags.map((tag) => {
                        const checked = selectedTagSet.has(tag);
                        return (
                          <div
                            key={tag}
                            className={clsx("group flex items-center gap-2 rounded-xl px-3 py-2 transition-colors", checked ? "bg-slate-100" : "hover:bg-slate-50")}
                          >
                            <button type="button" onClick={() => toggleTag(tag)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
                              <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full border", checked ? "border-slate-900 bg-slate-900" : "border-slate-300 bg-white")} />
                              <span className="truncate text-slate-700">{tag}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveTagOption(tag)}
                              className="rounded-lg p-1.5 text-slate-400 opacity-0 transition-colors hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                              title="タグを削除"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">まだタグはありません</div>
                    )}

                    {editingNewTag && (
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                        <Pencil className="h-4 w-4 text-slate-400" />
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
                          className="flex-1 bg-transparent text-sm text-slate-800 outline-none"
                        placeholder="新しいタグ"
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
                      className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900"
                    >
                      <Plus className="h-4 w-4" />
                    タグを追加
                    </button>
                  )}
                </div>
              )}
            </div>
          </Field>
        </div>
      </div>

      {deadlinePicker}
    </div>
  );
}



