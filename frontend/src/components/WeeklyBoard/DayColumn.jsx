import { useState } from "react";
import AssignedBlock from "./AssignedBlock";

export default function DayColumn({
  dateKey,
  dayName,
  dateNum,
  isToday,
  blocksCount,
  assignments, // array of { id, taskId, duration }
  tasks,
  onAddAssignment,
  onDeleteAssignment,
  onResizeStart,
  onCompleteResizeStart,
  onUpdateCapacity,
  onMoveAssignment
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const totalAssignedDuration = assignments.reduce((sum, a) => sum + a.duration, 0);
  
  return (
    <div className="flex flex-col flex-1 min-w-[120px]">
      <div className="mb-4 text-center">
        <div className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>{dayName}</div>
        <div className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold ${isToday ? 'bg-blue-600 text-white' : 'text-slate-800'}`}>
          {dateNum}
        </div>
        
        {isEditing ? (
          <div className="flex items-center justify-center mt-1">
            <span className="text-xs font-semibold text-slate-400 mr-1">{totalAssignedDuration}h /</span>
            <input 
              autoFocus
              type="number"
              min="0"
              max="24"
              defaultValue={blocksCount}
              onBlur={(e) => {
                setIsEditing(false);
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) onUpdateCapacity(val);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              className="w-10 text-xs px-1 py-0.5 text-center border border-blue-500 rounded outline-none text-slate-800"
            />
          </div>
        ) : (
          <div 
            onClick={() => setIsEditing(true)}
            className="text-xs font-semibold text-slate-400 mt-1 cursor-pointer hover:text-blue-600 transition-colors inline-block px-2 py-0.5 rounded hover:bg-slate-100"
            title="クリックして1日のキャパシティを編集"
          >
            {totalAssignedDuration}h / {blocksCount}h
          </div>
        )}
      </div>
      
      <div 
        className={`relative w-full bg-white border rounded-sm shadow-sm overflow-hidden transition-colors ${isDragOver ? 'border-2 border-dashed border-blue-400 bg-blue-50' : 'border border-slate-200'}`}
        style={{ height: `${blocksCount * 4}rem` }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDragOver) setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const sourceDayIdxData = e.dataTransfer.getData('sourceDayIdx');
          const assignmentId = e.dataTransfer.getData('assignmentId');
          const dragType = e.dataTransfer.getData('dragType') || 'all';
          if (sourceDayIdxData && assignmentId) {
            onMoveAssignment(sourceDayIdxData, dateKey, assignmentId, dragType);
          }
        }}
      >
        {/* Background Memory Grid (メモリ) */}
        <div className="absolute inset-0 flex flex-col pointer-events-none z-0">
          {Array.from({ length: blocksCount }).map((_, idx) => (
            <div key={idx} className="flex-1 w-full border-b border-dashed border-slate-200" />
          ))}
        </div>

        {/* Foreground Tasks */}
        <div className="relative z-10 flex flex-col w-full h-full">
          {assignments.map(assignment => {
            const task = tasks.find(t => t.id === assignment.taskId);
            return (
              <AssignedBlock
                key={assignment.id}
                assignment={assignment}
                task={task}
                onDelete={onDeleteAssignment}
                onResizeStart={onResizeStart}
                onCompleteResizeStart={onCompleteResizeStart}
                sourceDayIdx={dateKey}
              />
            );
          })}
          
          {/* Clickable empty space for adding new assignments */}
          {totalAssignedDuration < blocksCount && (
            <div 
              className="flex-1 w-full cursor-pointer transition-colors hover:bg-blue-50/30"
              onMouseDown={(e) => onAddAssignment(e)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
