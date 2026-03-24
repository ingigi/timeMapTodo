import clsx from "clsx";
import { Plus, Minus, Trash2, ChevronDown, ChevronRight } from "lucide-react";

export default function TaskCard({ 
  task, 
  allTasks = [],
  boardState = {},
  isActive, 
  onSelect, 
  onAdjustTime, 
  onDelete,
  onToggleExpand,
  onUpdateTitle,
  onAddSubtask,
  hasChildren,
  isExpanded,
  level = 0 
}) {
  const { title, category, color, totalTime } = task;
  
  let assignedTime = 0;
  let completedTime = 0;

  if (boardState && allTasks.length > 0) {
    const descendants = new Set();
    const collect = (id) => {
      descendants.add(id);
      allTasks.filter(t => t.parentId === id).forEach(child => collect(child.id));
    };
    collect(task.id);

    Object.values(boardState).flat().forEach(a => {
      if (descendants.has(a.taskId)) {
        assignedTime += a.duration;
        completedTime += (a.completedDuration || 0);
      }
    });
  }

  const unassignedTime = Math.max(0, totalTime - assignedTime);
  const percentCompleted = totalTime > 0 ? (completedTime / totalTime) * 100 : 0;
  const percentAssigned = totalTime > 0 ? ((assignedTime - completedTime) / totalTime) * 100 : 0;

  return (
    <div
      onClick={() => onSelect(task.id)}
      className={clsx(
        "cursor-pointer rounded-md bg-white p-3 shadow-sm border transition-all",
        isActive
          ? "border-2 opacity-100 ring-2 ring-opacity-50"
          : "border-slate-200 opacity-90 hover:opacity-100 hover:border-slate-300 hover:-translate-y-0.5"
      )}
      style={{
        borderLeft: `${level > 0 ? 4 : 6}px solid ${color}`,
        borderColor: isActive ? color : undefined,
      }}
    >
      <div className="mb-3 flex justify-between items-start group">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {hasChildren && (
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleExpand?.(task.id); }}
              className="mt-0.5 p-0.5 rounded hover:bg-slate-100 text-slate-500 transition-colors shrink-0"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div 
                className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 border border-black/10" 
                style={{ backgroundColor: color }} 
                title="タスクカラー"
              />
              <input
                type="text"
                value={title}
                onChange={(e) => onUpdateTitle(task.id, e.target.value)}
                className={clsx(
                  "font-semibold text-slate-800 bg-transparent outline-none w-full focus:ring-1 focus:ring-blue-400 rounded px-1 -ml-1 transition-colors hover:bg-slate-50 focus:bg-white", 
                  level > 0 ? "text-sm" : ""
                )}
                placeholder="タスク名を入力..."
                autoFocus={!title}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            {level === 0 && category && <p className="text-xs text-slate-500 mt-0.5 px-1 truncate ml-4">{category}</p>}
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-1 shrink-0 ml-2 -mt-1 -mr-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onAddSubtask(task.id); }}
            className="p-1 rounded text-slate-400 hover:text-blue-500 hover:bg-slate-100 transition-colors"
            title="サブタスクを追加"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-slate-100 transition-colors"
            title="タスクを削除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      
      <div>
        <div className="mb-2 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <span className="flex items-center gap-1" title="完了済み">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}></div>
                完了: <span className="text-slate-700 font-bold">{completedTime.toFixed(1)}h</span>
              </span>
              <span className="flex items-center gap-1" title="カレンダー配置済み（未完了）">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, opacity: 0.4 }}></div>
                配置: <span className="text-slate-700 font-bold">{(assignedTime - completedTime).toFixed(1)}h</span>
              </span>
              <span className="flex items-center gap-1" title="未配置（残り）">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                残り: <span className="text-slate-700 font-bold">{unassignedTime.toFixed(1)}h</span>
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-600 flex items-baseline gap-1">
              <span>合計</span>
              <span className="text-slate-800 text-sm">{totalTime.toFixed(1)}h</span>
              <span className="text-slate-400 font-normal">({Math.round(percentCompleted)}%)</span>
            </div>
            
            {/* Time Adjust Controls */}
            <div className="flex bg-slate-100 rounded border border-slate-200 items-center shrink-0">
              <button 
                onClick={(e) => { e.stopPropagation(); onAdjustTime(task.id, -1); }} 
                className="p-1 hover:bg-slate-200 transition-colors rounded-l text-slate-600"
                title="タスクの合計時間を1時間減らす"
              >
                <Minus className="w-3 h-3" />
              </button>
              <div className="w-px h-3 bg-slate-300"></div>
              <button 
                onClick={(e) => { e.stopPropagation(); onAdjustTime(task.id, 1); }} 
                className="p-1 hover:bg-slate-200 transition-colors rounded-r text-slate-600"
                title="タスクの合計時間を1時間増やす"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${percentCompleted}%`, backgroundColor: color }}
            title={`完了: ${completedTime}h`}
          ></div>
          <div
            className="h-full transition-all duration-300 opacity-40"
            style={{ width: `${percentAssigned}%`, backgroundColor: color }}
            title={`配置済み (未完了): ${assignedTime - completedTime}h`}
          ></div>
        </div>
      </div>
    </div>
  );
}
