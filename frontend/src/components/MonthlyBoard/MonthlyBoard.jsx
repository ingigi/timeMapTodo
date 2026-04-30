import { useEffect, useMemo, useRef, useState } from "react";
import { WEEKDAY_LABELS, getMonthDates } from "../../utils/dateUtils";
import MonthlyDay from "./MonthlyDay";

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
  const monthLabel = `${monthDate.getFullYear()}\u5e74 ${monthDate.getMonth() + 1}\u6708`;
  const weeks = [];

  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7));
  }

  return (
    <section className="mb-8">
      <div className="grid grid-cols-7 gap-px bg-[#20242A]">
        {WEEKDAY_LABELS.map((dayName, index) => (
          <div
            key={`${monthLabel}-${dayName}`}
            className={`bg-[#06080A] py-3 text-center text-xs font-medium tracking-wider ${
              index === 0 ? "text-red-400" : index === 6 ? "text-blue-400" : "text-[#8B949E]"
            }`}
          >
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
                dayIndex={dayIndex}
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
      className="h-full select-none overflow-auto bg-[#06080A] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
    >
      <div style={contentWidth ? { minWidth: `${contentWidth}px` } : { minWidth: "100%" }}>
        {months.map((monthDate) => (
          <MonthSection key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`} monthDate={monthDate} {...props} />
        ))}
      </div>
    </div>
  );
}




