import { useRef, useState } from "react";
import clsx from "clsx";
import { Minus, Plus, X } from "lucide-react";
import { attachDragPreview } from "../../utils/dragPreview";

function MonthlyAssignmentCard({
  assignment,
  task,
  dateKey,
  isRelated,
  onDeleteAssignment,
  onQuickAdjust,
  onHoverTask
}) {
  const dragCleanupRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!task) return null;

  return (
    <div
      draggable
      onMouseEnter={() => onHoverTask(task.id)}
      onMouseLeave={() => onHoverTask(null)}
      onDragStart={(e) => {
        setIsDragging(true);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("sourceDayIdx", dateKey);
        e.dataTransfer.setData("assignmentId", assignment.id);
        e.dataTransfer.setData("dragType", "all");
        e.dataTransfer.setData("dragDuration", String(assignment.duration));
        e.dataTransfer.setData("dragTitle", task.title || "タスク");
        e.dataTransfer.setData("dragColor", task.color || "#94a3b8");
        dragCleanupRef.current = attachDragPreview(e, {
          title: task.title || "タスク",
          duration: assignment.duration,
          color: task.color || "#94a3b8"
        });
      }}
      onDragEnd={() => {
        setIsDragging(false);
        dragCleanupRef.current?.();
        dragCleanupRef.current = null;
      }}
      className={clsx(
        "group relative flex min-h-[5.5rem] items-start overflow-hidden rounded-2xl border bg-white p-2 transition-all",
        isDragging && "scale-[0.98] opacity-55",
        isRelated
          ? "border-blue-400 shadow-[0_12px_28px_rgba(37,99,235,0.18)] ring-2 ring-blue-100"
          : "border-slate-200 shadow-sm"
      )}
      style={{ borderLeft: `3px solid ${task.color}` }}
    >
      <div className="absolute left-2.5 top-2.5">
        <div className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-[0.14em] text-white" style={{ backgroundColor: task.color || "#94a3b8" }}>
          SLICE
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col pt-7">
        <div className="mb-2 break-words text-[13px] font-black leading-snug text-slate-800">
          {task.title || "無題"}
        </div>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">この日へ配置</div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="text-lg font-black leading-none text-slate-900">{assignment.duration}</span>
              <span className="text-[10px] font-bold leading-none text-slate-400">h</span>
            </div>
            <div className="mt-1 text-[9px] font-medium text-slate-400">元タスクの残り {task.remainingTime.toFixed(1)}h</div>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-slate-100 bg-slate-50 p-1">
            <button
              onClick={() => onQuickAdjust(dateKey, assignment.id, -1)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white hover:text-red-600"
              title="1時間減らす"
            >
              <Minus className="h-3 w-3" />
            </button>
            <button
              onClick={() => onQuickAdjust(dateKey, assignment.id, 1)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white hover:text-blue-600"
              title="1時間増やす"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDeleteAssignment(dateKey, assignment.id);
        }}
        className="absolute right-2 top-2 z-20 rounded-full border border-slate-100 bg-white/90 p-1 shadow-sm transition-opacity hover:bg-red-50 hover:text-red-600"
        title="削除"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

export default function MonthlyDay({
  dateObj,
  assignments,
  tasks,
  hoveredTaskId,
  onAddAssignmentFromSidebar,
  onDeleteAssignment,
  onMoveAssignment,
  onQuickAdjust,
  onHoverTask
}) {
  const isToday = dateObj.isToday;
  const isCurrentMonth = dateObj.isCurrentMonth;
  const [isDragOver, setIsDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const totalAssignedDuration = assignments.reduce((sum, assignment) => sum + assignment.duration, 0);

  const updatePreview = (dataTransfer) => {
    const dragDuration = Number(dataTransfer.getData("dragDuration") || 1);
    const dragTitle = dataTransfer.getData("dragTitle") || "タスク";
    const dragColor = dataTransfer.getData("dragColor") || "#94a3b8";
    const sourceDayIdx = dataTransfer.getData("sourceDayIdx");
    const isSameDayMove = sourceDayIdx === dateObj.dateKey;
    const nextTotal = isSameDayMove ? totalAssignedDuration : totalAssignedDuration + dragDuration;
    setPreview({ duration: dragDuration, title: dragTitle, color: dragColor, nextTotal });
  };

  return (
    <div
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
        const dragType = e.dataTransfer.getData("dragType");

        if (taskId && dragType === "new") {
          onAddAssignmentFromSidebar(taskId, dateObj.dateKey);
        } else if (sourceDayIdxData && assignmentId) {
          onMoveAssignment(sourceDayIdxData, dateObj.dateKey, assignmentId, dragType || "all");
        }
      }}
      className={`relative flex h-full min-h-[120px] flex-col overflow-hidden bg-white p-2 transition-colors ${
        !isCurrentMonth ? "bg-slate-50/50" : ""
      } ${isDragOver ? "bg-blue-50 ring-2 ring-inset ring-blue-400" : ""}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              isToday ? "bg-blue-600 text-white" : !isCurrentMonth ? "text-slate-400" : "text-slate-800"
            }`}
          >
            {dateObj.dateNum}
          </div>
          <div className="pt-1 text-[10px] font-semibold text-slate-400">合計 {totalAssignedDuration}h</div>
        </div>
        <div className="text-xs font-medium text-slate-400">{isToday && "今日"}</div>
      </div>

      {preview && (
        <div className="pointer-events-none absolute inset-x-2 top-11 z-20 rounded-2xl border border-dashed border-blue-300 bg-white/92 p-2 shadow-sm backdrop-blur-sm">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-blue-500">Time Slice Preview</div>
          <div className="truncate text-[11px] font-semibold text-slate-700">{preview.title}</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium text-slate-500">+{preview.duration}h を配置</span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: preview.color }}>
              合計 {preview.nextTotal}h
            </span>
          </div>
        </div>
      )}

      <div className={`flex flex-1 flex-col gap-1 pr-0.5 pb-1 ${preview ? "pt-[4.5rem]" : ""}`}>
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
              onQuickAdjust={onQuickAdjust}
              onHoverTask={onHoverTask}
            />
          );
        })}
      </div>
    </div>
  );
}
