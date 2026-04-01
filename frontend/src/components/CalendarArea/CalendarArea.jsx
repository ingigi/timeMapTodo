import { ChevronLeft, ChevronRight } from "lucide-react";
import WeeklyBoard from "../WeeklyBoard/WeeklyBoard";
import MonthlyBoard from "../MonthlyBoard/MonthlyBoard";
import { addWeeks, subWeeks, addMonths, subMonths, startOfWeek } from "../../utils/dateUtils";

export default function CalendarArea({
  baseDate,
  viewType,
  setBaseDate,
  setViewType,
  boardState,
  tasks,
  selectedTask,
  onAddAssignment,
  onAddAssignmentFromSidebar,
  onDeleteAssignment,
  onMoveAssignment,
  onQuickAdjust
}) {
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
      return `${baseDate.getFullYear()}年 ${baseDate.getMonth() + 1}月`;
    }

    const start = startOfWeek(baseDate);
    const end = addWeeks(start, 1);
    end.setDate(end.getDate() - 1);
    const startStr = `${start.getMonth() + 1}月${start.getDate()}日`;
    const endStr = `${end.getMonth() + 1}月${end.getDate()}日`;
    return `${startStr} - ${endStr}`;
  };

  return (
    <div className="relative flex h-full flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-md bg-slate-100 p-1">
            <button
              onClick={() => setViewType("week")}
              className={`rounded px-3 py-1 text-sm font-semibold ${viewType === "week" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              週
            </button>
            <button
              onClick={() => setViewType("month")}
              className={`rounded px-3 py-1 text-sm font-semibold ${viewType === "month" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              月
            </button>
          </div>

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
            selectedTask={selectedTask}
            onAddAssignment={onAddAssignment}
            onAddAssignmentFromSidebar={onAddAssignmentFromSidebar}
            onDeleteAssignment={onDeleteAssignment}
            onMoveAssignment={onMoveAssignment}
            onQuickAdjust={onQuickAdjust}
          />
        ) : (
          <MonthlyBoard
            baseDate={baseDate}
            boardState={boardState}
            tasks={tasks}
            onAddAssignmentFromSidebar={onAddAssignmentFromSidebar}
            onDeleteAssignment={onDeleteAssignment}
            onMoveAssignment={onMoveAssignment}
            onQuickAdjust={onQuickAdjust}
          />
        )}
      </div>
    </div>
  );
}
