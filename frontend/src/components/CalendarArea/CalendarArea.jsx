import { ChevronLeft, ChevronRight } from "lucide-react";
import WeeklyBoard from "../WeeklyBoard/WeeklyBoard";
import MonthlyBoard from "../MonthlyBoard/MonthlyBoard";
import { addMonths, addWeeks, startOfWeek, subMonths, subWeeks } from "../../utils/dateUtils";

export default function CalendarArea({
  baseDate,
  viewType,
  setBaseDate,
  setViewType,
  boardState,
  tasks,
  hoveredTaskId,
  onAddAssignmentFromSidebar,
  onDeleteAssignment,
  onMoveAssignment,
  onToggleAssignmentComplete,
  onHoverTask,
  onOpenDetail
}) {
  const hoveredTask = tasks.find((task) => task.id === hoveredTaskId) || null;

  const handlePrev = () => {
    setBaseDate((prev) => (viewType === "week" ? subWeeks(prev, 1) : subMonths(prev, 1)));
  };

  const handleNext = () => {
    setBaseDate((prev) => (viewType === "week" ? addWeeks(prev, 1) : addMonths(prev, 1)));
  };

  const handleToday = () => {
    setBaseDate(new Date());
  };

  const formattedDateRange = () => {
    if (viewType === "month") {
      return `${baseDate.getFullYear()} / ${baseDate.getMonth() + 1}`;
    }

    const start = startOfWeek(baseDate);
    const end = addWeeks(start, 1);
    end.setDate(end.getDate() - 1);
    return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()} を中心に表示`;
  };

  return (
    <div className="relative flex h-full flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setViewType("week")}
              className={`rounded-lg px-3 py-1 text-sm font-semibold ${viewType === "week" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Week
            </button>
            <button
              onClick={() => setViewType("month")}
              className={`rounded-lg px-3 py-1 text-sm font-semibold ${viewType === "month" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Month
            </button>
          </div>

          <button
            onClick={handleToday}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            今日
          </button>

          <div className="flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
            <button onClick={handlePrev} className="p-1 hover:text-blue-600">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="mx-2 cursor-pointer hover:text-blue-600" onClick={handleToday}>
              {formattedDateRange()}
            </span>
            <button onClick={handleNext} className="p-1 hover:text-blue-600">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {viewType === "week" ? (
          <WeeklyBoard
            baseDate={baseDate}
            boardState={boardState}
            tasks={tasks}
            hoveredTaskId={hoveredTaskId}
            hoveredTaskDeadline={hoveredTask?.deadline || null}
            hoveredTaskColor={hoveredTask?.color || null}
            onAddAssignmentFromSidebar={onAddAssignmentFromSidebar}
            onDeleteAssignment={onDeleteAssignment}
            onMoveAssignment={onMoveAssignment}
            onToggleAssignmentComplete={onToggleAssignmentComplete}
            onHoverTask={onHoverTask}
            onOpenDetail={onOpenDetail}
          />
        ) : (
          <MonthlyBoard
            baseDate={baseDate}
            boardState={boardState}
            tasks={tasks}
            hoveredTaskId={hoveredTaskId}
            hoveredTaskDeadline={hoveredTask?.deadline || null}
            hoveredTaskColor={hoveredTask?.color || null}
            onAddAssignmentFromSidebar={onAddAssignmentFromSidebar}
            onDeleteAssignment={onDeleteAssignment}
            onMoveAssignment={onMoveAssignment}
            onToggleAssignmentComplete={onToggleAssignmentComplete}
            onHoverTask={onHoverTask}
            onOpenDetail={onOpenDetail}
          />
        )}
      </div>
    </div>
  );
}
