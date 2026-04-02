import { Filter, LayoutList, Plus, SortAsc, SortDesc } from "lucide-react";
import { useState } from "react";
import TaskCard from "./TaskCard";

function TaskNode({
  task,
  allTasks,
  boardState,
  selectedTaskId,
  hoveredTaskId,
  onToggleParent,
  onAdjustTime,
  onDeleteTask,
  onUpdateTaskTitle,
  onCreateInlineTask,
  onOpenDetail,
  onHoverTask,
  level = 0
}) {
  const children = allTasks.filter((item) => item.parentId === task.id);
  const hasChildren = children.length > 0;

  return (
    <div className="mb-2">
      <TaskCard
        task={task}
        allTasks={allTasks}
        boardState={boardState}
        isActive={selectedTaskId === task.id}
        isRelated={hoveredTaskId === task.id}
        onAdjustTime={onAdjustTime}
        onDelete={onDeleteTask}
        onToggleExpand={onToggleParent}
        onUpdateTitle={onUpdateTaskTitle}
        onAddSubtask={onCreateInlineTask}
        onOpenDetail={onOpenDetail}
        onHoverTask={onHoverTask}
      />
      {hasChildren && task.isExpanded && (
        <div className="ml-3 mt-2 space-y-2 border-l-2 border-slate-100 pl-4">
          {children.map((child) => (
            <TaskNode
              key={child.id}
              task={child}
              allTasks={allTasks}
              boardState={boardState}
              selectedTaskId={selectedTaskId}
              hoveredTaskId={hoveredTaskId}
              onToggleParent={onToggleParent}
              onAdjustTime={onAdjustTime}
              onDeleteTask={onDeleteTask}
              onUpdateTaskTitle={onUpdateTaskTitle}
              onCreateInlineTask={onCreateInlineTask}
              onOpenDetail={onOpenDetail}
              onHoverTask={onHoverTask}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TaskPool({
  tasks,
  allTasks,
  boardState,
  selectedTaskId,
  hoveredTaskId,
  onToggleParent,
  onAdjustTime,
  onCreateInlineTask,
  onDeleteTask,
  onUpdateTaskTitle,
  onOpenDetail,
  onHoverTask,
  filterConfig,
  setFilterConfig,
  sortConfig,
  setSortConfig
}) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const rootTasks = tasks.filter((task) => !task.parentId);
  const allTags = Array.from(new Set(allTasks.flatMap((task) => task.tags || [])));

  const toggleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc"
    }));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100">
            <LayoutList className="h-3.5 w-3.5 text-blue-700" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">時間の在庫棚</h2>
            <p className="text-xs text-slate-400">左の在庫から時間を切り出して、右に配置します</p>
          </div>
        </div>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          {tasks.length} tasks
        </span>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => onCreateInlineTask(null)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800"
        >
          <Plus className="h-4 w-4" />
          新規タスク
        </button>

        <div className="flex gap-1">
          <div className="relative">
            <button
              onClick={() => {
                setIsFilterOpen(!isFilterOpen);
                setIsSortOpen(false);
              }}
              className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            >
              <Filter className="h-4 w-4" />
            </button>
            {isFilterOpen && (
              <div className="absolute right-0 top-10 z-10 block w-40 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
                <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</div>
                {["all", "notstarted", "inprogress", "completed"].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setFilterConfig((prev) => ({ ...prev, status }));
                      setIsFilterOpen(false);
                    }}
                    className={`mb-1 w-full rounded px-2 py-1 text-left text-xs transition-colors ${
                      filterConfig.status === status ? "bg-blue-50 font-bold text-blue-700" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {status === "all" ? "All Status" : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
                <div className="my-2 border-t px-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Tags</div>
                <button
                  onClick={() => {
                    setFilterConfig((prev) => ({ ...prev, tag: "all" }));
                    setIsFilterOpen(false);
                  }}
                  className={`mb-1 w-full rounded px-2 py-1 text-left text-xs transition-colors ${
                    filterConfig.tag === "all" ? "bg-blue-50 font-bold text-blue-700" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  All Tags
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setFilterConfig((prev) => ({ ...prev, tag }));
                      setIsFilterOpen(false);
                    }}
                    className={`mb-1 w-full rounded px-2 py-1 text-left text-xs transition-colors ${
                      filterConfig.tag === tag ? "bg-blue-50 font-bold text-blue-700" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setIsSortOpen(!isSortOpen);
                setIsFilterOpen(false);
              }}
              className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            >
              {sortConfig.order === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            </button>
            {isSortOpen && (
              <div className="absolute right-0 top-10 z-10 block w-40 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
                <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Sort By</div>
                {[
                  { key: "deadline", label: "Deadline" },
                  { key: "remainingTime", label: "Remaining" },
                  { key: "title", label: "Name" },
                  { key: "status", label: "Status" }
                ].map((option) => (
                  <button
                    key={option.key}
                    onClick={() => {
                      toggleSort(option.key);
                      setIsSortOpen(false);
                    }}
                    className={`mb-1 w-full rounded px-2 py-1 text-left text-xs transition-colors ${
                      sortConfig.key === option.key ? "bg-blue-50 font-bold text-blue-700" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2 overflow-y-auto pr-2">
        {rootTasks.map((task) => (
          <TaskNode
            key={task.id}
            task={task}
            allTasks={allTasks}
            boardState={boardState}
            selectedTaskId={selectedTaskId}
            hoveredTaskId={hoveredTaskId}
            onToggleParent={onToggleParent}
            onAdjustTime={onAdjustTime}
            onDeleteTask={onDeleteTask}
            onUpdateTaskTitle={onUpdateTaskTitle}
            onCreateInlineTask={onCreateInlineTask}
            onOpenDetail={onOpenDetail}
            onHoverTask={onHoverTask}
          />
        ))}
      </div>
    </div>
  );
}
