import { useRef, useState } from "react";
import clsx from "clsx";
import { Check, RotateCcw, Undo2 } from "lucide-react";
import { attachDragPreview } from "../../utils/dragPreview";
import { getDeadlinePalette, getTaskPalette } from "../../utils/taskColors";
import { getCurrentDrag, clearCurrentDrag, setCurrentDrag } from "../../utils/dragState";

function MonthlyTaskCard({
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
        "relative flex h-auto cursor-pointer select-none flex-col gap-3 overflow-hidden rounded-2xl border p-2.5 transition-all",
        isDragging && "scale-[0.99] opacity-60",
        task.completed && "opacity-75"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={clsx("min-w-0 flex-1 break-words text-[13px] font-semibold leading-5 text-slate-900", task.completed && "line-through")} style={task.completed ? { color: palette.mutedText } : undefined}>
          {task.title || "Untitled"}
        </div>

        <button
          onClick={(event) => {
            event.stopPropagation();
            onUnscheduleTask(task.id);
          }}
          className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
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
            "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium transition-colors",
            task.completed
              ? "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
              : "border-slate-200 bg-white/80 text-slate-700 hover:bg-white"
          )}
        >
          {task.completed ? <RotateCcw className="h-3 w-3" /> : <Check className="h-3 w-3" />}
          {task.completed ? "Complete" : "Done"}
        </button>
      </div>
    </div>
  );
}

export default function MonthlyDay({
  dateObj,
  dayTasks,
  hoveredTaskId,
  hoveredTaskDeadline,
  onScheduleTask,
  onUnscheduleTask,
  onMoveTask,
  onToggleTaskComplete,
  onHoverTask,
  onOpenDetail
}) {
  const isToday = dateObj.isToday;
  const isCurrentMonth = dateObj.isCurrentMonth;
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragColor, setDragColor] = useState(null);
  const isDeadlineDay = hoveredTaskDeadline === dateObj.dateKey;
  const deadlinePalette = getDeadlinePalette();
  const dropPalette = getTaskPalette(dragColor);

  const readDragPayload = (event) => {
    const rawText = event.dataTransfer.getData("text/plain");
    if (rawText) {
      try {
        const parsed = JSON.parse(rawText);
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      } catch {
        // Ignore invalid drag payloads.
      }
    }

    return getCurrentDrag();
  };

  return (
    <div
      onDragOver={(event) => {
        const payload = readDragPayload(event);
        if (!payload?.taskId) return;
        event.preventDefault();
        if (!isDragOver) setIsDragOver(true);
        setDragColor(event.dataTransfer.getData("dragColor") || "#94a3b8");
        event.dataTransfer.dropEffect = "move";
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsDragOver(false);
          setDragColor(null);
        }
      }}
      onDrop={(event) => {
        const payload = readDragPayload(event);
        if (!payload?.taskId) return;
        event.preventDefault();
        setIsDragOver(false);
        setDragColor(null);

        if (payload.sourceDateKey) {
          onMoveTask(payload.taskId, dateObj.dateKey);
          return;
        }

        onScheduleTask(payload.taskId, dateObj.dateKey);
      }}
      style={{
        ...(isDragOver
          ? {
              boxShadow: `inset 0 0 0 3px ${dropPalette.borderStrong}`,
              backgroundColor: dropPalette.surfaceStrong
            }
          : {}),
        ...(isDeadlineDay
          ? {
              backgroundColor: deadlinePalette.surface
            }
          : {})
      }}
      className={`relative flex min-h-[120px] flex-col overflow-hidden bg-white p-2 transition-all ${!isCurrentMonth ? "bg-slate-50/50" : ""}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${isToday ? "bg-blue-600 text-white" : !isCurrentMonth ? "text-slate-400" : "text-slate-800"}`}
            style={isDeadlineDay && !isToday ? { backgroundColor: deadlinePalette.badgeStrong, color: deadlinePalette.text } : undefined}
          >
            {dateObj.dateNum}
          </div>
        </div>
        <div className="text-xs font-medium text-slate-400">{isToday ? "Today" : ""}</div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 pb-1 pr-0.5">
        {dayTasks.map((task) => (
          <MonthlyTaskCard
            key={task.id}
            task={task}
            dateKey={dateObj.dateKey}
            isRelated={hoveredTaskId === task.id}
            onUnscheduleTask={onUnscheduleTask}
            onToggleTaskComplete={onToggleTaskComplete}
            onHoverTask={onHoverTask}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </div>
    </div>
  );
}
