import { Check } from "lucide-react";
import { useState } from "react";
import AssignedBlock from "./AssignedBlock";
import { getTaskPalette } from "../../utils/taskColors";
import { getCurrentDrag } from "../../utils/dragState";

const HOURS = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, "0")}:00`);
const HOUR_HEIGHT = 72;
const SNAP_MINUTES = 15;
const MIN_DURATION_MINUTES = 15;
const MIN_TEXT_COLLISION_MINUTES = 34;
const MAX_TEXT_COLLISION_MINUTES = 110;

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

const intervalsOverlap = (left, right) => left.startMinutes < right.endMinutes && right.startMinutes < left.endMinutes;

const getLayoutTitle = (item) => item.event?.title || item.task?.title || item.title || "";

const getTextCollisionMinutes = (item) => {
  const durationMinutes = Math.max(MIN_DURATION_MINUTES, item.endMinutes - item.startMinutes);
  const titleLength = getLayoutTitle(item).length;
  const estimatedMinutes = MIN_TEXT_COLLISION_MINUTES + Math.ceil(titleLength / 8) * 10;
  return Math.min(durationMinutes, Math.min(MAX_TEXT_COLLISION_MINUTES, estimatedMinutes));
};

const textRegionsOverlap = (left, right) => {
  const leftTextEnd = Math.min(left.endMinutes, left.startMinutes + getTextCollisionMinutes(left));
  const rightTextEnd = Math.min(right.endMinutes, right.startMinutes + getTextCollisionMinutes(right));
  return left.startMinutes < rightTextEnd && right.startMinutes < leftTextEnd;
};

const layoutTimedItems = (items) => {
  const sortedItems = [...items].sort((left, right) => {
    if (left.startMinutes !== right.startMinutes) return left.startMinutes - right.startMinutes;
    return right.endMinutes - left.endMinutes;
  });
  const groups = [];
  let currentGroup = [];
  let currentGroupEnd = -1;

  sortedItems.forEach((item) => {
    if (!currentGroup.length || item.startMinutes < currentGroupEnd) {
      currentGroup.push(item);
      currentGroupEnd = Math.max(currentGroupEnd, item.endMinutes);
      return;
    }

    groups.push(currentGroup);
    currentGroup = [item];
    currentGroupEnd = item.endMinutes;
  });

  if (currentGroup.length) groups.push(currentGroup);

  return groups.flatMap((group) => {
    const laneEndMinutes = [];
    const withLanes = group.map((item) => {
      let laneIndex = laneEndMinutes.findIndex((endMinutes) => endMinutes <= item.startMinutes);
      if (laneIndex === -1) {
        laneIndex = laneEndMinutes.length;
        laneEndMinutes.push(item.endMinutes);
      } else {
        laneEndMinutes[laneIndex] = item.endMinutes;
      }

      return { ...item, laneIndex };
    });

    const laneCount = laneEndMinutes.length;

    return withLanes.map((item) => {
      let renderLaneStart = item.laneIndex;
      let renderLaneEnd = item.laneIndex + 1;

      for (let laneIndex = item.laneIndex - 1; laneIndex >= 0; laneIndex -= 1) {
        const laneTextIsBlocked = withLanes.some(
          (candidate) => candidate.laneIndex === laneIndex && intervalsOverlap(item, candidate) && textRegionsOverlap(item, candidate)
        );

        if (laneTextIsBlocked) break;
        renderLaneStart = laneIndex;
      }

      for (let laneIndex = item.laneIndex + 1; laneIndex < laneCount; laneIndex += 1) {
        const laneTextIsBlocked = withLanes.some(
          (candidate) => candidate.laneIndex === laneIndex && intervalsOverlap(item, candidate) && textRegionsOverlap(item, candidate)
        );

        if (laneTextIsBlocked) break;
        renderLaneEnd = laneIndex + 1;
      }

      return {
        ...item,
        laneCount,
        renderLaneCount: laneCount,
        renderLaneIndex: renderLaneStart,
        renderLaneSpan: renderLaneEnd - renderLaneStart
      };
    });
  });
};

function PlacementPreview({ preview }) {
  const palette = getTaskPalette(preview.color);
  const startTime = minutesToTime(preview.startMinutes);
  const endTime = minutesToTime(preview.startMinutes + preview.durationMinutes);
  const height = Math.max(38, (preview.durationMinutes / 60) * HOUR_HEIGHT - 4);

  return (
    <div
      className="absolute left-1.5 right-1.5 z-[18] rounded-lg border px-2 py-1 transition-[transform,height] duration-100 ease-out"
      style={{
        top: 0,
        transform: `translate3d(0, ${(preview.startMinutes / 60) * HOUR_HEIGHT + 2}px, 0)`,
        height: `${height}px`,
        borderColor: preview.completed ? palette.completedBorder : palette.border,
        backgroundColor: preview.completed ? palette.completedSurface : palette.surface,
        boxShadow: `0 18px 38px ${palette.shadow}`
      }}
    >
      <div className="grid min-h-0 grid-cols-[16px_minmax(0,1fr)] items-start gap-x-1.5 gap-y-0.5">
        <span
          className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border"
          style={{
            borderColor: preview.completed ? palette.borderStrong : palette.border,
            backgroundColor: preview.completed ? palette.borderStrong : "transparent",
            color: "#ffffff"
          }}
        >
          {preview.completed ? <Check className="h-2 w-2" /> : null}
        </span>
        <span
          className="min-w-0 break-words text-[12px] font-bold leading-4"
          style={{ color: preview.completed ? palette.mutedText : palette.text }}
        >
          {preview.title || "Untitled"}
        </span>
        <span className="col-span-2 max-w-full break-words text-[10.5px] font-bold leading-3 text-[#B8C0CC]">
          {startTime}-{endTime}
        </span>
      </div>
    </div>
  );
}

function GoogleCalendarEventBlock({ event, variant = "timed", style }) {
  const timeLabel = event.allDay ? "All day" : `${event.startTime}${event.endTime ? `-${event.endTime}` : ""}`;

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[#334155] bg-[#111827] px-2 py-1.5 text-[#CBD5E1] shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${
        variant === "untimed" ? "min-h-[28px]" : "absolute"
      }`}
      style={style}
    >
      <div className="min-w-0">
        <div className="break-words text-[11px] font-bold leading-4 text-[#E2E8F0]">{event.title}</div>
        <div className="break-words text-[9px] font-semibold leading-3 text-[#94A3B8]">{timeLabel}</div>
      </div>
    </div>
  );
}

