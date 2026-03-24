import { X, GripHorizontal, CheckCircle2 } from "lucide-react";

export default function AssignedBlock({
  assignment,
  task,
  onDelete,
  onResizeStart,
  onCompleteResizeStart,
  sourceDayIdx
}) {
  if (!task) return null;

  return (
    <div 
      className="w-full px-1 py-0.5"
      style={{ height: `${assignment.duration * 4}rem` }}
    >
      <div className="relative group w-full h-full border border-black/10 shadow-sm rounded-md transition-all select-none overflow-hidden hover:brightness-110">
        {/* Top Part: Completed (Non-draggable) */}
        {((assignment.completedDuration || 0) > 0) && (
          <div
            className="absolute top-0 left-0 w-full hover:brightness-110 cursor-default"
            style={{ 
              height: `${(assignment.completedDuration / assignment.duration) * 100}%`,
              backgroundColor: task.color || '#94a3b8',
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.15) 10px, rgba(0,0,0,0.15) 20px)'
            }}
          />
        )}

        {/* Bottom Part: Incomplete Drag Handle */}
        {((assignment.completedDuration || 0) < assignment.duration) && (
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('sourceDayIdx', sourceDayIdx);
              e.dataTransfer.setData('assignmentId', assignment.id);
              e.dataTransfer.setData('dragType', (assignment.completedDuration || 0) === 0 ? 'all' : 'incomplete');
            }}
            className="absolute bottom-0 left-0 w-full cursor-grab active:cursor-grabbing"
            style={{ 
              height: `${(1 - (assignment.completedDuration || 0) / assignment.duration) * 100}%`,
              backgroundColor: task.color || '#94a3b8'
            }}
          />
        )}

        <div className="relative z-10 pointer-events-none text-white font-medium text-xs p-2 truncate flex items-start justify-between h-full bg-gradient-to-b from-black/10 to-transparent">
          <div className="flex flex-col drop-shadow-sm pointer-events-auto">
            <span className="font-bold">{task.title}</span>
            <span className="opacity-90">{assignment.completedDuration ? `${assignment.completedDuration}h / ` : ''}{assignment.duration}h</span>
          </div>
          
          <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center transition-opacity bg-black/20 rounded backdrop-blur-sm pointer-events-auto shadow-sm">
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(assignment.id); }}
              className="p-1.5 hover:bg-black/30 rounded transition-colors"
              title="削除"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Draggable Completion Boundary */}
        <div 
          className="absolute left-0 right-0 h-4 z-20 cursor-ns-resize"
          style={{ 
            top: `calc(${(assignment.completedDuration / assignment.duration) * 100}% - 8px)`,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onCompleteResizeStart(e, assignment.id);
          }}
          title="完了時間を調整"
        />

        <div 
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeStart(e, assignment.id);
          }}
          className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/20 transition-all"
        >
          <GripHorizontal className="h-3 w-3 text-white/70" />
        </div>
      </div>
    </div>
  );
}
