import { useMemo } from "react";
import { addMonths, getMonthDates } from "../../utils/dateUtils";
import MonthlyDay from "./MonthlyDay";

function MonthSection({
  monthDate,
  boardState,
  tasks,
  hoveredTaskId,
  hoveredTaskDeadline,
  hoveredTaskColor,
  onAddAssignmentFromSidebar,
  onDeleteAssignment,
  onMoveAssignment,
  onToggleAssignmentComplete,
  onHoverTask,
  onOpenDetail
}) {
  const dates = getMonthDates(monthDate);
  const monthLabel = `${monthDate.getFullYear()}年 ${monthDate.getMonth() + 1}月`;
  const weeks = [];

  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7));
  }

  return (
    <section className="mb-8">
      <div className="sticky top-0 z-10 mb-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="text-sm font-semibold text-slate-900">{monthLabel}</div>
        <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Month View</div>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-2xl border border-slate-200 bg-slate-200">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => (
          <div key={`${monthLabel}-${dayName}`} className="bg-white py-2 text-center text-xs font-bold tracking-wider text-slate-500">
            {dayName}
          </div>
        ))}

        {weeks.map((week, weekIndex) =>
          week.map((dateObj, dayIndex) => {
            const assignments = boardState[dateObj.dateKey] || [];

            return (
              <MonthlyDay
                key={`${dateObj.dateKey}-${weekIndex}-${dayIndex}`}
                dateObj={dateObj}
                assignments={assignments}
                tasks={tasks}
                hoveredTaskId={hoveredTaskId}
                hoveredTaskDeadline={hoveredTaskDeadline}
                hoveredTaskColor={hoveredTaskColor}
                onAddAssignmentFromSidebar={onAddAssignmentFromSidebar}
                onDeleteAssignment={onDeleteAssignment}
                onMoveAssignment={onMoveAssignment}
                onToggleAssignmentComplete={onToggleAssignmentComplete}
                onHoverTask={onHoverTask}
                onOpenDetail={onOpenDetail}
              />
            );
          })
        )}
      </div>
    </section>
  );
}

export default function MonthlyBoard(props) {
  const months = useMemo(() => [addMonths(props.baseDate, -1), props.baseDate, addMonths(props.baseDate, 1)], [props.baseDate]);

  return (
    <div className="h-full select-none overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="pb-6">
        {months.map((monthDate) => (
          <MonthSection key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`} monthDate={monthDate} {...props} />
        ))}
      </div>
    </div>
  );
}
