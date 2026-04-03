import { Check, Filter, Plus, SortAsc, SortDesc } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import TaskListItem from "./TaskListItem";

const STATUS_OPTIONS = [
  { value: "notstarted", label: "未着手" },
  { value: "inprogress", label: "進行中" },
  { value: "completed", label: "完了" }
];

const SORT_OPTIONS = [
  { key: "deadline", label: "期限" },
  { key: "scheduledCount", label: "配置数" },
  { key: "title", label: "タイトル" },
  { key: "status", label: "ステータス" }
];

export default function TaskPool({
  tasks,
  selectedTaskId,
  hoveredTaskId,
  onCreateInlineTask,
  onDeleteTask,
  onUpdateTaskTitle,
  onOpenDetail,
  onHoverTask,
  filterConfig,
  setFilterConfig,
  sortConfig,
  setSortConfig,
  availableTags = []
}) {
  const filterRef = useRef(null);
  const sortRef = useRef(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);

  const toggleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc"
    }));
  };

  const toggleStatusFilter = (status) => {
    setFilterConfig((prev) => {
      const currentStatuses = prev.statuses || [];
      const nextStatuses = currentStatuses.includes(status)
        ? currentStatuses.filter((item) => item !== status)
        : [...currentStatuses, status];

      return { ...prev, statuses: nextStatuses };
    });
  };

  const toggleTagFilter = (tag) => {
    setFilterConfig((prev) => {
      const currentTags = prev.tags || [];
      const nextTags = currentTags.includes(tag) ? currentTags.filter((item) => item !== tag) : [...currentTags, tag];

      return { ...prev, tags: nextTags };
    });
  };

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (isFilterOpen && filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
      if (isSortOpen && sortRef.current && !sortRef.current.contains(event.target)) {
        setIsSortOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isFilterOpen, isSortOpen]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900">タスク</h2>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{tasks.length}件</span>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => onCreateInlineTask(null)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          新しいタスク
        </button>

        <div className="flex gap-1">
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => {
                setIsFilterOpen((prev) => !prev);
                setIsSortOpen(false);
              }}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50"
              title="フィルタ"
            >
              <Filter className="h-4 w-4" />
            </button>
            {isFilterOpen && (
              <div className="absolute right-0 top-10 z-20 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Status</div>
                  {!!(filterConfig.statuses || []).length && (
                    <button
                      onClick={() => setFilterConfig((prev) => ({ ...prev, statuses: [] }))}
                      className="text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-700"
                    >
                      クリア
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {STATUS_OPTIONS.map((status) => {
                    const selected = (filterConfig.statuses || []).includes(status.value);

                    return (
                      <button
                        key={status.value}
                        onClick={() => toggleStatusFilter(status.value)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                          selected ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span>{status.label}</span>
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-transparent"}`}>
                          <Check className="h-3 w-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="my-3 border-t border-slate-100" />

                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Tags</div>
                  {!!(filterConfig.tags || []).length && (
                    <button
                      onClick={() => setFilterConfig((prev) => ({ ...prev, tags: [] }))}
                      className="text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-700"
                    >
                      クリア
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {availableTags.map((tag) => {
                    const selected = (filterConfig.tags || []).includes(tag);

                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTagFilter(tag)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                          selected ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span>{tag}</span>
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-transparent"}`}>
                          <Check className="h-3 w-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={sortRef}>
            <button
              onClick={() => {
                setIsSortOpen((prev) => !prev);
                setIsFilterOpen(false);
              }}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50"
              title="並び替え"
            >
              {sortConfig.order === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            </button>
            {isSortOpen && (
              <div className="absolute right-0 top-10 z-20 w-40 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Sort</div>
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => {
                      toggleSort(option.key);
                      setIsSortOpen(false);
                    }}
                    className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      sortConfig.key === option.key ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-y-auto pr-1">
        {tasks.map((task) => (
          <TaskListItem
            key={task.id}
            task={task}
            isActive={selectedTaskId === task.id}
            isRelated={hoveredTaskId === task.id}
            onDelete={onDeleteTask}
            onUpdateTitle={onUpdateTaskTitle}
            onOpenDetail={onOpenDetail}
            onHoverTask={onHoverTask}
          />
        ))}
      </div>
    </div>
  );
}