export default function DayColumn({
  mode,
  dateKey,
  dayTasks,
  googleCalendarEvents = [],
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
  const [placementGuide, setPlacementGuide] = useState(null);
  const dropPalette = getTaskPalette(dragColor);
  const untimedTasks = dayTasks.filter((task) => !task.scheduledTime);
  const timedTasks = dayTasks.filter((task) => task.scheduledTime);
  const allDayGoogleEvents = googleCalendarEvents.filter((event) => event.allDay);
  const timedGoogleEvents = googleCalendarEvents.filter((event) => !event.allDay);
  const timedLayoutItems = layoutTimedItems([
    ...timedGoogleEvents.map((event) => {
      const startMinutes = timeToMinutes(event.startTime);
      const duration = Math.max(MIN_DURATION_MINUTES, Number(event.durationMinutes) || 60);
      return {
        id: `google-${event.id}`,
        type: "google",
        event,
        startMinutes,
        endMinutes: Math.min(24 * 60, startMinutes + duration),
        durationMinutes: duration
      };
    }),
    ...timedTasks.map((task) => {
      const startMinutes = timeToMinutes(task.scheduledTime);
      const duration = Math.max(MIN_DURATION_MINUTES, Number(task.scheduledDurationMinutes) || 60);
      return {
        id: `task-${task.id}`,
        type: "task",
        task,
        startMinutes,
        endMinutes: Math.min(24 * 60, startMinutes + duration),
        durationMinutes: duration
      };
    })
  ]);
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
    const previewHeight = Math.max(38, (durationMinutes / 60) * HOUR_HEIGHT - 4);
    const dragOffsetY = Math.max(0, Math.min(previewHeight, Number(payload.dragOffsetY) || Number(event.dataTransfer.getData("dragOffsetY")) || 0));
    const rawMinutes = ((event.clientY - rect.top - dragOffsetY) / HOUR_HEIGHT) * 60;
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
    setPlacementGuide({
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
    setPlacementGuide(null);
  };

  const handleDrop = (event, targetTime = null) => {
    const payload = readDragPayload(event);
    if (!payload?.taskId) return;

    event.preventDefault();
    setDropTarget(null);
    setDragColor(null);
    setPlacementGuide(null);

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
    setPlacementGuide(null);

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
          {allDayGoogleEvents.slice(0, 3).map((event) => (
            <GoogleCalendarEventBlock key={event.id} event={event} variant="untimed" />
          ))}

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

      <div className="pointer-events-none absolute inset-0">
        {placementGuide ? <PlacementPreview preview={placementGuide} /> : null}

        {timedLayoutItems.map((item) => {
          const top = (item.startMinutes / 60) * HOUR_HEIGHT;
          const height = Math.max(38, (item.durationMinutes / 60) * HOUR_HEIGHT - 4);
          const leftPercent = (item.renderLaneIndex / item.renderLaneCount) * 100;
          const widthPercent = (item.renderLaneSpan / item.renderLaneCount) * 100;
          const overlapsNextLane = item.renderLaneIndex + item.renderLaneSpan < item.renderLaneCount;
          const overlapsPreviousLane = item.renderLaneIndex < item.laneIndex;
          const overlapPixels = overlapsNextLane ? 28 : 0;
          const operationGapPixels = overlapsPreviousLane ? 16 : 0;
          const itemStyle = {
            top: `${top + 2}px`,
            left: `calc(${leftPercent}% + 6px + ${operationGapPixels}px)`,
            width: `calc(${widthPercent}% - 12px + ${overlapPixels}px - ${operationGapPixels}px)`,
            height: `${height}px`,
            zIndex: 20 + item.laneIndex
          };

          if (item.type === "google") {
            return <GoogleCalendarEventBlock key={item.id} event={item.event} style={itemStyle} />;
          }

          return (
            <AssignedBlock
              key={item.id}
              task={item.task}
              dateKey={dateKey}
              variant="timed"
              isRelated={hoveredTaskId === item.task.id}
              onUnscheduleTask={onUnscheduleTask}
              onToggleTaskComplete={onToggleTaskComplete}
              onHoverTask={onHoverTask}
              onOpenDetail={onOpenDetail}
              onResizeTask={(nextDurationMinutes, nextStartTime) => handleResizeTask(item.task, nextDurationMinutes, nextStartTime)}
              style={itemStyle}
            />
          );
        })}
      </div>
    </div>
  );
}
