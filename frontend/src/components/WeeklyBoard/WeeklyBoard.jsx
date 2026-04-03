import { useEffect, useMemo, useRef } from "react";
import { getDateRangeDates, formatDate } from "../../utils/dateUtils";
import DayColumn from "./DayColumn";

const DAY_COLUMN_WIDTH = 172;

export default function WeeklyBoard({
  baseDate,
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
  const scrollRef = useRef(null);
  const panStateRef = useRef({
    isActive: false,
    startX: 0,
    startScrollLeft: 0
  });
  const dates = useMemo(() => getDateRangeDates(baseDate, 15, 15), [baseDate]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const targetIndex = dates.findIndex((day) => day.dateKey === formatDate(baseDate));
    if (targetIndex === -1) return;

    const left = Math.max(0, targetIndex * DAY_COLUMN_WIDTH - (container.clientWidth - DAY_COLUMN_WIDTH) / 2);
    container.scrollTo({ left, behavior: "smooth" });
  }, [baseDate, dates]);

  useEffect(() => {
    const handleMouseMove = (event) => {
      const container = scrollRef.current;
      const panState = panStateRef.current;
      if (!container || !panState.isActive) return;

      const deltaX = event.clientX - panState.startX;
      container.scrollLeft = panState.startScrollLeft - deltaX;
    };

    const stopPan = () => {
      const container = scrollRef.current;
      if (container) {
        container.classList.remove("cursor-grabbing");
      }

      if (panStateRef.current.isActive) {
        panStateRef.current.isActive = false;
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopPan);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopPan);
      document.body.style.userSelect = "";
    };
  }, []);

  const handleMouseDown = (event) => {
    const container = scrollRef.current;
    if (!container || event.button !== 0) return;
    if (event.target.closest('[draggable="true"]') || event.target.closest("button")) return;

    panStateRef.current = {
      isActive: true,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft
    };

    container.classList.add("cursor-grabbing");
    document.body.style.userSelect = "none";
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden border-t border-slate-200 bg-slate-50">
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        className="custom-scrollbar flex w-full flex-1 cursor-grab overflow-x-auto overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        <div className="flex min-w-max divide-x divide-slate-200">
          {dates.map((day) => {
            const assignments = boardState[day.dateKey] || [];

            return (
              <div key={day.dateKey} style={{ width: `${DAY_COLUMN_WIDTH}px`, minWidth: `${DAY_COLUMN_WIDTH}px` }}>
                <DayColumn
                  dateKey={day.dateKey}
                  dayName={day.dayName}
                  dateNum={day.dateNum}
                  monthLabel={day.monthLabel}
                  isToday={day.isToday}
                  assignments={assignments}
                  tasks={tasks}
                  hoveredTaskId={hoveredTaskId}
                  hoveredTaskDeadline={hoveredTaskDeadline}
                  hoveredTaskColor={hoveredTaskColor}
                  onAddAssignmentFromSidebar={onAddAssignmentFromSidebar}
                  onDeleteAssignment={(assignmentId) => onDeleteAssignment(day.dateKey, assignmentId)}
                  onMoveAssignment={onMoveAssignment}
                  onToggleAssignmentComplete={onToggleAssignmentComplete}
                  onHoverTask={onHoverTask}
                  onOpenDetail={onOpenDetail}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
