import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { attachDragPreview } from "../../utils/dragPreview";
import { getTaskPalette } from "../../utils/taskColors";
import { clearCurrentDrag, setCurrentDrag } from "../../utils/dragState";

const STATUS_LABELS = {
  NotStarted: "\u672a\u7740\u624b",
  InProgress: "\u9032\u884c\u4e2d",
  Completed: "\u5b8c\u4e86"
};

const STATUS_STYLES = {
  NotStarted: "bg-[#161A1F] text-[#8B949E]",
  InProgress: "bg-amber-500/15 text-amber-300",
  Completed: "bg-emerald-500/15 text-emerald-300"
};

export default function TaskListItem({
  task,
  isActive,
  isRelated,
  suppressInlineTitleAutoEdit,
  onDelete,
  onUpdateTaskTitle,
  onOpenDetail,
  onHoverTask
}) {
  const { id, title, color, status = "NotStarted", deadline, sourceWorkflowId } = task;
  const titleInputRef = useRef(null);
  const dragCleanupRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [isEditingTitle, setIsEditingTitle] = useState(() => !title?.trim() && !suppressInlineTitleAutoEdit);
  const palette = getTaskPalette(color);
  const isCompleted = status === "Completed";

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
    };
  }, []);

  return (
    <div
      className={clsx(
        "group mb-2 flex select-none items-center gap-3 rounded-xl border px-3 py-3 transition-all",
        !isRelated && !isActive && "border-[#20242A] hover:border-[#0CCB8E]/30 hover:shadow-[0_8px_24px_rgba(12,203,142,0.05)]",
        isCompleted && "opacity-75"
      )}
      onMouseEnter={() => onHoverTask(id, { deadlineDateKey: deadline || null })}
      onMouseLeave={() => onHoverTask(null)}
      onClick={(event) => {
        if (suppressClickRef.current) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        onOpenDetail(id);
      }}
      style={
        isRelated
          ? {
              borderColor: palette.borderStrong,
              backgroundColor: "#0B0E11",
              boxShadow: `0 18px 36px ${palette.shadow}`
            }
          : isActive
            ? { borderColor: palette.border, backgroundColor: "#0B0E11", boxShadow: `0 8px 18px ${palette.shadow}` }
            : isCompleted
              ? { borderColor: palette.completedBorder, backgroundColor: palette.completedSurface }
              : { backgroundColor: "#0B0E11" }
      }
      draggable={!isEditingTitle}
      onDragStart={(event) => {
        if (isEditingTitle) {
          event.preventDefault();
          return;
        }

        suppressClickRef.current = true;
        const payload = {
          dragType: "task",
          taskId: id,
          dragTitle: title || "Task",
          dragColor: color || "#94a3b8",
          completed: isCompleted,
          dragDeadline: deadline || ""
        };
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("taskId", id);
        event.dataTransfer.setData("text/plain", JSON.stringify(payload));
        event.dataTransfer.setData("application/x-task-id", id);
        event.dataTransfer.setData("dragType", "task");
        event.dataTransfer.setData("application/x-drag-type", "task");
        event.dataTransfer.setData("dragTitle", title || "Task");
        event.dataTransfer.setData("dragColor", color || "#94a3b8");
        event.dataTransfer.setData("dragDeadline", deadline || "");
        setCurrentDrag(payload);
        dragCleanupRef.current = attachDragPreview(event, {
          hideNativePreview: true,
          sourceElement: event.currentTarget,
          title: title || "Task",
          color: color || "#94a3b8",
          completed: isCompleted
        });
      }}
      onDragEnd={() => {
        clearCurrentDrag();
        dragCleanupRef.current?.();
        dragCleanupRef.current = null;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 120);
      }}
    >
      <div className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: color || "#94a3b8" }} />

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[status])}>{STATUS_LABELS[status]}</span>
          <span className="rounded-full bg-[#161A1F] px-2 py-0.5 text-[11px] font-medium text-[#8B949E]">
            未配置
          </span>
          {sourceWorkflowId ? (
            <span className="rounded-full bg-[#161A1F] px-2 py-0.5 text-[11px] font-medium text-[#8B949E]">
              自動追加
            </span>
          ) : null}
          {deadline ? <span className="text-[12px] text-[#9CA3AF]">期限 {deadline}</span> : null}
        </div>

        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            value={title}
            onChange={(event) => onUpdateTaskTitle(id, event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onBlur={() => setIsEditingTitle(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            placeholder="タスク名を入力"
            className="w-full select-text border-none bg-transparent text-sm font-semibold text-[#F7F7F8] outline-none placeholder:text-[#4B5563]"
          />
        ) : (
          <div
            className={clsx("truncate text-sm font-semibold text-[#F7F7F8]", isCompleted && "line-through")}
            style={isCompleted ? { color: palette.mutedText } : undefined}
          >
            {title || "無題のタスク"}
          </div>
        )}
      </div>

      <button
        onClick={(event) => {
          event.stopPropagation();
          onDelete(id);
        }}
        className="rounded-lg p-2 text-[#8B949E] opacity-0 transition-all hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
        title="削除"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}




