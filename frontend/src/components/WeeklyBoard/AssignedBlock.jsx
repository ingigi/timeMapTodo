import { useRef, useState } from "react";
import clsx from "clsx";
import { Check, RotateCcw, Undo2 } from "lucide-react";
import { attachDragPreview } from "../../utils/dragPreview";
import { getTaskPalette } from "../../utils/taskColors";
import { clearCurrentDrag, setCurrentDrag } from "../../utils/dragState";

export default function AssignedBlock({
  task,
  dateKey,
  isRelated,
  onUnscheduleTask,
  onToggleTaskComplete,
  onHoverTask,
  onOpenDetail
}) {
  const dragCleanupRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const palette = getTaskPalette(task.color);

  return (
    <div className="w-full px-1 py-1">
      <div
        draggable
        onMouseEnter={() => onHoverTask(task.id, { deadlineDateKey: task.deadline || null, deadlineLabel: task.deadline || null })}
        onMouseLeave={() => onHoverTask(null)}
        onClick={() => onOpenDetail(task.id)}
        onDragStart={(event) => {
          setIsDragging(true);
          const payload = {
            dragType: "scheduled-task",
            taskId: task.id,
            sourceDateKey: dateKey,
            dragTitle: task.title || "Task",
            dragColor: task.color || "#94a3b8"
          };
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("taskId", task.id);
          event.dataTransfer.setData("text/plain", JSON.stringify(payload));
          event.dataTransfer.setData("application/x-task-id", task.id);
          event.dataTransfer.setData("dragType", "scheduled-task");
          event.dataTransfer.setData("application/x-drag-type", "scheduled-task");
          event.dataTransfer.setData("sourceDateKey", dateKey);
          event.dataTransfer.setData("application/x-source-date", dateKey);
          event.dataTransfer.setData("dragTitle", task.title || "Task");
          event.dataTransfer.setData("dragColor", task.color || "#94a3b8");
          setCurrentDrag(payload);
          dragCleanupRef.current = attachDragPreview(event, {
            title: task.title || "Task",
            color: task.color || "#94a3b8",
            completed: task.completed
          });
        }}
        onDragEnd={() => {
          setIsDragging(false);
          clearCurrentDrag();
          dragCleanupRef.current?.();
          dragCleanupRef.current = null;
        }}
        style={{
          borderColor: task.completed ? palette.completedBorder : isRelated ? palette.borderStrong : palette.border,
          backgroundColor: task.completed ? palette.completedSurface : isRelated ? palette.surfaceStrong : palette.surface,
          boxShadow: isRelated ? `0 8px 20px ${palette.shadow}` : "0 1px 2px rgba(15, 23, 42, 0.06)"
        }}
        className={clsx(
          "relative flex h-auto cursor-pointer select-none flex-col gap-3 overflow-hidden rounded-2xl border p-3 transition-all",
          isDragging && "scale-[0.99] opacity-60",
          task.completed && "opacity-75"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className={clsx("break-words text-sm font-semibold leading-6 text-slate-900", task.completed && "line-through")} style={task.completed ? { color: palette.mutedText } : undefined}>
              {task.title || "Untitled"}
            </div>
          </div>

          <button
            onClick={(event) => {
              event.stopPropagation();
              onUnscheduleTask(task.id);
            }}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            title="リストに戻す"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-end">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onToggleTaskComplete(task.id);
            }}
            className={clsx(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors",
              task.completed
                ? "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                : "border-slate-200 bg-white/80 text-slate-700 hover:bg-white"
            )}
          >
            {task.completed ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {task.completed ? "Complete" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
