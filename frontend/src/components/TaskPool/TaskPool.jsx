import { Check, Filter, Pause, Pencil, Play, Plus, Repeat, SortAsc, SortDesc, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import TaskListItem from "./TaskListItem";
import TaskWorkflowModal from "./TaskWorkflowModal";
import { getCurrentDrag } from "../../utils/dragState";
import {
  describeWorkflowDeadline,
  describeWorkflowSchedule,
  formatDateKey,
  getNextWorkflowRunDate
} from "../../utils/workflows";

const STATUS_OPTIONS = [
  { value: "notstarted", label: "未着手" },
  { value: "inprogress", label: "進行中" },
  { value: "completed", label: "完了" }
];

const SORT_OPTIONS = [
  { key: "deadline", label: "期限" },
  { key: "scheduledCount", label: "配置数" },
  { key: "title", label: "タイトル" },
  { key: "status", label: "状態" }
];

const readDragPayload = (event) => {
  const rawText = event.dataTransfer.getData("text/plain");
  if (rawText) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // Ignore invalid payloads.
    }
  }

  return getCurrentDrag();
};

const formatNextRunLabel = (workflow) => {
  const nextRunDate = getNextWorkflowRunDate(workflow, new Date());
  if (!nextRunDate) return "次回未定";

  const todayKey = formatDateKey(new Date());
  if (nextRunDate === todayKey) return "今日";
  return nextRunDate;
};

