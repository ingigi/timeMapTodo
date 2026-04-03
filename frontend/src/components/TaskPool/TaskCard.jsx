import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { attachDragPreview } from "../../utils/dragPreview";
import { getTaskPalette } from "../../utils/taskColors";

const STATUS_LABELS = {
  NotStarted: "未着手",
  InProgress: "進行中",
  Completed: "完了"
};

const STATUS_STYLES = {
  NotStarted: "bg-slate-100 text-slate-600",
  InProgress: "bg-amber-50 text-amber-700",
  Completed: "bg-emerald-50 text-emerald-700"
};

export default function TaskCard({ task, isActive, isRelated, onDelete, onUpdateTitle, onOpenDetail, onHoverTask }) {
  const { id, title, color, status = "NotStarted", deadline } = task;
  const titleInputRef = useRef(null);
  const dragCleanupRef = useRef(null);
  const [isEditingTitle, setIsEditingTitle] = useState(() => !title?.trim());
  const [isDragging, setIsDragging] = useState(false);
  const palette = getTaskPalette(color);

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
        "group mb-3 select-none rounded-2xl border bg-white p-4 transition-all",
        isDragging && "scale-[0.99] opacity-60",
        !isRelated && !isActive && "border-slate-200 hover:border-slate-300 hover:shadow-sm"
      )}
      onMouseEnter={() => onHoverTask(id)}
      onMouseLeave={() => onHoverTask(null)}
      onClick={() => onOpenDetail(id)}
      style={
        isRelated
          ? {
              borderColor: palette.borderStrong,
              backgroundColor: palette.surfaceStrong,
              boxShadow: `0 10px 26px ${palette.shadow}`
            }
          : isActive
            ? { borderColor: palette.border, boxShadow: `0 8px 20px ${palette.shadow}` }
            : undefined
      }
      draggable={!isEditingTitle}
      onDragStart={(event) => {
        if (isEditingTitle) {
          event.preventDefault();
          return;
        }

        setIsDragging(true);
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("taskId", id);
        event.dataTransfer.setData("dragType", "new");
        event.dataTransfer.setData("dragTitle", title || "Task");
        event.dataTransfer.setData("dragColor", color || "#94a3b8");
        dragCleanupRef.current = attachDragPreview(event, {
          title: title || "Task",
          color: color || "#94a3b8"
        });
      }}
      onDragEnd={() => {
        setIsDragging(false);
        dragCleanupRef.current?.();
        dragCleanupRef.current = null;
      }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex items-center" style={{ color: palette.borderStrong }}>
          <GripVertical className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLES[status])}>{STATUS_LABELS[status]}</span>
            {deadline ? <span className="text-[12px] text-slate-400">期限 {deadline}</span> : null}
          </div>

          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={title}
              onChange={(event) => onUpdateTitle(id, event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onDragStart={(event) => event.stopPropagation()}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              placeholder="タスク名を入力"
              className="w-full select-text border-none bg-transparent text-[22px] font-semibold leading-snug text-slate-900 outline-none placeholder:text-slate-300"
            />
          ) : (
            <h3 className="break-words text-[22px] font-semibold leading-snug text-slate-900">{title}</h3>
          )}
        </div>

        <button
          onClick={(event) => {
            event.stopPropagation();
            onDelete(id);
          }}
          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          title="削除"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 h-1 rounded-full" style={{ backgroundColor: color || "#94a3b8" }} />
    </div>
  );
}
