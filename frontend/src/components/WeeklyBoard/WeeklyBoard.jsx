import { getWeekDates } from "../../utils/dateUtils";
import DayColumn from "./DayColumn";

export default function WeeklyBoard({
  baseDate,
  boardState,
  tasks,
  hoveredTaskId,
  onAddAssignmentFromSidebar,
  onDeleteAssignment,
  onMoveAssignment,
  onQuickAdjust,
  onHoverTask
}) {
  const dates = getWeekDates(baseDate);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden border-t border-slate-200 bg-slate-50">
      <div className="custom-scrollbar flex w-full flex-1 overflow-y-auto">
        <div className="flex min-w-full divide-x divide-slate-200">
          {dates.map((day) => {
            const assignments = boardState[day.dateKey] || [];

            return (
              <DayColumn
                key={day.dateKey}
                dateKey={day.dateKey}
                dayName={day.dayName}
                dateNum={day.dateNum}
                isToday={day.isToday}
                assignments={assignments}
                tasks={tasks}
                hoveredTaskId={hoveredTaskId}
                onAddAssignmentFromSidebar={onAddAssignmentFromSidebar}
                onDeleteAssignment={(assignmentId) => onDeleteAssignment(day.dateKey, assignmentId)}
                onMoveAssignment={onMoveAssignment}
                onQuickAdjust={onQuickAdjust}
                onHoverTask={onHoverTask}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
