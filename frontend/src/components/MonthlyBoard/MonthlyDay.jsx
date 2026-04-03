import { useRef, useState } from "react";
import clsx from "clsx";
import { Check, RotateCcw, X } from "lucide-react";
import { attachDragPreview } from "../../utils/dragPreview";
import { getTaskPalette } from "../../utils/taskColors";

function MonthlyAssignmentCard({
  assignment,
  task,
  dateKey,
  isRelated,
  onDeleteAssignment,
  onToggleAssignmentComplete,
  onHoverTask,
  onOpenDetail
}) {
  const dragCleanupRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!task) return null;
  const palette = getTaskPalette(task.color);

  return (
    <div
      draggable
      onMouseEnter={() => onHoverTask(task.id)}
      onMouseLeave={() => onHoverTask(null)}
      onClick={() => onOpenDetail(task.id)}
      onDragStart={(event) => {
        setIsDragging(true);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("sourceDayIdx", dateKey);
        event.dataTransfer.setData("assignmentId", assignment.id);
        event.dataTransfer.setData("dragType", "move");
        event.dataTransfer.setData("dragTitle", task.title || "Task");
        event.dataTransfer.setData("dragColor", task.color || "#94a3b8");
        dragCleanupRef.current = attachDragPreview(event, {
          title: task.title || "Task",
          color: task.color || "#94a3b8"
        });
      }}
      onDragEnd={() => {
        setIsDragging(false);
        dragCleanupRef.current?.();
        dragCleanupRef.current = null;
      }}
      style={{
        borderColor: assignment.completed ? palette.completedBorder : isRelated ? palette.borderStrong : palette.border,
        backgroundColor: assignment.completed ? palette.completedSurface : isRelated ? palette.surfaceStrong : palette.surface,
        boxShadow: isRelated ? `0 8px 20px ${palette.shadow}` : "0 1px 2px rgba(15, 23, 42, 0.06)"
      }}
      className={clsx(
        "relative flex min-h-[118px] cursor-pointer select-none flex-col justify-between overflow-hidden rounded-2xl border p-2.5 transition-all",
        isDragging && "scale-[0.99] opacity-60",
        assignment.completed && "opacity-75"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={clsx("min-w-0 flex-1 break-words text-[13px] font-semibold leading-5 text-slate-900", assignment.completed && "line-through")} style={assignment.completed ? { color: palette.mutedText } : undefined}>
          {task.title || "Untitled"}
        </div>

        <button
          onClick={(event) => {
            event.stopPropagation();
            onDeleteAssignment(dateKey, assignment.id);
          }}
          className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          title="削除"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="h-1.5 w-10 rounded-full" style={{ backgroundColor: palette.base }} />

        <button
          onClick={(event) => {
            event.stopPropagation();
            onToggleAssignmentComplete(dateKey, assignment.id);
          }}
          className={clsx(
            "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium transition-colors",
            assignment.completed
              ? "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
              : "border-slate-200 bg-white/80 text-slate-700 hover:bg-white"
          )}
        >
          {assignment.completed ? <RotateCcw className="h-3 w-3" /> : <Check className="h-3 w-3" />}
          {assignment.completed ? "戻す" : "完了"}
        </button>
      </div>
    </div>
  );
}

export default function MonthlyDay({
  dateObj,
  assignments,
  tasks,
  hoveredTaskId,
  hoveredTaskDeadline,
  hoveredTaskColor,
  onAddAssignmentFromSidebar,
  onDeleteAssignment,
  onMoveAssignment,
  onToggleAssignmentComplete,
  onHoverTask,
  onOpenDetail
}) {
  const isToday = dateObj.isToday;
  const isCurrentMonth = dateObj.isCurrentMonth;
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragColor, setDragColor] = useState(null);
  const isDeadlineDay = hoveredTaskDeadline === dateObj.dateKey;
  const deadlinePalette = getTaskPalette(hoveredTaskColor);
  const dropPalette = getTaskPalette(dragColor);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!isDragOver) setIsDragOver(true);
        setDragColor(event.dataTransfer.getData("dragColor") || "#94a3b8");
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsDragOver(false);
          setDragColor(null);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        setDragColor(null);
        const taskId = event.dataTransfer.getData("taskId");
        const sourceDayIdxData = event.dataTransfer.getData("sourceDayIdx");
        const assignmentId = event.dataTransfer.getData("assignmentId");
        const dragType = event.dataTransfer.getData("dragType");

        if (taskId && dragType === "new") {
          onAddAssignmentFromSidebar(taskId, dateObj.dateKey);
        } else if (sourceDayIdxData && assignmentId) {
          onMoveAssignment(sourceDayIdxData, dateObj.dateKey, assignmentId);
        }
      }}
      style={{
        ...(isDeadlineDay
          ? {
              boxShadow: `inset 0 0 0 1.5px ${deadlinePalette.deadlineBorder}`,
              backgroundColor: deadlinePalette.deadlineSurface
            }
          : {}),
        ...(isDragOver
          ? {
              boxShadow: `inset 0 0 0 3px ${dropPalette.borderStrong}`,
              backgroundColor: dropPalette.surfaceStrong
            }
          : {})
      }}
      className={`relative flex h-full min-h-[120px] flex-col overflow-hidden bg-white p-2 transition-all ${
        !isCurrentMonth ? "bg-slate-50/50" : ""
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${isToday ? "bg-blue-600 text-white" : !isCurrentMonth ? "text-slate-400" : "text-slate-800"}`}
            style={isDeadlineDay && !isToday ? { backgroundColor: deadlinePalette.badgeStrong, color: deadlinePalette.text } : undefined}
          >
            {dateObj.dateNum}
          </div>
          <div className="pt-1 text-[10px] font-medium text-slate-400">Tasks {assignments.length}</div>
        </div>
        <div className="text-xs font-medium text-slate-400">{isToday ? "今日" : ""}</div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 pb-1 pr-0.5">
        {assignments.map((assignment) => {
          const task = tasks.find((item) => item.id === assignment.taskId);
          return (
            <MonthlyAssignmentCard
              key={assignment.id}
              assignment={assignment}
              task={task}
              dateKey={dateObj.dateKey}
              isRelated={hoveredTaskId === assignment.taskId}
              onDeleteAssignment={onDeleteAssignment}
              onToggleAssignmentComplete={onToggleAssignmentComplete}
              onHoverTask={onHoverTask}
              onOpenDetail={onOpenDetail}
            />
          );
        })}
      </div>
    </div>
  );
}
