import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
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

export default function TaskListItem({ task, isActive, isRelated, onDelete, onUpdateTitle, onOpenDetail, onHoverTask }) {
  const { id, title, color, status = "NotStarted", deadline } = task;
  const titleInputRef = useRef(null);
  const [isEditingTitle, setIsEditingTitle] = useState(() => !title?.trim());
  const palette = getTaskPalette(color);
  const isCompleted = status === "Completed";

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
        "group mb-2 flex select-none items-center gap-3 rounded-xl border px-3 py-3 transition-all",
        !isRelated && !isActive && "border-slate-200 hover:border-slate-300 hover:shadow-sm",
        isCompleted && "opacity-75"
      )}
      onMouseEnter={() => onHoverTask(id)}
      onMouseLeave={() => onHoverTask(null)}
      onClick={() => onOpenDetail(id)}
      style={{
        ...(isRelated
          ? {
              borderColor: palette.borderStrong,
              backgroundColor: palette.surfaceStrong,
              boxShadow: `0 8px 20px ${palette.shadow}`
            }
          : isActive
            ? { borderColor: palette.border, boxShadow: `0 8px 18px ${palette.shadow}` }
          : isCompleted
              ? { borderColor: palette.completedBorder, backgroundColor: palette.completedSurface }
              : { backgroundColor: "white" }),
        backgroundColor: isCompleted ? palette.completedSurface : "white"
      }}
      draggable={!isEditingTitle}
      onDragStart={(event) => {
        if (isEditingTitle) {
          event.preventDefault();
          return;
        }

        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("taskId", id);
        event.dataTransfer.setData("dragType", "new");
        event.dataTransfer.setData("dragTitle", title || "Task");
        event.dataTransfer.setData("dragColor", color || "#94a3b8");
        event.dataTransfer.setData("dragDeadline", deadline || "");
      }}
      onDragEnd={() => {}}
    >
      <div className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: color || "#94a3b8" }} />

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[status])}>{STATUS_LABELS[status]}</span>
          {deadline ? <span className="text-[12px] text-slate-400">期限 {deadline}</span> : null}
        </div>

        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            value={title}
            onChange={(event) => onUpdateTitle(id, event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onBlur={() => setIsEditingTitle(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            placeholder="タスク名を入力"
            className="w-full select-text border-none bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-300"
          />
        ) : (
          <div className={clsx("truncate text-sm font-semibold text-slate-900", isCompleted && "line-through")} style={isCompleted ? { color: palette.mutedText } : undefined}>
            {title || "Untitled"}
          </div>
        )}
      </div>

      <button
        onClick={(event) => {
          event.stopPropagation();
          onDelete(id);
        }}
        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
        title="削除"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
