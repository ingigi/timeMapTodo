import { useState } from "react";
import AssignedBlock from "./AssignedBlock";
import { getDeadlinePalette, getTaskPalette } from "../../utils/taskColors";
import { getCurrentDrag } from "../../utils/dragState";

export default function DayColumn({
  dateKey,
  dayName,
  dateNum,
  monthLabel,
  isToday,
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
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragColor, setDragColor] = useState(null);
  const isDeadlineDay = hoveredTaskDeadline === dateKey;
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
    <div className="flex min-w-[160px] flex-1 flex-col overflow-hidden border border-slate-200 bg-white">
      <div
        className="sticky top-0 z-20 border-b border-slate-100 bg-white p-3 text-center transition-colors"
        style={
          isDeadlineDay
            ? {
                backgroundColor: deadlinePalette.surface,
                borderBottomColor: deadlinePalette.border,
                boxShadow: `inset 0 -1px 0 ${deadlinePalette.border}, inset 0 0 0 1px ${deadlinePalette.border}`
              }
            : undefined
        }
      >
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">{monthLabel}</div>
        <div
          className={`text-[10px] font-bold uppercase tracking-tighter ${isToday ? "text-blue-600" : "text-slate-400"}`}
          style={isDeadlineDay ? { color: deadlinePalette.text } : undefined}
        >
          {dayName}
        </div>
        <div className="mt-1 flex items-center justify-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${isToday ? "bg-blue-600 text-white" : "text-slate-700"}`}
            style={isDeadlineDay && !isToday ? { backgroundColor: deadlinePalette.badgeStrong, color: deadlinePalette.text } : undefined}
          >
            {dateNum}
          </div>
        </div>
      </div>

      <div
        style={
          isDragOver
            ? {
                boxShadow: `inset 0 0 0 3px ${dropPalette.borderStrong}`,
                backgroundColor: dropPalette.surfaceStrong
              }
            : undefined
        }
        className="relative min-h-[600px] w-full flex-1 bg-white transition-all"
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
            onMoveTask(payload.taskId, dateKey);
            return;
          }

          onScheduleTask(payload.taskId, dateKey);
        }}
      >
        <div className="relative z-10 flex h-full w-full flex-col p-1">
          {dayTasks.map((task) => (
            <AssignedBlock
              key={task.id}
              task={task}
              dateKey={dateKey}
              isRelated={hoveredTaskId === task.id}
              onUnscheduleTask={onUnscheduleTask}
              onToggleTaskComplete={onToggleTaskComplete}
              onHoverTask={onHoverTask}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
