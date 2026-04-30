import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  hoveredTaskId,
  hoveredTaskDeadline,
  onScheduleTask,
  onUnscheduleTask,
  onMoveTask,
  onToggleTaskComplete,
  onHoverTask,
  onOpenDetail
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

        <div className="shrink-0 text-sm font-semibold text-[#A8B2C0]">{visibleMonthLabel}</div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {viewType === "week" ? (
          <WeeklyBoard
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
