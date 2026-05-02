import { useRef, useState } from "react";
import clsx from "clsx";
import { Check, RotateCcw, Undo2 } from "lucide-react";
import { attachDragPreview } from "../../utils/dragPreview";
import { clearCurrentDrag, setCurrentDrag } from "../../utils/dragState";
import { getTaskPalette } from "../../utils/taskColors";

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

const RESIZE_STEP_MINUTES = 15;
const MIN_DURATION_MINUTES = 15;

export default function AssignedBlock({
  task,
  dateKey,
  variant = "default",
  style,
  isRelated,
  onUnscheduleTask,
  onToggleTaskComplete,
  onHoverTask,
  onOpenDetail,
  onResizeTask
}) {
  const dragCleanupRef = useRef(null);
  const dragOffsetRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const palette = getTaskPalette(task.color);
  const isUntimed = variant === "untimed";
  const isTimed = variant === "timed";
  const durationMinutes = Math.max(MIN_DURATION_MINUTES, Number(task.scheduledDurationMinutes) || 60);
  const dragDurationMinutes = isUntimed ? 30 : durationMinutes;
  const scheduledStartMinutes = timeToMinutes(task.scheduledTime);
  const scheduledEndTime = minutesToTime(scheduledStartMinutes + durationMinutes);
  const scheduledTimeRange = task.scheduledTime ? `${task.scheduledTime}-${scheduledEndTime}` : "";

  const startResize = (event, edge = "bottom") => {
    if (!isTimed || !onResizeTask) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = true;

    const startY = event.clientY;
    const startMinutes = timeToMinutes(task.scheduledTime);
    const startDuration = durationMinutes;
    const startEndMinutes = Math.min(24 * 60, startMinutes + startDuration);
    setIsResizing(true);

    const handlePointerMove = (moveEvent) => {
      const deltaMinutes = Math.round(((moveEvent.clientY - startY) / 72) * 60 / RESIZE_STEP_MINUTES) * RESIZE_STEP_MINUTES;

      if (edge === "top") {
        const nextStartMinutes = Math.max(0, Math.min(startEndMinutes - MIN_DURATION_MINUTES, startMinutes + deltaMinutes));
        const nextDuration = Math.max(MIN_DURATION_MINUTES, startEndMinutes - nextStartMinutes);
        onResizeTask(nextDuration, minutesToTime(nextStartMinutes));
        return;
      }

      const maxDuration = 24 * 60 - startMinutes;
      const nextDuration = Math.max(MIN_DURATION_MINUTES, Math.min(maxDuration, startDuration + deltaMinutes));
      onResizeTask(nextDuration, task.scheduledTime);
    };

    const stopResize = (upEvent) => {
      upEvent?.preventDefault();
      upEvent?.stopPropagation();
      setIsResizing(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      document.body.style.userSelect = "";
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 160);
    };

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
  };

  const renderCheckButton = (className) => (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onToggleTaskComplete(task.id);
      }}
      className={clsx("flex shrink-0 items-center justify-center rounded-full border transition-all", className)}
      style={{
        borderColor: task.completed ? palette.borderStrong : palette.border,
        backgroundColor: task.completed ? palette.borderStrong : "transparent",
        color: task.completed ? "#ffffff" : palette.text
      }}
    >
      {task.completed ? <Check className="h-2 w-2" /> : null}
    </button>
  );

  return (
    <div className={clsx(isTimed ? "pointer-events-auto absolute" : "w-full", !isUntimed && !isTimed && "px-1 py-1")} style={style}>
      <div
        draggable
        onMouseEnter={() => onHoverTask(task.id, { deadlineDateKey: task.deadline || null, deadlineLabel: task.deadline || null })}
        onMouseLeave={() => onHoverTask(null)}
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          dragOffsetRef.current = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
          };
        }}
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
            durationMinutes: dragDurationMinutes,
            completed: Boolean(task.completed),
            dragTitle: task.title || "Task",
            dragColor: task.color || "#94a3b8",
            dragOffsetY: dragOffsetRef.current?.y || 0
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
          event.dataTransfer.setData("durationMinutes", String(dragDurationMinutes));
          event.dataTransfer.setData("dragTitle", task.title || "Task");
          event.dataTransfer.setData("dragColor", task.color || "#94a3b8");
          event.dataTransfer.setData("dragOffsetY", String(dragOffsetRef.current?.y || 0));
          setCurrentDrag(payload);
          dragCleanupRef.current = attachDragPreview(event, {
            sourceElement: event.currentTarget,
            offsetX: dragOffsetRef.current?.x,
            offsetY: dragOffsetRef.current?.y,
            title: task.title || "Task",
            color: task.color || "#94a3b8",
            completed: task.completed
          });
        }}
        onDragEnd={() => {
          setIsDragging(false);
          clearCurrentDrag();
          dragOffsetRef.current = null;
          dragCleanupRef.current?.();
          dragCleanupRef.current = null;
          window.setTimeout(() => {
            suppressClickRef.current = false;
          }, 120);
        }}
        style={{
          borderColor: task.completed ? palette.completedBorder : isRelated ? palette.borderStrong : palette.border,
          backgroundColor: task.completed ? palette.completedSurface : isRelated ? palette.surfaceStrong : palette.surface,
          boxShadow: isRelated ? `0 18px 38px ${palette.shadow}` : "0 1px 2px rgba(0, 0, 0, 0.18)"
        }}
        className={clsx(
          "group relative flex h-full cursor-pointer select-none flex-col overflow-hidden border transition-[background-color,border-color,box-shadow,opacity,transform] hover:shadow-[0_18px_38px_rgba(0,0,0,0.28)]",
          isUntimed && "min-h-[28px] gap-0 rounded-md px-2 py-1.5",
          isTimed && "rounded-lg px-2 py-1",
          !isUntimed && !isTimed && "gap-2 rounded-xl px-3 py-2.5",
          isDragging && "opacity-0",
          isResizing && "ring-2 ring-[#60B964]/60",
          task.completed && "opacity-75"
        )}
      >
        {isTimed ? (
          <div className="grid min-h-0 grid-cols-[16px_minmax(0,1fr)] items-start gap-x-1.5 gap-y-0.5">
            {renderCheckButton("h-3.5 w-3.5")}
            <div
              className={clsx("min-w-0 break-words text-[12px] font-bold leading-4", task.completed && "line-through")}
              style={{ color: task.completed ? palette.mutedText : palette.text }}
            >
              {task.title || "Untitled"}
            </div>
            <div className="col-span-2 max-w-full break-words text-[10.5px] font-bold leading-3 text-[#B8C0CC]">{scheduledTimeRange}</div>
          </div>
        ) : (
          <div className={clsx("flex min-h-0 items-start justify-between", isUntimed ? "gap-1.5" : "gap-3")}>
            {isUntimed ? renderCheckButton("mt-[1px] h-3.5 w-3.5") : null}

            <div className="min-w-0 flex-1">
              <div
                className={clsx(
                  isUntimed ? "truncate text-[11px] leading-4" : "break-words text-sm leading-5",
                  "font-bold",
                  task.completed && "line-through"
                )}
                style={{ color: task.completed ? palette.mutedText : palette.text }}
              >
                {task.title || "Untitled"}
              </div>
            </div>

            {!isUntimed ? (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onUnscheduleTask(task.id);
                }}
                className="rounded-lg p-1 text-[#A8B2C0] transition-colors hover:bg-white/10 hover:text-[#F7F7F8]"
                title="リストに戻す"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        )}

        {!isUntimed && !isTimed ? (
          <div className="mt-auto flex items-center justify-end">
            <button
              onClick={(event) => {
                event.stopPropagation();
                onToggleTaskComplete(task.id);
              }}
              className={clsx(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold transition-colors",
                task.completed
                  ? "border-transparent bg-white/15 text-[#F7F7F8] hover:bg-white/20"
                  : "border-transparent bg-white/10 text-[#A7B0BA] hover:bg-white/15 hover:text-[#F7F7F8]"
              )}
            >
              {task.completed ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              {task.completed ? "Done" : "Complete"}
            </button>
          </div>
        ) : null}

        {isTimed ? (
          <>
            <button
              type="button"
              aria-label="開始時刻を調整"
              onPointerDown={(event) => startResize(event, "top")}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              className="absolute inset-x-0 top-0 h-2 cursor-ns-resize appearance-none border-0 bg-transparent p-0 opacity-0 outline-none focus:outline-none focus-visible:outline-none"
            />
            <button
              type="button"
              aria-label="時間を伸縮"
              onPointerDown={(event) => startResize(event, "bottom")}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize appearance-none border-0 bg-transparent p-0 opacity-0 outline-none focus:outline-none focus-visible:outline-none"
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
