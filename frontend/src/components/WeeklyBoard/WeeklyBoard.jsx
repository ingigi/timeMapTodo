import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatMonthLabel, getDateRangeDates, startOfWeek } from "../../utils/dateUtils";
import DayColumn from "./DayColumn";

const HOURS = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, "0")}:00`);
const HOUR_HEIGHT = 72;

const getCurrentMinuteOfDay = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

export default function WeeklyBoard({
  baseDate,
  scheduledTasksByDate,
  tasks,
  googleCalendarEvents = [],
  hoveredTaskId,
  hoveredTaskDeadline,
  onVisibleMonthChange,
  onScheduleTask,
  onUnscheduleTask,
  onMoveTask,
  onToggleTaskComplete,
  onHoverTask,
  onOpenDetail
}) {
  const dates = useMemo(() => getDateRangeDates(startOfWeek(baseDate), 0, 6), [baseDate]);
  const timeGridScrollRef = useRef(null);
  const [currentMinute, setCurrentMinute] = useState(getCurrentMinuteOfDay);
  const todayIndex = dates.findIndex((day) => day.isToday);
  const deadlineIndex = dates.findIndex((day) => hoveredTaskDeadline === day.dateKey);
  const deadlineBarStyle =
    deadlineIndex >= 0
      ? {
          left: `calc(64px + ((100% - 64px) / 7) * ${deadlineIndex})`,
          width: "calc((100% - 64px) / 7)"
        }
      : null;
  const currentTimeTop = (currentMinute / 60) * HOUR_HEIGHT;

  useEffect(() => {
    onVisibleMonthChange?.(formatMonthLabel(baseDate));
  }, [baseDate, onVisibleMonthChange]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCurrentMinute(getCurrentMinuteOfDay());
    }, 60 * 1000);

    return () => window.clearInterval(timerId);
  }, []);

  useLayoutEffect(() => {
    const scrollContainer = timeGridScrollRef.current;
    if (!scrollContainer) return undefined;

    const frameId = requestAnimationFrame(() => {
      const nowTop = (getCurrentMinuteOfDay() / 60) * HOUR_HEIGHT;
      const targetTop = nowTop - scrollContainer.clientHeight * 0.32;
      const maxScrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      scrollContainer.scrollTop = Math.max(0, Math.min(maxScrollTop, targetTop));
    });

    return () => cancelAnimationFrame(frameId);
  }, [baseDate]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#06080A]">
      <div className="relative shrink-0 border-b border-[#2A3038] bg-[#06080A]">
        {deadlineBarStyle ? (
          <div className="pointer-events-none absolute top-0 z-30 px-3" style={deadlineBarStyle}>
            <div className="h-1 rounded-full bg-[#F59E0B] shadow-[0_0_18px_rgba(245,158,11,0.42)]" />
          </div>
        ) : null}
        <div className="grid min-w-0 grid-cols-[64px_repeat(7,minmax(0,1fr))]">
          <div className="border-r border-[#2A3038] bg-[#06080A]" />
          {dates.map((day) => {
            const isDeadlineDay = hoveredTaskDeadline === day.dateKey;

            return (
              <div
                key={day.dateKey}
                className="border-r border-[#2A3038] bg-[#06080A] px-3 py-3 text-center transition-all last:border-r-0"
              >
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#687384]">{day.monthLabel}</div>
              <div className={`text-[10px] font-bold uppercase tracking-tighter ${isDeadlineDay ? "text-[#FBBF24]" : day.isToday ? "text-[#60B964]" : "text-[#B8C0CC]"}`}>
                {day.dayName}
              </div>
              <div className="mt-1 flex justify-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    isDeadlineDay
                      ? "bg-[#F59E0B] text-[#1C1203] shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                      : day.isToday
                        ? "bg-[#60B964] text-[#06100D] shadow-[0_0_24px_rgba(96,185,100,0.25)]"
                        : "text-[#EEF2F6]"
                  }`}
                >
                  {day.dateNum}
                </div>
              </div>
              </div>
            );
          })}
        </div>

        <div className="grid min-w-0 grid-cols-[64px_repeat(7,minmax(0,1fr))]">
          <div className="border-r border-[#2A3038] bg-[#06080A]" />
          {dates.map((day) => (
            <DayColumn
              key={`${day.dateKey}-untimed`}
              mode="untimed"
              dateKey={day.dateKey}
              dayTasks={scheduledTasksByDate[day.dateKey] || []}
              googleCalendarEvents={googleCalendarEvents.filter((event) => event.dateKey === day.dateKey)}
              hoveredTaskId={hoveredTaskId}
              hoveredTaskDeadline={hoveredTaskDeadline}
              onScheduleTask={onScheduleTask}
              onUnscheduleTask={onUnscheduleTask}
              onMoveTask={onMoveTask}
              onToggleTaskComplete={onToggleTaskComplete}
              onHoverTask={onHoverTask}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
      </div>

      <div
        ref={timeGridScrollRef}
        className="min-h-0 flex-1 overflow-y-auto bg-[#06080A] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        <div className="relative grid min-w-0 grid-cols-[64px_repeat(7,minmax(0,1fr))]" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>
          <div className="pointer-events-none absolute inset-0 z-0">
            {HOURS.map((hour, index) => (
              <div
                key={hour}
                className="absolute left-0 right-0 border-t border-[#232A32]"
                style={{ top: `${index * HOUR_HEIGHT}px` }}
              />
            ))}
          </div>

          {todayIndex >= 0 ? (
            <div className="pointer-events-none absolute left-[64px] right-0 z-30 grid grid-cols-7" style={{ top: `${currentTimeTop}px` }}>
              {dates.map((day) => (
                <div key={`${day.dateKey}-now-line`} className="relative h-px">
                  {day.isToday ? (
                    <div className="absolute inset-x-0 top-0 flex items-center">
                      <span className="-ml-[5px] h-2.5 w-2.5 rounded-full bg-[#60B964] shadow-[0_0_16px_rgba(96,185,100,0.75)]" />
                      <span className="h-px flex-1 bg-[#60B964] shadow-[0_0_16px_rgba(96,185,100,0.55)]" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="relative z-10 border-r border-[#2A3038] bg-[#06080A]">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="relative pr-2 text-right text-[10px] font-semibold text-[#748092]"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                <span className="relative -top-2 bg-[#06080A] px-1">{hour}</span>
              </div>
            ))}
          </div>
          {dates.map((day) => (
            <DayColumn
              key={day.dateKey}
              mode="timed"
              dateKey={day.dateKey}
              dayTasks={scheduledTasksByDate[day.dateKey] || []}
              googleCalendarEvents={googleCalendarEvents.filter((event) => event.dateKey === day.dateKey)}
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
          ))}
        </div>
      </div>
    </div>
  );
}
