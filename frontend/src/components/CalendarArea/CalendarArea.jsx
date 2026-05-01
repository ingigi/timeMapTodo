import { useState } from "react";
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import WeeklyBoard from "../WeeklyBoard/WeeklyBoard";
import MonthlyBoard from "../MonthlyBoard/MonthlyBoard";
import { addMonths, addWeeks, formatMonthLabel, startOfWeek, subMonths, subWeeks } from "../../utils/dateUtils";

export default function CalendarArea({
  baseDate,
  viewType,
  setBaseDate,
  setViewType,
  scheduledTasksByDate,
  tasks,
  googleCalendarEvents = [],
  googleCalendarStatus = "idle",
  googleCalendarError = "",
  onReconnectGoogleCalendar,
  hoveredTaskId,
  hoveredTaskDeadline,
  onScheduleTask,
  onUnscheduleTask,
  onMoveTask,
  onToggleTaskComplete,
  onHoverTask,
  onOpenDetail,
  isTaskSidebarCollapsed = false,
  onToggleTaskSidebar
}) {
  const hoveredTask = tasks.find((task) => task.id === hoveredTaskId) || null;
  const [visibleMonthLabel, setVisibleMonthLabel] = useState(() => formatMonthLabel(baseDate));

  const handlePrev = () => {
    setBaseDate((prev) => {
      const next = viewType === "week" ? subWeeks(prev, 1) : subMonths(prev, 1);
      setVisibleMonthLabel(formatMonthLabel(next));
      return next;
    });
  };

  const handleNext = () => {
    setBaseDate((prev) => {
      const next = viewType === "week" ? addWeeks(prev, 1) : addMonths(prev, 1);
      setVisibleMonthLabel(formatMonthLabel(next));
      return next;
    });
  };

  const handleToday = () => {
    const next = new Date();
    setBaseDate(next);
    setVisibleMonthLabel(formatMonthLabel(next));
  };

  const formattedDateRange = () => {
    if (viewType === "month") {
      return `${baseDate.getFullYear()} / ${baseDate.getMonth() + 1}`;
    }

    const start = startOfWeek(baseDate);
    const end = addWeeks(start, 1);
    end.setDate(end.getDate() - 1);
    return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()} を表示`;
  };

  return (
    <div className="relative flex h-full flex-col bg-[#06080A]">
      <div className="flex items-center justify-between gap-4 border-b border-[#2A3038] px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onToggleTaskSidebar}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#20242A] bg-[#090C0F] text-[#B4BDCA] shadow-[0_12px_32px_rgba(0,0,0,0.28)] transition-colors hover:border-[#34363D] hover:bg-[#111418] hover:text-[#F7F7F8]"
            title={isTaskSidebarCollapsed ? "\u30bf\u30b9\u30af\u4e00\u89a7\u3092\u958b\u304f" : "\u30bf\u30b9\u30af\u4e00\u89a7\u3092\u9589\u3058\u308b"}
          >
            {isTaskSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>

          <div className="flex items-center gap-2 rounded-xl bg-[#111418] p-1">
            <button
              type="button"
              onClick={() => setViewType("week")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                viewType === "week" ? "bg-[#090C0F] text-[#F7F7F8] shadow-md" : "text-[#8B949E] hover:text-[#F7F7F8]"
              }`}
            >
              週
            </button>
            <button
              type="button"
              onClick={() => setViewType("month")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                viewType === "month" ? "bg-[#090C0F] text-[#F7F7F8] shadow-md" : "text-[#8B949E] hover:text-[#F7F7F8]"
              }`}
            >
              月
            </button>
          </div>

          <button
            type="button"
            onClick={handleToday}
            className="rounded-lg border border-[#20242A] bg-[#090C0F] px-4 py-2 text-sm font-medium text-[#F7F7F8] transition-colors hover:border-[#0CCB8E]/40 hover:bg-[#111418]"
          >
            今日
          </button>

          <div className="flex items-center gap-2 text-sm font-semibold text-[#F7F7F8]">
            <button type="button" onClick={handlePrev} className="rounded-lg p-2 text-[#F7F7F8] hover:bg-[#111418]">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" className="min-w-[180px] text-center hover:text-[#0CCB8E]" onClick={handleToday}>
              {formattedDateRange()}
            </button>
            <button type="button" onClick={handleNext} className="rounded-lg p-2 text-[#F7F7F8] hover:bg-[#111418]">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 text-sm font-semibold text-[#A8B2C0]">
          {googleCalendarStatus === "loading" ? <span className="text-[#748092]">Google Calendar syncing...</span> : null}
          {googleCalendarStatus === "error" ? (
            <span className="max-w-[360px] truncate text-[#FCA5A5]" title={googleCalendarError || "Google Calendar unavailable"}>
              {googleCalendarError || "Google Calendar unavailable"}
            </span>
          ) : null}
          {googleCalendarStatus === "needs-sign-in" ? (
            <button
              type="button"
              onClick={onReconnectGoogleCalendar}
              className="rounded-lg border border-[#D9A441]/40 px-3 py-1.5 text-xs font-semibold text-[#FBBF24] transition-colors hover:bg-[#D9A441]/10"
            >
              Connect Google Calendar
            </button>
          ) : null}
          <span>{visibleMonthLabel}</span>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {viewType === "week" ? (
          <WeeklyBoard
            baseDate={baseDate}
            scheduledTasksByDate={scheduledTasksByDate}
            tasks={tasks}
            googleCalendarEvents={googleCalendarEvents}
            hoveredTaskId={hoveredTaskId}
            hoveredTaskDeadline={hoveredTaskDeadline || hoveredTask?.deadline || null}
            onVisibleMonthChange={setVisibleMonthLabel}
            onScheduleTask={onScheduleTask}
            onUnscheduleTask={onUnscheduleTask}
            onMoveTask={onMoveTask}
            onToggleTaskComplete={onToggleTaskComplete}
            onHoverTask={onHoverTask}
            onOpenDetail={onOpenDetail}
          />
        ) : (
          <MonthlyBoard
            baseDate={baseDate}
            scheduledTasksByDate={scheduledTasksByDate}
            tasks={tasks}
            hoveredTaskId={hoveredTaskId}
            hoveredTaskDeadline={hoveredTaskDeadline || hoveredTask?.deadline || null}
            onVisibleMonthChange={setVisibleMonthLabel}
            onScheduleTask={onScheduleTask}
            onUnscheduleTask={onUnscheduleTask}
            onMoveTask={onMoveTask}
            onToggleTaskComplete={onToggleTaskComplete}
            onHoverTask={onHoverTask}
            onOpenDetail={onOpenDetail}
          />
        )}
      </div>
    </div>
  );
}
