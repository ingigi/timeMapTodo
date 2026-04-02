import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { attachDragPreview } from "../../utils/dragPreview";

export default function TaskCard({
  task,
  allTasks = [],
  boardState = {},
  isActive,
  isRelated,
  onAdjustTime,
  onDelete,
  onUpdateTitle,
  onAddSubtask,
  onOpenDetail,
  onHoverTask
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
  const progressRatio = totalTime > 0 ? Math.min(1, assignedTime / totalTime) : 0;
  const isCompleted = remainingTime <= 0;

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
        "group relative mb-6 select-none rounded-2xl border p-4 shadow-sm transition-all",
        isCompleted ? "bg-slate-50/90" : "bg-white",
        isDragging && "scale-[0.98] opacity-50",
        isRelated
          ? "border-blue-400 shadow-[0_12px_32px_rgba(37,99,235,0.16)] ring-2 ring-blue-100"
          : isActive
            ? "border-blue-300 shadow-[0_10px_26px_rgba(15,23,42,0.08)]"
            : "border-slate-200 hover:border-slate-300 hover:shadow-md"
      )}
      onMouseEnter={() => onHoverTask(id)}
      onMouseLeave={() => onHoverTask(null)}
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
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span
              className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.16em] text-white"
              style={{ backgroundColor: color || "#94a3b8" }}
            >
              STOCK
            </span>
            {assignedTime > 0 && (
              <span className="text-[10px] font-semibold tracking-[0.12em] text-blue-600">
                CALENDAR LINKED
              </span>
            )}
          </div>

          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={title}
              onChange={(e) => onUpdateTitle(id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onDragStart={(e) => e.stopPropagation()}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="タスク名を入力"
              className="w-full border-none bg-transparent text-xl font-black leading-tight text-slate-900 outline-none placeholder:text-slate-300"
            />
          ) : (
            <h3 className={clsx("text-xl font-black leading-tight text-slate-900", isCompleted && "text-slate-400 line-through")}>
              {title}
            </h3>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(id);
          }}
          className="shrink-0 rounded-xl border border-slate-100 bg-white p-2 text-slate-400 shadow-sm opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
          title="削除"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">次に切り出す</div>
            <div className="mt-1 text-base font-semibold text-slate-700">1.0h をカレンダーへ配置</div>
          </div>
          <div
            className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-sm"
            style={{ backgroundColor: color || "#94a3b8" }}
          >
            Drag
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">未割当</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-4xl font-black leading-none text-slate-900">{remainingTime.toFixed(1)}</span>
              <span className="text-xl font-black leading-none text-slate-400">h</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">割当済み</div>
            <div className="mt-1 text-lg font-black text-slate-700">{assignedTime.toFixed(1)}h</div>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progressRatio * 100}%`, backgroundColor: color || "#94a3b8" }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center rounded-xl border border-slate-100 bg-slate-50 p-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdjustTime(id, -1);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-red-500"
            title="1時間減らす"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdjustTime(id, 1);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-blue-500"
            title="1時間増やす"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddSubtask(id);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm font-semibold text-slate-500 shadow-sm transition-colors hover:bg-blue-50 hover:text-blue-600"
          title="子タスクを追加"
        >
          <Plus className="h-4 w-4" />
          分割
        </button>
      </div>
    </div>
  );
}
