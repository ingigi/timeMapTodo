import { getMonthDates } from "../../utils/dateUtils";
import MonthlyDay from "./MonthlyDay";

export default function MonthlyBoard({
  baseDate,
  boardState,
  tasks,
  onQuickAdjust
}) {
  const dates = getMonthDates(baseDate);
  const DAYS_OF_WEEK = ['月', '火', '水', '木', '金', '土', '日'];

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="grid grid-cols-7 gap-px border-b border-r border-l border-slate-200 bg-slate-200 shrink-0">
        {DAYS_OF_WEEK.map((dayName, i) => (
          <div key={i} className="bg-white py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
            {dayName}
          </div>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-7 gap-px bg-slate-200 border-r border-l border-b border-slate-200 overflow-y-auto">
        {dates.map((dateObj, i) => {
          const assignments = boardState[dateObj.dateKey] || [];
          return (
            <MonthlyDay
              key={`${dateObj.dateKey}-${i}`}
              dateObj={dateObj}
              assignments={assignments}
              tasks={tasks}
              onQuickAdjust={onQuickAdjust}
            />
          );
        })}
      </div>
    </div>
  );
}
