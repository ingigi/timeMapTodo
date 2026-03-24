import { ChevronDown, ChevronRight, LayoutList, Trash2 } from "lucide-react";
import TaskCard from "./TaskCard";

function TaskNode({ task, allTasks, boardState, selectedTaskId, onSelectTask, onToggleParent, onAdjustTime, onDeleteTask, onUpdateTaskTitle, onCreateInlineTask, level = 0 }) {
  const children = allTasks.filter(t => t.parentId === task.id);
  const hasChildren = children.length > 0;
  
  return (
    <div className="mb-2">
      <TaskCard 
         task={task} 
         allTasks={allTasks}
         boardState={boardState}
         isActive={selectedTaskId === task.id}
         onSelect={onSelectTask}
         onAdjustTime={onAdjustTime}
         onDelete={onDeleteTask}
         onToggleExpand={onToggleParent}
         onUpdateTitle={onUpdateTaskTitle}
         onAddSubtask={onCreateInlineTask}
         hasChildren={hasChildren}
         isExpanded={task.isExpanded}
         level={level}
      />
      {hasChildren && task.isExpanded && (
        <div className="pl-4 border-l-2 border-slate-100 mt-2 space-y-2 ml-3">
          {children.map(child => (
            <TaskNode 
              key={child.id} 
              task={child} 
              allTasks={allTasks} 
              boardState={boardState}
              selectedTaskId={selectedTaskId}
              onSelectTask={onSelectTask}
              onToggleParent={onToggleParent}
              onAdjustTime={onAdjustTime}
              onDeleteTask={onDeleteTask}
              onUpdateTaskTitle={onUpdateTaskTitle}
              onCreateInlineTask={onCreateInlineTask}
              level={level + 1} 
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TaskPool({ tasks, boardState, selectedTaskId, onSelectTask, onToggleParent, onAdjustTime, onCreateInlineTask, onDeleteTask, onUpdateTaskTitle }) {
  const rootTasks = tasks.filter(t => !t.parentId);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-100">
            <LayoutList className="text-blue-700 h-3 w-3" />
          </div>
          <h2 className="font-semibold text-slate-800">タスクプール</h2>
        </div>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          {tasks.filter(t => !t.isParent).length} タスク
        </span>
      </div>

      <button 
        onClick={() => onCreateInlineTask(null)}
        className="mb-6 flex w-full items-center justify-center rounded-md bg-blue-700 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 shadow-sm"
      >
        + 新規タスク
      </button>

      <div className="flex-1 overflow-y-auto pr-2 space-y-2">
        {rootTasks.map((task) => (
          <TaskNode 
             key={task.id} 
             task={task} 
             allTasks={tasks} 
             boardState={boardState}
             selectedTaskId={selectedTaskId}
             onSelectTask={onSelectTask}
             onToggleParent={onToggleParent}
             onAdjustTime={onAdjustTime}
             onDeleteTask={onDeleteTask}
             onUpdateTaskTitle={onUpdateTaskTitle}
             onCreateInlineTask={onCreateInlineTask}
          />
        ))}
      </div>
    </div>
  );
}
