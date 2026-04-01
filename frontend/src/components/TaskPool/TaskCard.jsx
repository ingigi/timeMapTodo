import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Plus, Minus, Trash2 } from "lucide-react";
import { attachDragPreview } from "../../utils/dragPreview";

export default function TaskCard({
  task,
  allTasks = [],
  boardState = {},
  isActive,
  onSelect,
  onAdjustTime,
  onDelete,
  onToggleExpand,
  onUpdateTitle,
  onAddSubtask,
  onOpenDetail,
  onAddAssignment,
  hasChildren,
  isExpanded,
  level = 0
}) {
  const { id, title, totalTime, color } = task;
  const titleInputRef = useRef(null);
  const dragCleanupRef = useRef(null);
  const [isEditingTitle, setIsEditingTitle] = useState(() => !title?.trim());
  const [isDragging, setIsDragging] = useState(false);

  let assignedTime = 0;
  if (boardState && allTasks.length > 0) {
    const descendants = new Set();
    const collect = (nodeId) => {
      descendants.add(nodeId);
      allTasks.filter((item) => item.parentId === nodeId).forEach((child) => collect(child.id));
    };
    collect(id);

    Object.values(boardState).flat().forEach((assignment) => {
      if (descendants.has(assignment.taskId)) {
        assignedTime += assignment.duration;
      }
    });
  }

  const remainingTime = Math.max(0, totalTime - assignedTime);
  const currentRemaining = task.remainingTime !== undefined ? task.remainingTime : remainingTime;
  const isCompleted = currentRemaining <= 0;

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (!title?.trim()) {
      setIsEditingTitle(true);
    }
  }, [title]);

  return (
    <div
      className={clsx(
        "group relative mb-6 select-none rounded-xl border-2 p-4 shadow-sm transition-all hover:shadow-md",
        isActive ? "border-blue-500" : "border-black/5 hover:border-black/10",
        isCompleted ? "bg-slate-50 opacity-70 grayscale-[0.5]" : "bg-white",
        isDragging && "scale-[0.98] opacity-55"
      )}
      onClick={() => onOpenDetail(id)}
      draggable={!isEditingTitle}
      onDragStart={(e) => {
        if (isEditingTitle) {
          e.preventDefault();
          return;
        }

        setIsDragging(true);
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("taskId", id);
        e.dataTransfer.setData("dragType", "new");
        e.dataTransfer.setData("dragDuration", "1");
        e.dataTransfer.setData("dragTitle", title || "タスク");
        e.dataTransfer.setData("dragColor", color || "#94a3b8");
        dragCleanupRef.current = attachDragPreview(e, {
          title: title || "タスク",
          duration: 1,
          color: color || "#94a3b8"
        });
      }}
      onDragEnd={() => {
        setIsDragging(false);
        dragCleanupRef.current?.();
        dragCleanupRef.current = null;
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            value={title}
            onChange={(e) => onUpdateTitle(id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => e.stopPropagation()}
            onBlur={() => setIsEditingTitle(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            placeholder="タスク名を入力"
            className="flex-1 border-none bg-transparent text-lg font-black leading-tight text-slate-800 outline-none placeholder:text-slate-300"
          />
        ) : (
          <h3
            className={clsx(
              "flex-1 line-clamp-2 text-lg font-black leading-tight transition-colors",
              isCompleted ? "text-slate-400 line-through" : "text-slate-800 group-hover:text-blue-600"
            )}
          >
            {title}
          </h3>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(id);
          }}
          className="shrink-0 rounded-lg border border-slate-100 bg-white p-1.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
          title="削除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mb-3 rounded-xl border border-dashed border-slate-100 bg-slate-50/70 px-3 py-2">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">次に切り出す</div>
        <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
          <span>1.0h を配置</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500 shadow-sm">Drag</span>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex items-end justify-between">
          <div className="flex flex-col">
            <span className="mb-1 text-[10px] font-bold uppercase tracking-widest leading-none text-slate-400">残り</span>
            <div className="flex items-baseline gap-1">
              <span className={clsx("text-3xl font-black leading-none transition-all", isCompleted ? "text-slate-400" : "text-slate-900")}>
                {currentRemaining.toFixed(1)}
              </span>
              <span className="text-lg font-black leading-none text-slate-400 lowercase">h</span>
            </div>
            <div className="mt-1 text-[11px] font-medium text-slate-400">割当済み {assignedTime.toFixed(1)}h</div>
          </div>

          <div className="flex items-center rounded-lg border border-slate-100 bg-slate-50 p-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdjustTime(id, -1);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-all hover:bg-white hover:text-red-500 hover:shadow-sm"
            >
              <Minus className="h-4 w-4" />
            </button>
            <div className="mx-1 h-4 w-px bg-slate-200" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdjustTime(id, 1);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-all hover:bg-white hover:text-blue-500 hover:shadow-sm"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onAddSubtask(id);
        }}
        className="absolute -bottom-4 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border-2 border-slate-100 bg-white text-slate-400 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
        title="子タスクを追加"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
