import { useRef, useState } from "react";
import { X, Plus, Minus } from "lucide-react";
import { attachDragPreview } from "../../utils/dragPreview";

export default function AssignedBlock({
  assignment,
  task,
  onDelete,
  onResizeStart,
  onQuickAdjust,
  sourceDayIdx
}) {
  const dragCleanupRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!task) return null;

  return (
    <div className="w-full px-0.5 py-0.5">
      <div
        draggable
        onDragStart={(e) => {
          setIsDragging(true);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("sourceDayIdx", sourceDayIdx);
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
        className={`group relative flex min-h-[5.25rem] w-full cursor-grab select-none overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all active:cursor-grabbing hover:shadow-md ${isDragging ? "scale-[0.98] opacity-55" : "shadow-sm"}`}
        style={{
          borderLeft: `3px solid ${task.color || "#94a3b8"}`
        }}
      >
        <div className="absolute left-3 top-3">
          <div
            className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.16em] text-white"
            style={{ backgroundColor: task.color || "#94a3b8" }}
          >
            SLICE
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-3 pt-10">
          <div className="mb-2">
            <div className="text-[14px] font-black leading-snug text-slate-800 break-words">
              {task.title || "無題"}
            </div>
          </div>

          <div className="mt-auto flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Allocated</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-black leading-none text-slate-900">{assignment.duration}</span>
                <span className="text-sm font-bold leading-none text-slate-400">h</span>
              </div>
              <div className="mt-1 text-[10px] font-medium text-slate-400">
                残り {task.remainingTime.toFixed(1)}h
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-slate-100 bg-slate-50 p-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickAdjust(sourceDayIdx, assignment.id, -1);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-red-600"
                title="1時間減らす"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickAdjust(sourceDayIdx, assignment.id, 1);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-blue-600"
                title="1時間増やす"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(assignment.id);
          }}
          className="absolute right-2 top-2 z-20 rounded-full border border-slate-100 bg-white/90 p-1 shadow-sm transition-all hover:bg-red-50 hover:text-red-600"
          title="削除"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}
