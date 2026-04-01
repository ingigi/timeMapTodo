import { useState } from "react";
import AssignedBlock from "./AssignedBlock";

export default function DayColumn({
  dateKey,
  dayName,
  dateNum,
  isToday,
  assignments,
  tasks,
  onAddAssignment,
  onAddAssignmentFromSidebar,
  onDeleteAssignment,
  onMoveAssignment,
  onQuickAdjust
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const totalAssignedDuration = assignments.reduce((sum, assignment) => sum + assignment.duration, 0);

  const updatePreview = (dataTransfer) => {
    const dragDuration = Number(dataTransfer.getData("dragDuration") || 1);
    const dragTitle = dataTransfer.getData("dragTitle") || "タスク";
    const dragColor = dataTransfer.getData("dragColor") || "#94a3b8";
    const sourceDayIdx = dataTransfer.getData("sourceDayIdx");
    const isSameDayMove = sourceDayIdx === dateKey;
    const nextTotal = isSameDayMove ? totalAssignedDuration : totalAssignedDuration + dragDuration;

    setPreview({
      duration: dragDuration,
      title: dragTitle,
      color: dragColor,
      nextTotal
    });
  };

  return (
    <div className="flex min-w-[140px] flex-1 flex-col border-r border-slate-200">
      <div className="sticky top-0 z-20 border-b border-slate-100 bg-white p-2 text-center">
        <div className={`text-[10px] font-bold uppercase tracking-tighter ${isToday ? "text-blue-600" : "text-slate-400"}`}>
          {dayName}
        </div>
        <div className="mt-1 flex items-center justify-center gap-2">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${isToday ? "bg-blue-600 text-white" : "text-slate-700"}`}>
            {dateNum}
          </div>
          <div className="inline-block rounded px-1 text-[10px] font-semibold text-slate-400">
            合計 {totalAssignedDuration}h
          </div>
        </div>
      </div>

      <div
        className={`relative min-h-[600px] w-full flex-1 bg-white transition-colors ${isDragOver ? "bg-blue-50/50" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDragOver) setIsDragOver(true);
          updatePreview(e.dataTransfer);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsDragOver(false);
            setPreview(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          setPreview(null);
          const taskId = e.dataTransfer.getData("taskId");
          const sourceDayIdxData = e.dataTransfer.getData("sourceDayIdx");
          const assignmentId = e.dataTransfer.getData("assignmentId");
          const dragType = e.dataTransfer.getData("dragType") || "all";

          if (taskId && dragType === "new") {
            onAddAssignmentFromSidebar(taskId, dateKey);
          } else if (sourceDayIdxData && assignmentId) {
            onMoveAssignment(sourceDayIdxData, dateKey, assignmentId, dragType);
          }
        }}
      >
        {preview && (
          <div className="pointer-events-none absolute inset-x-2 top-3 z-20 rounded-2xl border border-dashed border-blue-300 bg-white/92 p-3 shadow-lg backdrop-blur-sm">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-blue-500">Preview</div>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-slate-700">{preview.title}</div>
                <div className="mt-1 text-[11px] font-medium text-slate-500">+{preview.duration}h を割り当て</div>
              </div>
              <div
                className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
                style={{ backgroundColor: preview.color }}
              >
                合計 {preview.nextTotal}h
              </div>
            </div>
          </div>
        )}

        <div className="relative z-10 flex h-full w-full flex-col p-0.5">
          {assignments.map((assignment) => {
            const task = tasks.find((item) => item.id === assignment.taskId);
            return (
              <AssignedBlock
                key={assignment.id}
                assignment={assignment}
                task={task}
                onDelete={onDeleteAssignment}
                onQuickAdjust={onQuickAdjust}
                sourceDayIdx={dateKey}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
