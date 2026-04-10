import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Check, Filter, Pencil, Plus, X } from "lucide-react";
import WeeklyBoard from "../WeeklyBoard/WeeklyBoard";
import MonthlyBoard from "../MonthlyBoard/MonthlyBoard";
import { addMonths, addWeeks, formatMonthLabel, startOfWeek, subMonths, subWeeks } from "../../utils/dateUtils";

const STATUS_OPTIONS = [
  { value: "notstarted", label: "未着手" },
  { value: "inprogress", label: "進行中" },
  { value: "completed", label: "完了" }
];

export default function CalendarArea({
  baseDate,
  viewType,
  setBaseDate,
  setViewType,
  boardState,
  tasks,
  hoveredTaskId,
  hoveredTaskDeadline,
  boardFilterConfig,
  setBoardFilterConfig,
  availableTags = [],
  onCreateTag,
  onDeleteTag,
  onRenameTag,
  onAddAssignmentFromSidebar,
  onDeleteAssignment,
  onMoveAssignment,
  onToggleAssignmentComplete,
  onHoverTask,
  onOpenDetail
}) {
  const hoveredTask = tasks.find((task) => task.id === hoveredTaskId) || null;
  const [visibleMonthLabel, setVisibleMonthLabel] = useState(() => formatMonthLabel(baseDate));
  const boardFilterRef = useRef(null);
  const boardTagInputRef = useRef(null);
  const editBoardTagInputRef = useRef(null);
  const [isBoardFilterOpen, setIsBoardFilterOpen] = useState(false);
  const [isCreatingBoardTag, setIsCreatingBoardTag] = useState(false);
  const [boardTagDraft, setBoardTagDraft] = useState("");
  const [editingBoardTagName, setEditingBoardTagName] = useState("");
  const [editingBoardTagDraft, setEditingBoardTagDraft] = useState("");
  const [boardFilterPlacement, setBoardFilterPlacement] = useState({
    top: 0,
    right: 0,
    maxHeight: 360
  });

  const updateBoardFilterPlacement = () => {
    if (!boardFilterRef.current) return;

    const rect = boardFilterRef.current.getBoundingClientRect();
    const popupHeight = 360;
    const gap = 8;
    const viewportPadding = 12;
    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
    const spaceAbove = rect.top - gap - viewportPadding;
    const openUp = spaceBelow < popupHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.min(popupHeight, Math.max(openUp ? spaceAbove : spaceBelow, 200));
    const top = openUp
      ? Math.max(viewportPadding, rect.top - gap - maxHeight)
      : Math.min(window.innerHeight - viewportPadding - maxHeight, rect.bottom + gap);
    const right = Math.max(viewportPadding, window.innerWidth - rect.right);

    setBoardFilterPlacement({ top, right, maxHeight });
  };

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (isBoardFilterOpen && boardFilterRef.current && !boardFilterRef.current.contains(event.target)) {
        setIsBoardFilterOpen(false);
        setIsCreatingBoardTag(false);
        setBoardTagDraft("");
        setEditingBoardTagName("");
        setEditingBoardTagDraft("");
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isBoardFilterOpen]);

  useLayoutEffect(() => {
    if (!isBoardFilterOpen) return;

    updateBoardFilterPlacement();
  }, [isBoardFilterOpen, boardFilterConfig.statuses.length, boardFilterConfig.tags.length]);

  useEffect(() => {
    if (!isBoardFilterOpen) return;

    const handleReposition = () => updateBoardFilterPlacement();

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isBoardFilterOpen]);

  useEffect(() => {
    if (isCreatingBoardTag && boardTagInputRef.current) {
      boardTagInputRef.current.focus();
    }
  }, [isCreatingBoardTag]);

  useEffect(() => {
    if (editingBoardTagName && editBoardTagInputRef.current) {
      editBoardTagInputRef.current.focus();
      editBoardTagInputRef.current.select();
    }
  }, [editingBoardTagName]);

  const handlePrev = () => {
    setBaseDate((prev) => {
      const next = viewType === "week" ? subWeeks(prev, 1) : subMonths(prev, 1);
      setVisibleMonthLabel(formatMonthLabel(next));
      return next;
    });
  };

  const handleNext = () => {
    setBaseDate((prev) => {
      const next = viewType === "week" ? addWeeks(prev, 1) : addMonths(prev, 1);
      setVisibleMonthLabel(formatMonthLabel(next));
      return next;
    });
  };

  const handleToday = () => {
    const next = new Date();
    setBaseDate(next);
    setVisibleMonthLabel(formatMonthLabel(next));
  };

  const toggleBoardStatusFilter = (status) => {
    setBoardFilterConfig((prev) => {
      const currentStatuses = prev.statuses || [];
      const nextStatuses = currentStatuses.includes(status)
        ? currentStatuses.filter((item) => item !== status)
        : [...currentStatuses, status];

      return { ...prev, statuses: nextStatuses };
    });
  };

  const toggleBoardTagFilter = (tag) => {
    setBoardFilterConfig((prev) => {
      const currentTags = prev.tags || [];
      const nextTags = currentTags.includes(tag) ? currentTags.filter((item) => item !== tag) : [...currentTags, tag];

      return { ...prev, tags: nextTags };
    });
  };

  const clearBoardFilters = () => {
    setBoardFilterConfig({ statuses: [], tags: [] });
  };

  const commitBoardTag = () => {
    const trimmed = boardTagDraft.trim();
    if (!trimmed) {
      setIsCreatingBoardTag(false);
      setBoardTagDraft("");
      return;
    }

    onCreateTag?.(trimmed);
    setIsCreatingBoardTag(false);
    setBoardTagDraft("");
  };

  const handleDeleteBoardTag = (tag) => {
    onDeleteTag?.(tag);
    setBoardFilterConfig((prev) => ({
      ...prev,
      tags: (prev.tags || []).filter((item) => item !== tag)
    }));
  };

  const startEditBoardTag = (tag) => {
    setEditingBoardTagName(tag);
    setEditingBoardTagDraft(tag);
    setIsCreatingBoardTag(false);
  };

  const commitBoardTagEdit = () => {
    const nextTagName = editingBoardTagDraft.trim();
    if (!editingBoardTagName || !nextTagName) {
      setEditingBoardTagName("");
      setEditingBoardTagDraft("");
      return;
    }

    onRenameTag?.(editingBoardTagName, nextTagName);
    setEditingBoardTagName("");
    setEditingBoardTagDraft("");
  };

  const formattedDateRange = () => {
    if (viewType === "month") {
      return `${baseDate.getFullYear()} / ${baseDate.getMonth() + 1}`;
    }

    const start = startOfWeek(baseDate);
    const end = addWeeks(start, 1);
    end.setDate(end.getDate() - 1);
    return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()} を中心に表示`;
  };

  return (
    <div className="relative flex h-full flex-col">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setViewType("week")}
              className={`rounded-lg px-3 py-1 text-sm font-semibold ${viewType === "week" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              週
            </button>
            <button
              onClick={() => setViewType("month")}
              className={`rounded-lg px-3 py-1 text-sm font-semibold ${viewType === "month" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              月
            </button>
          </div>

          <button
            onClick={handleToday}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            今日
          </button>

          <div className="flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
            <button onClick={handlePrev} className="p-1 hover:text-blue-600">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="mx-2 cursor-pointer hover:text-blue-600" onClick={handleToday}>
              {formattedDateRange()}
            </span>
            <button onClick={handleNext} className="p-1 hover:text-blue-600">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" ref={boardFilterRef}>
            <button
              type="button"
              onClick={() => setIsBoardFilterOpen((prev) => !prev)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50"
              title="絞り込み"
            >
              <Filter className="h-4 w-4" />
            </button>

            {isBoardFilterOpen && (
              <div
                className="fixed z-30 w-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
                style={{
                  top: `${boardFilterPlacement.top}px`,
                  right: `${boardFilterPlacement.right}px`,
                  maxHeight: `${boardFilterPlacement.maxHeight}px`
                }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">状態</div>
                  {!!(boardFilterConfig.statuses || []).length && (
                    <button
                      type="button"
                      onClick={() => setBoardFilterConfig((prev) => ({ ...prev, statuses: [] }))}
                      className="text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-700"
                    >
                      クリア
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  {STATUS_OPTIONS.map((status) => {
                    const selected = (boardFilterConfig.statuses || []).includes(status.value);

                    return (
                      <button
                        key={status.value}
                        type="button"
                        onClick={() => toggleBoardStatusFilter(status.value)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                          selected ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span>{status.label}</span>
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                            selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-transparent"
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="my-3 border-t border-slate-100" />

                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">タグ</div>
                  {!!(boardFilterConfig.tags || []).length && (
                    <button
                      type="button"
                      onClick={() => setBoardFilterConfig((prev) => ({ ...prev, tags: [] }))}
                      className="text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-700"
                    >
                      クリア
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  {availableTags.length > 0 ? (
                    availableTags.map((tag) => {
                      const selected = (boardFilterConfig.tags || []).includes(tag);
                      const isEditing = editingBoardTagName === tag;

                      if (isEditing) {
                        return (
                          <div
                            key={tag}
                            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2"
                          >
                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
                                selected ? "border-slate-900 bg-slate-900" : "border-slate-300 bg-white"
                              }`}
                            />
                            <input
                              ref={editBoardTagInputRef}
                              value={editingBoardTagDraft}
                              onChange={(event) => setEditingBoardTagDraft(event.target.value)}
                              onBlur={commitBoardTagEdit}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  commitBoardTagEdit();
                                }
                                if (event.key === "Escape") {
                                  setEditingBoardTagName("");
                                  setEditingBoardTagDraft("");
                                }
                              }}
                              className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                            />
                          </div>
                        );
                      }

                      return (
                        <div
                          key={tag}
                          className={`group flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                            selected ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleBoardTagFilter(tag)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
                                selected ? "border-slate-900 bg-slate-900" : "border-slate-300 bg-white"
                              }`}
                            />
                            <span className="truncate">{tag}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => startEditBoardTag(tag)}
                            className="rounded-lg p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100"
                            title="タグを編集"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteBoardTag(tag);
                            }}
                            className="rounded-lg p-1 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                            title="タグを削除"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">まだタグはありません</div>
                  )}

                  {isCreatingBoardTag && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-300 bg-white" />
                      <input
                        ref={boardTagInputRef}
                        value={boardTagDraft}
                        onChange={(event) => setBoardTagDraft(event.target.value)}
                        onBlur={commitBoardTag}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitBoardTag();
                          }
                          if (event.key === "Escape") {
                            setIsCreatingBoardTag(false);
                            setBoardTagDraft("");
                          }
                        }}
                        className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                        placeholder="新しいタグ"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsCreatingBoardTag(true)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900"
                  >
                    <Plus className="h-4 w-4" />
                    タグを追加
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={clearBoardFilters}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                  >
                    <X className="h-4 w-4" />
                    すべてクリア
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 text-sm font-semibold text-slate-400">
            {visibleMonthLabel}
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {viewType === "week" ? (
        <WeeklyBoard
          baseDate={baseDate}
          boardState={boardState}
          tasks={tasks}
          hoveredTaskId={hoveredTaskId}
          hoveredTaskDeadline={hoveredTaskDeadline || hoveredTask?.deadline || null}
          onVisibleMonthChange={setVisibleMonthLabel}
          boardFilterConfig={boardFilterConfig}
          setBoardFilterConfig={setBoardFilterConfig}
          availableTags={availableTags}
          onAddAssignmentFromSidebar={onAddAssignmentFromSidebar}
          onDeleteAssignment={onDeleteAssignment}
          onMoveAssignment={onMoveAssignment}
          onToggleAssignmentComplete={onToggleAssignmentComplete}
          onHoverTask={onHoverTask}
          onOpenDetail={onOpenDetail}
          />
        ) : (
        <MonthlyBoard
          baseDate={baseDate}
          boardState={boardState}
          tasks={tasks}
          hoveredTaskId={hoveredTaskId}
          hoveredTaskDeadline={hoveredTaskDeadline || hoveredTask?.deadline || null}
          onVisibleMonthChange={setVisibleMonthLabel}
          boardFilterConfig={boardFilterConfig}
          setBoardFilterConfig={setBoardFilterConfig}
          availableTags={availableTags}
          onAddAssignmentFromSidebar={onAddAssignmentFromSidebar}
          onDeleteAssignment={onDeleteAssignment}
          onMoveAssignment={onMoveAssignment}
          onToggleAssignmentComplete={onToggleAssignmentComplete}
          onHoverTask={onHoverTask}
          onOpenDetail={onOpenDetail}
          />
        )}
      </div>
    </div>
  );
}



