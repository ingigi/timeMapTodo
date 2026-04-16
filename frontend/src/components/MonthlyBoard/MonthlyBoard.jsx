import { useEffect, useMemo, useRef, useState } from "react";
import { getMonthDates } from "../../utils/dateUtils";
import MonthlyDay from "./MonthlyDay";

const MONTH_WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

function MonthSection({
  monthDate,
  scheduledTasksByDate,
  tasks,
  hoveredTaskId,
  hoveredTaskDeadline,
  onScheduleTask,
  onUnscheduleTask,
  onMoveTask,
  onToggleTaskComplete,
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
      <div className="grid grid-cols-7 gap-px rounded-2xl border border-slate-200 bg-slate-200">
        {MONTH_WEEKDAY_LABELS.map((dayName) => (
          <div key={`${monthLabel}-${dayName}`} className="bg-white py-2 text-center text-xs font-bold tracking-wider text-slate-500">
            {dayName}
          </div>
        ))}

        {weeks.map((week, weekIndex) =>
          week.map((dateObj, dayIndex) => {
            const dayTasks = scheduledTasksByDate[dateObj.dateKey] || [];

            return (
              <MonthlyDay
                key={`${dateObj.dateKey}-${weekIndex}-${dayIndex}`}
                dateObj={dateObj}
                dayTasks={dayTasks}
                tasks={tasks}
                hoveredTaskId={hoveredTaskId}
                hoveredTaskDeadline={hoveredTaskDeadline}
                onScheduleTask={onScheduleTask}
                onUnscheduleTask={onUnscheduleTask}
                onMoveTask={onMoveTask}
                onToggleTaskComplete={onToggleTaskComplete}
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
  const months = useMemo(() => [props.baseDate], [props.baseDate]);
  const viewportRef = useRef(null);
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const updateWidth = () => {
      const viewportWidth = element.clientWidth || 0;
      const preferredWidth = 980;
      setContentWidth(Math.max(viewportWidth, preferredWidth));
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={viewportRef}
      className="h-full select-none overflow-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
    >
      <div className="pb-6" style={contentWidth ? { minWidth: `${contentWidth}px` } : { minWidth: "100%" }}>
        {months.map((monthDate) => (
          <MonthSection key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`} monthDate={monthDate} {...props} />
        ))}
      </div>
    </div>
  );
}
