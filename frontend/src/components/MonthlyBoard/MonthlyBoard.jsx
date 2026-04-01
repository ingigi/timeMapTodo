import { getMonthDates } from "../../utils/dateUtils";
import MonthlyDay from "./MonthlyDay";

export default function MonthlyBoard({
  baseDate,
  boardState,
  tasks,
  onAddAssignmentFromSidebar,
  onDeleteAssignment,
  onMoveAssignment,
  onQuickAdjust
}) {
  const dates = getMonthDates(baseDate);
  const daysOfWeek = ["月", "火", "水", "木", "金", "土", "日"];
  const weeks = [];

  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7));
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="grid grid-cols-7 shrink-0 gap-px border-b border-r border-l border-slate-200 bg-slate-200">
        {daysOfWeek.map((dayName) => (
          <div
            key={dayName}
            className="bg-white py-2 text-center text-xs font-bold tracking-wider text-slate-500"
          >
            {dayName}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto border-r border-l border-b border-slate-200 bg-slate-200 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex min-h-full flex-col gap-px bg-slate-200">
          {weeks.map((week, weekIndex) => (
            <div
              key={`week-${weekIndex}`}
              className="grid min-h-[120px] flex-1 grid-cols-7 items-stretch gap-px bg-slate-200"
            >
              {week.map((dateObj, dayIndex) => {
                const assignments = boardState[dateObj.dateKey] || [];

                return (
                  <MonthlyDay
                    key={`${dateObj.dateKey}-${weekIndex}-${dayIndex}`}
                    dateObj={dateObj}
                    assignments={assignments}
                    tasks={tasks}
                    onAddAssignmentFromSidebar={onAddAssignmentFromSidebar}
                    onDeleteAssignment={onDeleteAssignment}
                    onMoveAssignment={onMoveAssignment}
                    onQuickAdjust={onQuickAdjust}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
