import { useRef, useState } from "react";
import clsx from "clsx";
import { Check, Undo2 } from "lucide-react";
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
  const suppressClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const palette = getTaskPalette(task.color);

  return (
    <div
      draggable
      onMouseEnter={() => onHoverTask(task.id, { deadlineDateKey: task.deadline || null, deadlineLabel: task.deadline || null })}
      onMouseLeave={() => onHoverTask(null)}
      onClick={(event) => {
        if (suppressClickRef.current) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        onOpenDetail(task.id);
      }}
      onDragStart={(event) => {
        suppressClickRef.current = true;
        setIsDragging(true);
        const payload = {
          dragType: "scheduled-task",
          taskId: task.id,
          sourceDateKey: dateKey,
          sourceTime: task.scheduledTime || null,
          completed: Boolean(task.completed),
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
        event.dataTransfer.setData("sourceTime", task.scheduledTime || "");
        event.dataTransfer.setData("dragTitle", task.title || "Task");
        event.dataTransfer.setData("dragColor", task.color || "#94a3b8");
        setCurrentDrag(payload);
        dragCleanupRef.current = attachDragPreview(event, {
          hideNativePreview: true,
          sourceElement: event.currentTarget,
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
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 120);
      }}
      style={{
        borderColor: task.completed ? palette.completedBorder : isRelated ? palette.borderStrong : palette.border,
        backgroundColor: task.completed ? palette.completedSurface : isRelated ? palette.surfaceStrong : palette.surface,
        boxShadow: isRelated ? `0 8px 20px ${palette.shadow}` : "0 1px 2px rgba(17, 24, 39, 0.06)"
      }}
      className={clsx(
        "group relative flex cursor-pointer select-none items-start gap-1.5 rounded-md border px-2 py-1.5 text-[10px] transition-[background-color,border-color,box-shadow,opacity,transform] hover:shadow-[0_12px_28px_rgba(0,0,0,0.28)]",
        isDragging && "scale-[0.99] opacity-60",
        task.completed && "opacity-75"
      )}
    >
      <button
        onClick={(event) => {
          event.stopPropagation();
          onToggleTaskComplete(task.id);
        }}
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-all"
        style={{
          borderColor: task.completed ? palette.borderStrong : palette.border,
          backgroundColor: task.completed ? palette.borderStrong : "transparent",
          color: task.completed ? "#ffffff" : palette.text
        }}
      >
        {task.completed ? <Check className="h-2 w-2" /> : null}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className={clsx("whitespace-normal break-words font-medium leading-4 text-[#F7F7F8]", task.completed && "line-through")}
          style={task.completed ? { color: palette.mutedText } : undefined}
        >
          {task.title || "Untitled"}
        </div>
      </div>

      <button
        onClick={(event) => {
          event.stopPropagation();
          onUnscheduleTask(task.id);
        }}
        className="rounded-md p-1 text-[#8B949E] opacity-0 transition-all hover:bg-white/10 hover:text-[#F7F7F8] group-hover:opacity-100"
        title="リストに戻す"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function MonthlyDay({
  dateObj,
  dayIndex,
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
  const weekendTextClass = dayIndex === 0 ? "text-red-400" : dayIndex === 6 ? "text-blue-400" : "text-[#F7F7F8]";
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
          onMoveTask(payload.taskId, dateObj.dateKey, null);
          return;
        }

        onScheduleTask(payload.taskId, dateObj.dateKey, null);
      }}
      style={{
        ...(isDragOver
          ? {
              boxShadow: `inset 0 0 0 3px ${dropPalette.borderStrong}`,
              backgroundColor: dropPalette.surfaceStrong
            }
          : {})
      }}
      className={`relative flex min-h-[111px] flex-col bg-[#06080A] p-2 transition-all ${!isCurrentMonth ? "bg-[#06080A]" : ""}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              isToday ? "bg-[#0CCB8E] text-[#06100D]" : !isCurrentMonth ? "text-[#3B424B]" : weekendTextClass
            }`}
            style={
              isDeadlineDay
                ? isToday
                  ? { boxShadow: `0 0 0 2px ${deadlinePalette.borderStrong}, 0 0 24px ${deadlinePalette.shadow}` }
                  : { backgroundColor: deadlinePalette.badgeStrong, color: deadlinePalette.badgeText, boxShadow: `0 0 24px ${deadlinePalette.shadow}` }
                : undefined
            }
          >
            {dateObj.dateNum}
          </div>
        </div>
        <div className="text-xs font-medium text-[#9CA3AF]">{isToday ? "Today" : ""}</div>
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




