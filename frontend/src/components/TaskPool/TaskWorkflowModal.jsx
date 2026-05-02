import clsx from "clsx";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  X
} from "lucide-react";
import { getAnchoredPopoverPlacement } from "../../utils/popoverPosition";

const COLOR_OPTIONS = ["#5B8DEF", "#4FB7A8", "#D9A441", "#8A7FD1", "#7FA36B", "#C97B63", "#5FA3B7", "#C27A92"];

const WEEKDAY_OPTIONS = [
  { value: 0, label: "日曜日" },
  { value: 1, label: "月曜日" },
  { value: 2, label: "火曜日" },
  { value: 3, label: "水曜日" },
  { value: 4, label: "木曜日" },
  { value: 5, label: "金曜日" },
  { value: 6, label: "土曜日" }
];

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "毎日" },
  { value: "weekly", label: "毎週" },
  { value: "monthly", label: "毎月" }
];

const DUE_OFFSET_PRESETS = [0, 1, 3, 7, 14];
const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

const formatToday = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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

const normalizeTags = (tags) => Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));

function PickerField({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-medium text-[#A1A1AA]">{label}</div>
      {children}
    </label>
  );
}

export default function TaskWorkflowModal({ workflow = null, availableTags = [], onSave, onClose }) {
  const [workflowName, setWorkflowName] = useState(() => workflow?.name || "");
  const [title, setTitle] = useState(() => workflow?.template?.title || "");
  const [description, setDescription] = useState(() => workflow?.template?.description || "");
  const [selectedTags, setSelectedTags] = useState(() => normalizeTags(workflow?.template?.tags || []));
  const [color, setColor] = useState(() => workflow?.template?.color || COLOR_OPTIONS[0]);
  const [frequency, setFrequency] = useState(() => workflow?.schedule?.frequency || "weekly");
  const [startDate, setStartDate] = useState(() => workflow?.schedule?.startDate || formatToday());
  const [weekdays, setWeekdays] = useState(() => workflow?.schedule?.weekdays || [1]);
  const [dayOfMonth, setDayOfMonth] = useState(() => workflow?.schedule?.dayOfMonth || 1);
  const [dueOffsetDays, setDueOffsetDays] = useState(() => workflow?.template?.dueOffsetDays || 0);
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [isFrequencyMenuOpen, setIsFrequencyMenuOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [tagMenuPosition, setTagMenuPosition] = useState(null);
  const [datePickerMonth, setDatePickerMonth] = useState(() => startOfMonth(parseDateValue(formatToday()) || new Date()));
  const [frequencyMenuPosition, setFrequencyMenuPosition] = useState(null);
  const [datePickerPosition, setDatePickerPosition] = useState(null);
  const tagButtonRef = useRef(null);
  const tagMenuRef = useRef(null);
  const frequencyButtonRef = useRef(null);
  const frequencyMenuRef = useRef(null);
  const startDateButtonRef = useRef(null);
  const startDatePickerRef = useRef(null);

  const selectableTags = useMemo(() => normalizeTags(availableTags), [availableTags]);

  const toggleTag = (tag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  const selectedDate = useMemo(() => parseDateValue(startDate), [startDate]);
  const formattedStartDate = useMemo(() => formatDateLabel(startDate), [startDate]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(datePickerMonth);
    const startWeekday = monthStart.getDay();
    const gridStart = new Date(monthStart);
    gridStart.setDate(gridStart.getDate() - startWeekday);

    return Array.from({ length: 42 }, (_, index) => {
      const current = new Date(gridStart);
      current.setDate(gridStart.getDate() + index);
      return {
        date: current,
        dateValue: formatDateValue(current),
        inMonth: current.getMonth() === datePickerMonth.getMonth(),
        isToday: isSameDay(current, new Date()),
        isSelected: isSameDay(current, selectedDate)
      };
    });
  }, [datePickerMonth, selectedDate]);

  const toggleWeekday = (value) => {
    setWeekdays((prev) => {
      if (prev.includes(value)) {
        if (prev.length === 1) return prev;
        return prev.filter((day) => day !== value);
      }
      return [...prev, value].sort((a, b) => a - b);
    });
  };

  const canSave = title.trim().length > 0 && startDate && (frequency !== "weekly" || weekdays.length > 0);

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        if (isTagMenuOpen) {
          setIsTagMenuOpen(false);
          return;
        }
        if (isDatePickerOpen) {
          setIsDatePickerOpen(false);
          return;
        }
        if (isFrequencyMenuOpen) {
          setIsFrequencyMenuOpen(false);
          return;
        }
        onClose();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isTagMenuOpen, isDatePickerOpen, isFrequencyMenuOpen, onClose]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const target = event.target;

      if (
        isTagMenuOpen &&
        tagMenuRef.current &&
        !tagMenuRef.current.contains(target) &&
        tagButtonRef.current &&
        !tagButtonRef.current.contains(target)
      ) {
        setIsTagMenuOpen(false);
      }

      if (
        isFrequencyMenuOpen &&
        frequencyMenuRef.current &&
        !frequencyMenuRef.current.contains(target) &&
        frequencyButtonRef.current &&
        !frequencyButtonRef.current.contains(target)
      ) {
        setIsFrequencyMenuOpen(false);
      }

      if (
        isDatePickerOpen &&
        startDatePickerRef.current &&
        !startDatePickerRef.current.contains(target) &&
        startDateButtonRef.current &&
        !startDateButtonRef.current.contains(target)
      ) {
        setIsDatePickerOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isTagMenuOpen, isDatePickerOpen, isFrequencyMenuOpen]);

  useLayoutEffect(() => {
    if (!isTagMenuOpen || !tagButtonRef.current) return;

    const frame = requestAnimationFrame(() => {
      if (!tagButtonRef.current) return;
      setTagMenuPosition(getAnchoredPopoverPlacement(tagButtonRef.current, { width: 360, height: 320 }));
    });

    return () => cancelAnimationFrame(frame);
  }, [isTagMenuOpen, selectedTags.length, selectableTags.length]);

  useEffect(() => {
    if (!isTagMenuOpen) return;

    const handleReposition = () => {
      if (!tagButtonRef.current) return;
      setTagMenuPosition(getAnchoredPopoverPlacement(tagButtonRef.current, { width: 360, height: 320 }));
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isTagMenuOpen]);

  useLayoutEffect(() => {
    if (!isFrequencyMenuOpen || !frequencyButtonRef.current) return;

    const frame = requestAnimationFrame(() => {
      if (!frequencyButtonRef.current) return;
      setFrequencyMenuPosition(getAnchoredPopoverPlacement(frequencyButtonRef.current, { width: 240, height: 176 }));
    });

    return () => cancelAnimationFrame(frame);
  }, [isFrequencyMenuOpen]);

  useLayoutEffect(() => {
    if (!isDatePickerOpen || !startDateButtonRef.current) return;

    setDatePickerPosition(getAnchoredPopoverPlacement(startDateButtonRef.current, { width: 320, height: 396 }));
  }, [isDatePickerOpen, datePickerMonth, startDate]);

  useEffect(() => {
    if (!isDatePickerOpen) return;

    const handleReposition = () => {
      if (!startDateButtonRef.current) return;
      setDatePickerPosition(getAnchoredPopoverPlacement(startDateButtonRef.current, { width: 320, height: 396 }));
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isDatePickerOpen]);

  useEffect(() => {
    if (!isFrequencyMenuOpen) return;

    const handleReposition = () => {
      if (!frequencyButtonRef.current) return;
      setFrequencyMenuPosition(getAnchoredPopoverPlacement(frequencyButtonRef.current, { width: 240, height: 176 }));
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isFrequencyMenuOpen]);

  const tagMenu =
    isTagMenuOpen && tagMenuPosition
      ? createPortal(
          <div
            ref={tagMenuRef}
            className="fixed z-[100] overflow-hidden rounded-2xl border border-[#20242A] bg-[#111418] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.48)]"
            style={{
              top: `${tagMenuPosition.top}px`,
              left: `${tagMenuPosition.left}px`,
              width: `${tagMenuPosition.width}px`,
              maxHeight: `${tagMenuPosition.maxHeight}px`
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#78D27F]">Tags</div>
              {selectedTags.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  className="rounded-md px-2 py-1 text-xs font-bold text-[#8B949E] transition-colors hover:bg-[#25272F] hover:text-[#F4F4F5]"
                >
                  クリア
                </button>
              ) : null}
            </div>

            <div className="max-h-60 space-y-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {selectableTags.length > 0 ? (
                selectableTags.map((tag) => {
                  const selected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={clsx(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-bold transition-colors",
                        selected ? "bg-[#1F3423] text-[#78D27F]" : "text-[#D7DEE8] hover:bg-[#171B20]"
                      )}
                    >
                      <span className="truncate">{tag}</span>
                      {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
                    </button>
                  );
                })
              ) : (
                <div className="rounded-lg border border-dashed border-[#34363D] px-3 py-4 text-center text-sm font-semibold text-[#8B949E]">
                  タグはまだありません
                </div>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  const frequencyMenu =
    isFrequencyMenuOpen && frequencyMenuPosition
      ? createPortal(
          <div
            ref={frequencyMenuRef}
            className="fixed z-[100] overflow-hidden rounded-2xl border border-[#20242A] bg-[#111418] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.48)]"
            style={{
              top: `${frequencyMenuPosition.top}px`,
              left: `${frequencyMenuPosition.left}px`,
              width: `${frequencyMenuPosition.width}px`,
              maxHeight: `${frequencyMenuPosition.maxHeight}px`
            }}
          >
            <div className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-[#78D27F]">
              <span className="h-2 w-2 rounded-full bg-[#78D27F]" />
              Frequency
            </div>
            {FREQUENCY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setFrequency(option.value);
                  setIsFrequencyMenuOpen(false);
                }}
                className={clsx(
                  "mb-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors last:mb-0",
                  frequency === option.value ? "bg-[#1F3423] text-[#78D27F]" : "text-[#F7F7F8] hover:bg-[#171B20]"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  const datePicker =
    isDatePickerOpen && datePickerPosition
      ? createPortal(
          <div
            ref={startDatePickerRef}
            className="fixed z-[100] overflow-hidden rounded-2xl border border-[#20242A] bg-[#111418] shadow-[0_24px_60px_rgba(0,0,0,0.48)]"
            style={{
              top: `${datePickerPosition.top}px`,
              left: `${datePickerPosition.left}px`,
              width: `${datePickerPosition.width}px`,
              maxHeight: `${datePickerPosition.maxHeight}px`
            }}
          >
            <div className="flex items-center justify-between border-b border-[#20242A] px-3 py-3">
              <button
                type="button"
                className="rounded-md p-1 text-[#A1A1AA] transition-colors hover:bg-[#25272F] hover:text-[#F4F4F5]"
                onClick={() => setDatePickerMonth((prev) => addMonths(prev, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="text-sm font-semibold text-[#F4F4F5]">
                {datePickerMonth.getFullYear()}/{datePickerMonth.getMonth() + 1}
              </div>

              <button
                type="button"
                className="rounded-md p-1 text-[#A1A1AA] transition-colors hover:bg-[#25272F] hover:text-[#F4F4F5]"
                onClick={() => setDatePickerMonth((prev) => addMonths(prev, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="px-3 py-3">
              <div className="mb-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A1A1AA]">
                {DAY_LABELS.map((label) => (
                  <div key={label}>{label}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => (
                  <button
                    key={day.dateValue}
                    type="button"
                    onClick={() => {
                      setStartDate(day.dateValue);
                      setIsDatePickerOpen(false);
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

              <div className="mt-3 flex items-center justify-end gap-3 border-t border-[#20242A] pt-3">
                <button
                  type="button"
                  className="text-sm font-medium text-[#A1A1AA] transition-colors hover:text-[#F4F4F5]"
                  onClick={() => {
                    const today = formatDateValue(new Date());
                    setStartDate(today);
                    setDatePickerMonth(startOfMonth(new Date()));
                    setIsDatePickerOpen(false);
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

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative flex max-h-[calc(100vh-32px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#34363D] bg-[#1C1D22] shadow-[0_28px_90px_rgba(0,0,0,0.52)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-md p-2 text-[#A1A1AA] transition-colors hover:bg-[#25272F] hover:text-[#F4F4F5]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="shrink-0 border-b border-[#34363D] px-7 py-5">
          <h2 className="text-2xl font-bold text-[#F4F4F5]">{workflow ? "ワークフローを編集" : "ワークフロー"}</h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <section className="rounded-xl border border-[#34363D] bg-[#15161A] p-5">
                <div className="mb-4 text-sm font-bold text-[#F4F4F5]">作成するタスク</div>

                <div className="space-y-4">
                  <PickerField label="タスク名">
                    <input
                      autoFocus
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="例: 週次レビューをまとめる"
                      className="w-full rounded-md border border-[#34363D] bg-[#202229] px-3 py-2.5 text-sm text-[#F4F4F5] outline-none transition placeholder:text-[#71717A] focus:border-[#60B964]"
                    />
                  </PickerField>

                  <PickerField label="ワークフロー名">
                    <input
                      value={workflowName}
                      onChange={(event) => setWorkflowName(event.target.value)}
                      placeholder="空ならタスク名を使います"
                      className="w-full rounded-md border border-[#34363D] bg-[#202229] px-3 py-2.5 text-sm text-[#F4F4F5] outline-none transition placeholder:text-[#71717A] focus:border-[#60B964]"
                    />
                  </PickerField>

                  <PickerField label="説明">
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={4}
                      placeholder="追加されたときの初期メモ"
                      className="w-full rounded-md border border-[#34363D] bg-[#202229] px-3 py-2.5 text-sm text-[#F4F4F5] outline-none transition placeholder:text-[#71717A] focus:border-[#60B964]"
                    />
                  </PickerField>

                  <div>
                    <div className="mb-1.5 text-xs font-medium text-[#A1A1AA]">タグ</div>
                    <button
                      ref={tagButtonRef}
                      type="button"
                      onClick={() => {
                        setIsTagMenuOpen((prev) => !prev);
                        setIsFrequencyMenuOpen(false);
                        setIsDatePickerOpen(false);
                      }}
                      className="flex min-h-[46px] w-full items-center justify-between gap-3 rounded-md border border-[#34363D] bg-[#202229] px-3 py-2 text-left transition-colors hover:border-[#52525B] focus:border-[#60B964] focus:outline-none"
                    >
                      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                        {selectedTags.length > 0 ? (
                          selectedTags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex max-w-[150px] items-center rounded-full bg-[#1F3423] px-2.5 py-1 text-xs font-bold text-[#78D27F]"
                            >
                              <span className="truncate">{tag}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-sm font-semibold text-[#71717A]">タグを選択</span>
                        )}
                      </div>
                      <ChevronDown className={clsx("h-4 w-4 shrink-0 text-[#A1A1AA] transition-transform", isTagMenuOpen && "rotate-180")} />
                    </button>
                    {tagMenu}
                  </div>

                  <div>
                    <div className="mb-1.5 text-xs font-medium text-[#A1A1AA]">カードカラー</div>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map((swatch) => (
                        <button
                          key={swatch}
                          type="button"
                          onClick={() => setColor(swatch)}
                          className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-105 ${
                            color === swatch ? "border-[#F4F4F5]" : "border-[#34363D]"
                          }`}
                          style={{ backgroundColor: swatch }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-5">
              <section className="rounded-xl border border-[#34363D] bg-[#15161A] p-5">
                <div className="mb-4 text-sm font-bold text-[#F4F4F5]">スケジュール</div>

                <div className="space-y-4">
                  <PickerField label="頻度">
                    <div className="relative">
                      <button
                        ref={frequencyButtonRef}
                        type="button"
                        onClick={() => setIsFrequencyMenuOpen((prev) => !prev)}
                        className="flex w-full items-center justify-between rounded-md border border-[#34363D] bg-[#202229] px-4 py-3 text-left transition-colors hover:border-[#52525B]"
                      >
                        <span className="text-sm font-semibold text-[#F4F4F5]">
                          {FREQUENCY_OPTIONS.find((option) => option.value === frequency)?.label}
                        </span>
                        <ChevronDown className={clsx("h-4 w-4 text-[#A1A1AA] transition-transform", isFrequencyMenuOpen && "rotate-180")} />
                      </button>

                      {frequencyMenu}
                    </div>
                  </PickerField>

                  <PickerField label="開始日">
                    <button
                      ref={startDateButtonRef}
                      type="button"
                      onClick={() => {
                        setDatePickerMonth(startOfMonth(parseDateValue(startDate) || new Date()));
                        setIsDatePickerOpen((prev) => !prev);
                      }}
                      className="flex w-full items-center gap-3 rounded-md border border-[#34363D] bg-[#202229] px-4 py-3 text-left transition-colors hover:border-[#52525B]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[#F4F4F5]">{formattedStartDate || "日付を選択"}</div>
                        <div className="mt-0.5 text-[11px] font-medium text-[#A1A1AA]">開始日</div>
                      </div>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#34363D] bg-[#15161A] text-[#A1A1AA]">
                        <CalendarDays className="h-4 w-4" />
                      </div>
                    </button>
                  </PickerField>

                  {frequency === "weekly" ? (
                    <div>
                      <div className="mb-1.5 text-xs font-medium text-[#A1A1AA]">曜日</div>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAY_OPTIONS.map((option) => {
                          const selected = weekdays.includes(option.value);
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => toggleWeekday(option.value)}
                              className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                                selected
                                  ? "border-[#60B964] bg-[#60B964] text-white"
                                  : "border-[#34363D] bg-[#202229] text-[#A1A1AA] hover:border-[#52525B] hover:text-[#F4F4F5]"
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {frequency === "monthly" ? (
                    <div>
                      <div className="mb-1.5 text-xs font-medium text-[#A1A1AA]">日付</div>
                      <div className="rounded-2xl border border-[#34363D] bg-[#202229] p-3 shadow-[0_1px_2px_rgba(0,0,0,0.16)]">
                        <div className="mb-3 text-sm font-semibold text-[#F4F4F5]">毎月 {dayOfMonth} 日</div>
                        <div className="grid grid-cols-7 gap-2">
                          {Array.from({ length: 31 }, (_, index) => {
                            const day = index + 1;
                            const selected = dayOfMonth === day;

                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => setDayOfMonth(day)}
                                className={clsx(
                                  "rounded-xl px-0 py-2 text-sm font-medium transition-colors",
                                  selected
                                    ? "bg-[#60B964] text-white shadow-sm"
                                    : "bg-[#15161A] text-[#A1A1AA] hover:bg-[#25272F] hover:text-[#F4F4F5]"
                                )}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <PickerField label="期限">
                    <div className="rounded-2xl border border-[#34363D] bg-[#202229] p-3 shadow-[0_1px_2px_rgba(0,0,0,0.16)]">
                      <div className="mb-3 text-sm font-semibold text-[#F4F4F5]">作成日から {dueOffsetDays} 日後</div>

                      <div className="mb-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDueOffsetDays((prev) => Math.max(0, prev - 1))}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#34363D] bg-[#15161A] text-[#A1A1AA] transition hover:border-[#52525B] hover:text-[#F4F4F5]"
                          title="1日減らす"
                        >
                          <Minus className="h-4 w-4" />
                        </button>

                        <div className="flex-1 rounded-xl border border-[#34363D] bg-[#15161A] px-4 py-2.5 text-center text-sm font-semibold text-[#F4F4F5]">
                          {dueOffsetDays} 日後
                        </div>
                        <button
                          type="button"
                          onClick={() => setDueOffsetDays((prev) => Math.min(365, prev + 1))}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#34363D] bg-[#15161A] text-[#A1A1AA] transition hover:border-[#52525B] hover:text-[#F4F4F5]"
                          title="1日増やす"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {DUE_OFFSET_PRESETS.map((preset) => {
                          const selected = dueOffsetDays === preset;
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setDueOffsetDays(preset)}
                              className={clsx(
                                "rounded-full px-3 py-2 text-sm font-medium transition-colors",
                                selected
                                  ? "bg-[#60B964] text-white shadow-sm"
                                  : "bg-[#15161A] text-[#A1A1AA] hover:bg-[#25272F] hover:text-[#F4F4F5]"
                              )}
                            >
                              {preset === 0 ? "当日" : `${preset}日後`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </PickerField>
                </div>
              </section>

            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end border-t border-[#34363D] px-7 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-[#A1A1AA] transition hover:bg-[#25272F] hover:text-[#F4F4F5]"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() =>
                onSave({
                  id: workflow?.id,
                  name: workflowName.trim() || title.trim(),
                  enabled: workflow?.enabled !== false,
                  generatedRunKeys: workflow?.generatedRunKeys || [],
                  schedule: {
                    frequency,
                    startDate,
                    weekdays,
                    weekday: weekdays[0] ?? 1,
                    dayOfMonth
                  },
                  template: {
                    title: title.trim(),
                    description: description.trim(),
                    tags: selectedTags,
                    color,
                    dueOffsetDays
                  }
                })
              }
              className="rounded-xl bg-[#60B964] px-5 py-2.5 text-sm font-bold text-[#06100D] transition hover:bg-[#54A85C] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {workflow ? "保存" : "作成"}
            </button>
          </div>
        </div>
      </div>

      {datePicker}
    </div>,
    document.body
  );
}




