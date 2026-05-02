import clsx from "clsx";
import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { attachDragPreview } from "../../utils/dragPreview";
import { getTaskPalette } from "../../utils/taskColors";
import { clearCurrentDrag, setCurrentDrag } from "../../utils/dragState";

export default function TaskListItem({
  task,
  isActive,
  isRelated,
  onDelete,
  onOpenDetail,
  onJumpToScheduledTask,
  onHoverTask
}) {
  const { id, title, color, deadline, scheduledDate } = task;
  const dragCleanupRef = useRef(null);
  const dragOffsetRef = useRef(null);
  const suppressClickRef = useRef(false);
  const palette = getTaskPalette(color);
  const isCompleted = task.completed || task.statusId === "completed";
  const isScheduled = Boolean(scheduledDate);

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
        !isRelated && !isActive && "border-[#20242A] hover:border-[#60B964]/30 hover:shadow-[0_8px_24px_rgba(96,185,100,0.05)]",
        (isCompleted || isScheduled) && "opacity-60",
        isScheduled ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
      )}
      onMouseEnter={() => onHoverTask(id, { deadlineDateKey: deadline || null })}
      onMouseLeave={() => onHoverTask(null)}
      onClick={(event) => {
        if (suppressClickRef.current) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (isScheduled) {
          onJumpToScheduledTask?.(task);
          return;
        }

        onOpenDetail(id);
      }}
      style={
        isRelated
          ? {
              borderColor: palette.borderStrong,
              backgroundColor: "var(--surface-raised, #0B0E11)",
              boxShadow: `0 18px 36px ${palette.shadow}`
            }
          : isActive
            ? { borderColor: palette.border, backgroundColor: "var(--surface-raised, #0B0E11)", boxShadow: `0 8px 18px ${palette.shadow}` }
            : isCompleted
              ? { borderColor: palette.completedBorder, backgroundColor: palette.completedSurface }
              : isScheduled
                ? { borderColor: "#20242A", backgroundColor: "var(--surface-raised, #0B0E11)" }
                : { backgroundColor: "var(--surface-raised, #0B0E11)" }
      }
      draggable={!isScheduled}
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        dragOffsetRef.current = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        };
      }}
      onDragStart={(event) => {
        if (isScheduled) {
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
          dragDeadline: deadline || "",
          dragOffsetY: dragOffsetRef.current?.y || 0
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
        event.dataTransfer.setData("dragOffsetY", String(dragOffsetRef.current?.y || 0));
        setCurrentDrag(payload);
        dragCleanupRef.current = attachDragPreview(event, {
          sourceElement: event.currentTarget,
          offsetX: dragOffsetRef.current?.x,
          offsetY: dragOffsetRef.current?.y,
          title: title || "Task",
          color: color || "#94a3b8",
          completed: isCompleted
        });
      }}
      onDragEnd={() => {
        clearCurrentDrag();
        dragOffsetRef.current = null;
        dragCleanupRef.current?.();
        dragCleanupRef.current = null;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 120);
      }}
    >
      <div className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: color || "#94a3b8", opacity: isScheduled ? 0.45 : 1 }} />

      <div className="min-w-0 flex-1">
        <div
          className={clsx("truncate text-sm font-semibold text-[#F7F7F8]", isCompleted && "line-through")}
          style={isCompleted ? { color: palette.mutedText } : undefined}
        >
          {title || "無題のタスク"}
        </div>
        {isScheduled ? (
          <div className="mt-1 truncate text-[11px] font-semibold text-[#748092]">
            {scheduledDate}
            {task.scheduledTime ? ` ${task.scheduledTime}` : ""}
          </div>
        ) : null}
      </div>

      {!isScheduled ? (
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
      ) : null}
    </div>
  );
}
