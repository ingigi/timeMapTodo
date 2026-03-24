export default function MonthlyDay({
  dateObj,
  assignments,
  tasks,
  onQuickAdjust
}) {
  const isToday = dateObj.isToday;
  const isCurrentMonth = dateObj.isCurrentMonth;
  
  return (
    <div className={`bg-white p-2 flex flex-col min-h-[120px] transition-colors ${!isCurrentMonth ? 'bg-slate-50/50' : ''}`}>
      <div className="flex justify-between items-start mb-2">
        <div className={`w-7 h-7 flex flex-col items-center justify-center rounded-full text-sm font-semibold 
          ${isToday 
            ? 'bg-blue-600 text-white' 
            : !isCurrentMonth ? 'text-slate-400' : 'text-slate-800'}`}>
          {dateObj.dateNum}
        </div>
        <div className="text-xs font-medium text-slate-400">
          {isToday && "今日"}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {assignments.map(assignment => {
          const task = tasks.find(t => t.id === assignment.taskId);
          if (!task) return null;

          return (
            <div 
              key={assignment.id} 
              className="group flex flex-col rounded-md border p-1.5 text-xs relative"
              style={{
                backgroundColor: `${task.color}15`,
                borderColor: `${task.color}30`,
              }}
            >
              <div className="font-semibold truncate mb-1" style={{ color: task.color }}>
                {task.title || '無題のタスク'}
              </div>
              <div className="flex items-center justify-between mt-auto">
                <span className="font-medium text-slate-600">
                  {assignment.duration}h
                </span>
                
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex bg-white shadow-sm rounded-md border border-slate-200 overflow-hidden">
                  <button 
                    onClick={() => onQuickAdjust(dateObj.dateKey, assignment.id, -1)}
                    className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-red-500"
                    title="1時間減らす"
                  >
                    -
                  </button>
                  <div className="w-px bg-slate-200"></div>
                  <button 
                    onClick={() => onQuickAdjust(dateObj.dateKey, assignment.id, 1)}
                    className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-blue-500"
                    title="1時間増やす"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
