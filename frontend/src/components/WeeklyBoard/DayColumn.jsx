import { useState } from "react";
import AssignedBlock from "./AssignedBlock";
import { getTaskPalette } from "../../utils/taskColors";

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
  hoveredTaskColor,
  onAddAssignmentFromSidebar,
  onDeleteAssignment,
  onMoveAssignment,
  onToggleAssignmentComplete,
  onHoverTask,
  onOpenDetail
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragColor, setDragColor] = useState(null);
  const isDeadlineDay = hoveredTaskDeadline === dateKey;
  const deadlinePalette = getTaskPalette(hoveredTaskColor);
  const dropPalette = getTaskPalette(dragColor);

  return (
    <div
      className="flex min-w-[160px] flex-1 flex-col border-r border-slate-200"
      style={isDeadlineDay ? { backgroundColor: deadlinePalette.deadlineSurface } : undefined}
    >
      <div
        className="sticky top-0 z-20 border-b border-slate-100 bg-white p-3 text-center"
        style={isDeadlineDay ? { boxShadow: `inset 0 0 0 1.5px ${deadlinePalette.deadlineBorder}` } : undefined}
      >
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">{monthLabel}</div>
        <div className={`text-[10px] font-bold uppercase tracking-tighter ${isToday ? "text-blue-600" : "text-slate-400"}`}>{dayName}</div>
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
          ...(isDeadlineDay ? { boxShadow: `inset 0 0 0 1.5px ${deadlinePalette.deadlineBorder}` } : {}),
          ...(isDragOver
            ? {
                boxShadow: `inset 0 0 0 3px ${dropPalette.borderStrong}`,
                backgroundColor: dropPalette.surfaceStrong
              }
            : {})
        }}
        className="relative min-h-[600px] w-full flex-1 bg-white transition-all"
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
          const dragType = event.dataTransfer.getData("dragType") || "move";

          if (taskId && dragType === "new") {
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
