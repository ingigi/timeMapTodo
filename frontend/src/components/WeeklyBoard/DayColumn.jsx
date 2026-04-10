import { useState } from "react";
import AssignedBlock from "./AssignedBlock";
import { getDeadlinePalette, getTaskPalette } from "../../utils/taskColors";
import { hasTaskAssignmentOnDate } from "../../utils/taskTime";
import { getCurrentDrag } from "../../utils/dragState";

export default function DayColumn({
  dateKey,
  dayName,
  dateNum,
  monthLabel,
  isToday,
  assignments,
  tasks,
  hoveredTaskId,
  hoveredTaskDeadline,
  onAddAssignmentFromSidebar,
  onDeleteAssignment,
  onMoveAssignment,
  onToggleAssignmentComplete,
  onHoverTask,
  onOpenDetail
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDropBlocked, setIsDropBlocked] = useState(false);
  const [dragColor, setDragColor] = useState(null);
  const isDeadlineDay = hoveredTaskDeadline === dateKey;
  const deadlinePalette = getDeadlinePalette();
  const dropPalette = getTaskPalette(dragColor);
  const blockedStyle = {
    boxShadow: "inset 0 0 0 3px #cbd5e1",
    backgroundColor: "#f8fafc"
  };

  const readDragPayload = (event) => {
    const rawText = event.dataTransfer.getData("text/plain");
    if (rawText) {
      try {
        const parsed = JSON.parse(rawText);
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      } catch {
        // fallback to individual fields below
      }
    }

    const cached = getCurrentDrag();
    if (cached) {
      return cached;
    }

    return {
      taskId:
        event.dataTransfer.getData("taskId") ||
        event.dataTransfer.getData("application/x-task-id") ||
        rawText ||
        "",
      assignmentId: event.dataTransfer.getData("assignmentId") || event.dataTransfer.getData("application/x-assignment-id") || null,
      sourceDayIdx: event.dataTransfer.getData("sourceDayIdx") || event.dataTransfer.getData("application/x-source-day") || "",
      dragType: event.dataTransfer.getData("dragType") || event.dataTransfer.getData("application/x-drag-type") || ""
    };
  };

  return (
    <div
      className="flex min-w-[160px] flex-1 flex-col overflow-hidden border border-slate-200 bg-white"
    >
      <div
        className="sticky top-0 z-20 border-b border-slate-100 bg-white p-3 text-center transition-colors"
        style={{
          ...(isDropBlocked ? blockedStyle : {}),
          ...(isDeadlineDay
            ? {
                backgroundColor: deadlinePalette.surface,
                borderBottomColor: deadlinePalette.border,
                boxShadow: `inset 0 -1px 0 ${deadlinePalette.border}, inset 0 0 0 1px ${deadlinePalette.border}`
              }
            : {})
        }}
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
          <div className="inline-block rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500">Tasks {assignments.length}</div>
        </div>
      </div>

      <div
        style={{
          ...(isDropBlocked
            ? blockedStyle
            : {}),
          ...(isDragOver && !isDropBlocked
            ? {
                boxShadow: `inset 0 0 0 3px ${dropPalette.borderStrong}`,
                backgroundColor: dropPalette.surfaceStrong
              }
            : {})
        }}
        className={`relative min-h-[600px] w-full flex-1 transition-all ${isDropBlocked ? "bg-slate-100" : "bg-white"}`}
        onDragOver={(event) => {
          event.preventDefault();
          const payload = readDragPayload(event);
          const taskId = payload.taskId || "";
          const assignmentId = payload.assignmentId || null;
          const isMoveDrag = payload.dragType === "move" || Boolean(assignmentId);
          const blocked = taskId ? hasTaskAssignmentOnDate({ [dateKey]: assignments }, dateKey, taskId, isMoveDrag ? assignmentId : null) : false;

          if (!isDragOver) setIsDragOver(true);
          setIsDropBlocked(blocked);
          setDragColor(event.dataTransfer.getData("dragColor") || "#94a3b8");
          event.dataTransfer.dropEffect = isMoveDrag ? "move" : "copy";
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsDragOver(false);
            setIsDropBlocked(false);
            setDragColor(null);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          const payload = readDragPayload(event);
          const taskId = payload.taskId || "";
          const sourceDayIdxData = payload.sourceDayIdx || "";
          const assignmentId = payload.assignmentId || null;
          const isMoveDrag = payload.dragType === "move" || Boolean(assignmentId);
          if (isDropBlocked) {
            setIsDragOver(false);
            setIsDropBlocked(false);
            setDragColor(null);
            return;
          }
          setIsDragOver(false);
          setIsDropBlocked(false);
          setDragColor(null);

          if (taskId && !isMoveDrag) {
            onAddAssignmentFromSidebar(taskId, dateKey);
          } else if (sourceDayIdxData && assignmentId) {
            onMoveAssignment(sourceDayIdxData, dateKey, assignmentId);
          }
        }}
      >
        <div className="relative z-10 flex h-full w-full flex-col p-1">
          {assignments.map((assignment) => {
            const task = tasks.find((item) => item.id === assignment.taskId);
            return (
              <AssignedBlock
                key={assignment.id}
                assignment={assignment}
                task={task}
                isRelated={hoveredTaskId === assignment.taskId}
                onDelete={onDeleteAssignment}
                onToggleComplete={onToggleAssignmentComplete}
                onHoverTask={onHoverTask}
                onOpenDetail={onOpenDetail}
                sourceDayIdx={dateKey}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
