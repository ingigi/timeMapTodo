import { useRef, useState } from "react";
import clsx from "clsx";
import { Check, RotateCcw, X } from "lucide-react";
import { attachDragPreview } from "../../utils/dragPreview";
import { getTaskPalette } from "../../utils/taskColors";
import { clearCurrentDrag, setCurrentDrag } from "../../utils/dragState";
import { getRecurringDeadlineDateKey, getRecurringDeadlineLabel, isRecurringTask } from "../../utils/recurrence";

export default function AssignedBlock({
  assignment,
  task,
  isRelated,
  onDelete,
  onToggleComplete,
  onHoverTask,
  onOpenDetail,
  sourceDayIdx
}) {
  const dragCleanupRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!task) return null;
  const palette = getTaskPalette(task.color);

  return (
    <div className="w-full px-1 py-1">
      <div
        draggable
        onMouseEnter={() =>
          onHoverTask(
            task.id,
            isRecurringTask(task)
              ? {
                  deadlineDateKey: getRecurringDeadlineDateKey(task, assignment.recurrenceKey || sourceDayIdx),
                  deadlineLabel: getRecurringDeadlineLabel(task)
                }
              : { deadlineDateKey: task.deadline || null, deadlineLabel: task.deadline || null }
          )
        }
        onMouseLeave={() => onHoverTask(null)}
        onClick={() => onOpenDetail(task.id)}
        onDragStart={(event) => {
          setIsDragging(true);
          const payload = {
            dragType: "move",
            taskId: task.id,
            assignmentId: assignment.id,
            sourceDayIdx,
            dragTitle: task.title || "Task",
            dragColor: task.color || "#94a3b8"
          };
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("sourceDayIdx", sourceDayIdx);
          event.dataTransfer.setData("application/x-source-day", sourceDayIdx);
          event.dataTransfer.setData("assignmentId", assignment.id);
          event.dataTransfer.setData("application/x-assignment-id", assignment.id);
          event.dataTransfer.setData("taskId", task.id);
          event.dataTransfer.setData("text/plain", JSON.stringify(payload));
          event.dataTransfer.setData("application/x-task-id", task.id);
          event.dataTransfer.setData("dragType", "move");
          event.dataTransfer.setData("application/x-drag-type", "move");
          event.dataTransfer.setData("dragTitle", task.title || "Task");
          event.dataTransfer.setData("dragColor", task.color || "#94a3b8");
          setCurrentDrag(payload);
          dragCleanupRef.current = attachDragPreview(event, {
            title: task.title || "Task",
            color: task.color || "#94a3b8"
          });
        }}
        onDragEnd={() => {
          setIsDragging(false);
          clearCurrentDrag();
          dragCleanupRef.current?.();
          dragCleanupRef.current = null;
        }}
        style={{
          borderColor: assignment.completed ? palette.completedBorder : isRelated ? palette.borderStrong : palette.border,
          backgroundColor: assignment.completed ? palette.completedSurface : isRelated ? palette.surfaceStrong : palette.surface,
          boxShadow: isRelated ? `0 8px 20px ${palette.shadow}` : "0 1px 2px rgba(15, 23, 42, 0.06)"
        }}
        className={clsx(
          "relative flex h-auto cursor-pointer select-none flex-col gap-3 overflow-hidden rounded-2xl border p-3 transition-all",
          isDragging && "scale-[0.99] opacity-60",
          assignment.completed && "opacity-75"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className={clsx("break-words text-sm font-semibold leading-6 text-slate-900", assignment.completed && "line-through")} style={assignment.completed ? { color: palette.mutedText } : undefined}>
              {task.title || "Untitled"}
            </div>
          </div>

          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete(assignment.id);
            }}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-end">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onToggleComplete(sourceDayIdx, assignment.id);
            }}
            className={clsx(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors",
              assignment.completed
                ? "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                : "border-slate-200 bg-white/80 text-slate-700 hover:bg-white"
            )}
          >
            {assignment.completed ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {assignment.completed ? "Complete" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
