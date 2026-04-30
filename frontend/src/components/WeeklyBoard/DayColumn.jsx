import { Check } from "lucide-react";
import { useState } from "react";
import AssignedBlock from "./AssignedBlock";
import { getTaskPalette } from "../../utils/taskColors";
import { getCurrentDrag } from "../../utils/dragState";

const HOURS = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, "0")}:00`);
const HOUR_HEIGHT = 72;
const SNAP_MINUTES = 15;
const MIN_DURATION_MINUTES = 15;

const timeToMinutes = (time) => {
  if (!time) return 0;
  const [hours, minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
};

const minutesToTime = (minutes) => {
  const bounded = Math.max(0, Math.min(24 * 60, minutes));
  const hours = Math.floor(bounded / 60);
  const mins = bounded % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

function PlacementPreview({ preview }) {
  const palette = getTaskPalette(preview.color);
  const startTime = minutesToTime(preview.startMinutes);
  const endTime = minutesToTime(preview.startMinutes + preview.durationMinutes);
  const top = (preview.startMinutes / 60) * HOUR_HEIGHT;
  const height = Math.max(38, (preview.durationMinutes / 60) * HOUR_HEIGHT - 4);

  return (
    <div
      className="pointer-events-none absolute left-1.5 right-1.5 z-30 rounded-lg border px-2 py-1.5 shadow-[0_18px_38px_rgba(0,0,0,0.28)] transition-[top,height] duration-100 ease-out"
      style={{
        top: `${top + 2}px`,
        height: `${height}px`,
        borderColor: palette.borderStrong,
        backgroundColor: palette.surfaceStrong,
        color: palette.text
      }}
    >
      <div className="flex min-h-0 items-start gap-2">
        <div className="flex w-11 shrink-0 flex-col items-start gap-0.5">
          <span
            className="flex h-3.5 w-3.5 items-center justify-center rounded-full border"
            style={{
              borderColor: preview.completed ? palette.borderStrong : palette.border,
              backgroundColor: preview.completed ? palette.borderStrong : "transparent",
              color: "#ffffff"
            }}
          >
            {preview.completed ? <Check className="h-2 w-2" /> : null}
          </span>
          <span className="max-w-full truncate text-[9px] font-semibold leading-3 text-[#A8B2C0]">{startTime}-{endTime}</span>
        </div>
        <div className="min-w-0 flex-1 truncate text-[11px] font-bold leading-4">{preview.title || "Untitled"}</div>
      </div>
    </div>
  );
}

export default function DayColumn({
  mode,
  dateKey,
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
  const [dropTarget, setDropTarget] = useState(null);
  const [dragColor, setDragColor] = useState(null);
  const [placementPreview, setPlacementPreview] = useState(null);
  const dropPalette = getTaskPalette(dragColor);
  const untimedTasks = dayTasks.filter((task) => !task.scheduledTime);
  const timedTasks = dayTasks.filter((task) => task.scheduledTime);
  const isDeadlineDay = hoveredTaskDeadline === dateKey;

  const readDragPayload = (event) => {
    const rawText = event.dataTransfer.getData("text/plain");
    if (rawText) {
      try {
        const parsed = JSON.parse(rawText);
        if (parsed && typeof parsed === "object") return parsed;
      } catch {
        // Ignore invalid drag payloads.
      }
    }

    return getCurrentDrag();
  };

  const getTimedDropPosition = (event, payload) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const durationMinutes = Math.max(MIN_DURATION_MINUTES, Number(payload.durationMinutes) || 30);
    const rawMinutes = ((event.clientY - rect.top) / HOUR_HEIGHT) * 60;
    const snappedMinutes = Math.floor(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;
    const maxStartMinutes = Math.max(0, 24 * 60 - durationMinutes);
    const startMinutes = Math.max(0, Math.min(maxStartMinutes, snappedMinutes));

    return {
      durationMinutes,
      startMinutes,
      targetTime: minutesToTime(startMinutes)
    };
  };

  const handleDragOver = (event, targetTime = null) => {
    const payload = readDragPayload(event);
    if (!payload?.taskId) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTarget(targetTime || "untimed");
    setDragColor(event.dataTransfer.getData("dragColor") || payload.dragColor || "#94a3b8");
  };

  const handleTimedDragOver = (event) => {
    const payload = readDragPayload(event);
    if (!payload?.taskId) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const nextPosition = getTimedDropPosition(event, payload);
    const color = event.dataTransfer.getData("dragColor") || payload.dragColor || "#94a3b8";
    setDropTarget(nextPosition.targetTime);
    setDragColor(color);
    setPlacementPreview({
      ...nextPosition,
      title: event.dataTransfer.getData("dragTitle") || payload.dragTitle || "Untitled",
      color,
      completed: Boolean(payload.completed)
    });
  };

  const clearDropTarget = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setDropTarget(null);
    setDragColor(null);
    setPlacementPreview(null);
  };

  const handleDrop = (event, targetTime = null) => {
    const payload = readDragPayload(event);
    if (!payload?.taskId) return;

    event.preventDefault();
    setDropTarget(null);
    setDragColor(null);
    setPlacementPreview(null);

    const nextDuration = payload.durationMinutes || undefined;
    if (payload.sourceDateKey) {
      onMoveTask(payload.taskId, dateKey, targetTime, nextDuration);
      return;
    }

    onScheduleTask(payload.taskId, dateKey, targetTime, nextDuration);
  };

  const handleTimedDrop = (event) => {
    const payload = readDragPayload(event);
    if (!payload?.taskId) return;

    event.preventDefault();
    const nextPosition = getTimedDropPosition(event, payload);
    setDropTarget(null);
    setDragColor(null);
    setPlacementPreview(null);

    if (payload.sourceDateKey) {
      onMoveTask(payload.taskId, dateKey, nextPosition.targetTime, nextPosition.durationMinutes);
      return;
    }

    onScheduleTask(payload.taskId, dateKey, nextPosition.targetTime, nextPosition.durationMinutes);
  };

  const handleResizeTask = (task, nextDurationMinutes, nextStartTime = task.scheduledTime) => {
    onMoveTask(task.id, dateKey, nextStartTime, nextDurationMinutes);
  };

  if (mode === "untimed") {
    return (
      <div
        className="min-h-[88px] border-r border-[#2A3038] bg-[#06080A] p-2 last:border-r-0"
        style={
          dropTarget === "untimed"
            ? {
                backgroundColor: dropPalette.surfaceStrong,
                boxShadow: `inset 0 0 0 2px ${dropPalette.borderStrong}`
              }
            : isDeadlineDay
              ? undefined
            : undefined
        }
        onDragOver={(event) => handleDragOver(event)}
        onDragLeave={clearDropTarget}
        onDrop={(event) => handleDrop(event)}
      >
        <div className="space-y-1.5">
          {untimedTasks.slice(0, 4).map((task) => (
            <AssignedBlock
              key={task.id}
              task={task}
              dateKey={dateKey}
              variant="untimed"
              isRelated={hoveredTaskId === task.id}
              onUnscheduleTask={onUnscheduleTask}
              onToggleTaskComplete={onToggleTaskComplete}
              onHoverTask={onHoverTask}
              onOpenDetail={onOpenDetail}
            />
          ))}
          {untimedTasks.length > 4 ? (
            <div className="rounded-md bg-[#161A1F] px-2 py-1 text-[10px] font-semibold text-[#8B949E]">+{untimedTasks.length - 4}</div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative z-10 overflow-hidden border-r border-[#2A3038] bg-transparent transition-all last:border-r-0"
      style={{
        height: `${HOURS.length * HOUR_HEIGHT}px`
      }}
      onDragOver={handleTimedDragOver}
      onDragLeave={clearDropTarget}
      onDrop={handleTimedDrop}
    >
      {HOURS.map((hour) => (
        <div key={hour} style={{ height: `${HOUR_HEIGHT}px` }} />
      ))}

      {placementPreview ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundColor: dropPalette.surfaceStrong,
            boxShadow: `inset 0 0 0 2px ${dropPalette.borderStrong}`
          }}
        />
      ) : null}

      <div className="pointer-events-none absolute inset-0">
        {placementPreview ? <PlacementPreview preview={placementPreview} /> : null}

        {timedTasks.map((task) => {
          const startMinutes = timeToMinutes(task.scheduledTime);
          const duration = Math.max(MIN_DURATION_MINUTES, Number(task.scheduledDurationMinutes) || 60);
          const top = (startMinutes / 60) * HOUR_HEIGHT;
          const height = Math.max(38, (duration / 60) * HOUR_HEIGHT - 4);

          return (
            <AssignedBlock
              key={task.id}
              task={task}
              dateKey={dateKey}
              variant="timed"
              isRelated={hoveredTaskId === task.id}
              onUnscheduleTask={onUnscheduleTask}
              onToggleTaskComplete={onToggleTaskComplete}
              onHoverTask={onHoverTask}
              onOpenDetail={onOpenDetail}
              onResizeTask={(nextDurationMinutes, nextStartTime) => handleResizeTask(task, nextDurationMinutes, nextStartTime)}
              style={{
                position: "absolute",
                top: `${top + 2}px`,
                left: "6px",
                right: "6px",
                height: `${height}px`
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