export default function TaskPool({
  tasks,
  workflows = [],
  selectedTaskId,
  hoveredTaskId,
  editingTaskId,
  onCreateInlineTask,
  onCreateWorkflow,
  onToggleWorkflowEnabled,
  onDeleteWorkflow,
  onDeleteTask,
  onUpdateTaskTitle,
  onOpenDetail,
  onHoverTask,
  onUnscheduleTask,
  filterConfig,
  setFilterConfig,
  sortConfig,
  setSortConfig,
  availableTags = [],
  onCreateTag,
  onDeleteTag,
  onRenameTag
}) {
  const filterRef = useRef(null);
  const sortRef = useRef(null);
  const newTagInputRef = useRef(null);
  const editTagInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("tasks");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagDraft, setNewTagDraft] = useState("");
  const [editingTagName, setEditingTagName] = useState("");
  const [editingTagDraft, setEditingTagDraft] = useState("");
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);

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

  const commitNewTag = () => {
    const trimmed = newTagDraft.trim();
    if (!trimmed) {
      setIsCreatingTag(false);
      setNewTagDraft("");
      return;
    }

    onCreateTag?.(trimmed);
    setIsCreatingTag(false);
    setNewTagDraft("");
  };

  const handleDeleteTag = (tag) => {
    onDeleteTag?.(tag);
    setFilterConfig((prev) => ({
      ...prev,
      tags: (prev.tags || []).filter((item) => item !== tag)
    }));
  };

  const startEditTag = (tag) => {
    setEditingTagName(tag);
    setEditingTagDraft(tag);
    setIsCreatingTag(false);
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
    const handlePointerDown = (event) => {
      if (isFilterOpen && filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterOpen(false);
        setIsCreatingTag(false);
        setNewTagDraft("");
        setEditingTagName("");
        setEditingTagDraft("");
      }
      if (isSortOpen && sortRef.current && !sortRef.current.contains(event.target)) {
        setIsSortOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isFilterOpen, isSortOpen]);

  useEffect(() => {
    if (isCreatingTag && newTagInputRef.current) {
      newTagInputRef.current.focus();
    }
  }, [isCreatingTag]);

  useEffect(() => {
    if (editingTagName && editTagInputRef.current) {
      editTagInputRef.current.focus();
      editTagInputRef.current.select();
    }
  }, [editingTagName]);

  const showTaskFilters = activeTab === "tasks";

  return (
    <>
      <div
        className={`flex h-full flex-col rounded-2xl transition-all ${
          isDropTarget ? "bg-slate-50 ring-2 ring-slate-400 ring-inset shadow-[inset_0_0_0_1px_rgba(148,163,184,0.25)]" : ""
        }`}
        onDragOver={(event) => {
          const payload = readDragPayload(event);
          if (!payload?.taskId || !payload?.sourceDateKey) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setIsDropTarget(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsDropTarget(false);
          }
        }}
        onDrop={(event) => {
          const payload = readDragPayload(event);
          if (!payload?.taskId || !payload?.sourceDateKey) return;
          event.preventDefault();
          setIsDropTarget(false);
          onUnscheduleTask(payload.taskId);
        }}
      >
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("tasks")}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "tasks" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            タスク
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("workflows")}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "workflows" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            ワークフロー
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => (activeTab === "tasks" ? onCreateInlineTask() : setIsWorkflowModalOpen(true))}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            {activeTab === "tasks" ? <Plus className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            {activeTab === "tasks" ? "新規タスク" : "ワークフロー追加"}
          </button>

          {showTaskFilters ? (
            <div className="flex gap-1">
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => {
                    setIsFilterOpen((prev) => !prev);
                    setIsSortOpen(false);
                  }}
                  className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50"
                  title="絞り込み"
                >
                  <Filter className="h-4 w-4" />
                </button>

                {isFilterOpen && (
                  <div className="absolute left-0 top-10 z-20 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
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
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Tag</div>
                      {!!(filterConfig.tags || []).length && (
                        <button
                          onClick={() => setFilterConfig((prev) => ({ ...prev, tags: [] }))}
                          className="text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-700"
                        >
                          クリア
                        </button>
                      )}
                    </div>

                    <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                      {availableTags.length > 0 ? (
                        availableTags.map((tag) => {
                          const selected = (filterConfig.tags || []).includes(tag);
                          const isEditing = editingTagName === tag;

                          if (isEditing) {
                            return (
                              <div key={tag} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                                <span
                                  className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
                                    selected ? "border-slate-900 bg-slate-900" : "border-slate-300 bg-white"
                                  }`}
                                />
                                <input
                                  ref={editTagInputRef}
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
                              <button type="button" onClick={() => toggleTagFilter(tag)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                                <span
                                  className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
                                    selected ? "border-slate-900 bg-slate-900" : "border-slate-300 bg-white"
                                  }`}
                                />
                                <span className="truncate">{tag}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => startEditTag(tag)}
                                className="rounded-lg p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100"
                                title="タグ名を変更"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDeleteTag(tag);
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

                      {isCreatingTag && (
                        <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-300 bg-white" />
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
                              if (event.key === "Escape") {
                                setIsCreatingTag(false);
                                setNewTagDraft("");
                              }
                            }}
                            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                            placeholder="新しいタグ"
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsCreatingTag(true)}
                        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900"
                      >
                        <Plus className="h-4 w-4" />
                        タグを追加
                      </button>
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
                  <div className="absolute left-0 top-10 z-20 w-40 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
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
          ) : null}
        </div>

        {activeTab === "tasks" ? (
          <>
            <div
              className={`mb-4 rounded-2xl border px-4 py-3 transition-colors ${
                isDropTarget ? "border-slate-400 bg-white text-slate-900" : "border-slate-200 bg-slate-50/80 text-slate-600"
              }`}
            >
              <div className="text-sm font-medium">{isDropTarget ? "ここにドロップして未配置に戻す" : "ここからドラッグしてカレンダーに配置"}</div>
            </div>

            <div className="overflow-y-auto pr-1">
              {tasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center">
                  <div className="text-sm font-medium text-slate-700">未配置タスクはありません</div>
                </div>
              ) : (
                tasks.map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    isActive={selectedTaskId === task.id}
                    isRelated={hoveredTaskId === task.id}
                    suppressInlineTitleAutoEdit={editingTaskId === task.id}
                    onDelete={onDeleteTask}
                    onUpdateTaskTitle={onUpdateTaskTitle}
                    onOpenDetail={onOpenDetail}
                    onHoverTask={onHoverTask}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <div className="overflow-y-auto pr-1">
            {workflows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center">
                <div className="text-sm font-medium text-slate-700">ワークフローはありません</div>
              </div>
            ) : (
              <div className="space-y-2">
                {workflows.map((workflow) => (
                  <div key={workflow.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-slate-900">{workflow.name}</div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              workflow.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {workflow.enabled ? "有効" : "停止中"}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{workflow.template.title || "無題タスク"}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                          <span className="rounded-full bg-white px-2 py-1">{describeWorkflowSchedule(workflow)}</span>
                          <span className="rounded-full bg-white px-2 py-1">{describeWorkflowDeadline(workflow)}</span>
                          <span className="rounded-full bg-white px-2 py-1">{formatNextRunLabel(workflow)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onToggleWorkflowEnabled?.(workflow.id)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          title={workflow.enabled ? "停止" : "再開"}
                        >
                          {workflow.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteWorkflow?.(workflow.id)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          title="削除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {isWorkflowModalOpen ? (
        <TaskWorkflowModal
          availableTags={availableTags}
          onClose={() => setIsWorkflowModalOpen(false)}
          onSave={(workflowDraft) => {
            onCreateWorkflow?.(workflowDraft);
            setIsWorkflowModalOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
