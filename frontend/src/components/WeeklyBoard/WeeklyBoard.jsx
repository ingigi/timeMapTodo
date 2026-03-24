import { getWeekDates, getCapacityForDate } from "../../utils/dateUtils";
import DayColumn from "./DayColumn";

export default function WeeklyBoard({
  baseDate,
  boardState,
  tasks,
  capacities = [8,8,8,8,8,8,8],
  selectedTask,
  onAddAssignment,
  onDeleteAssignment,
  onResizeStart,
  onCompleteResizeStart,
  onUpdateCapacities,
  onMoveAssignment
}) {
  const dates = getWeekDates(baseDate);

  return (
    <div className="flex h-full flex-col relative w-full overflow-hidden">
      <div className="flex flex-1 gap-2 overflow-x-auto pb-4 pt-2 w-full">
        {dates.map((day) => {
          const assignments = boardState[day.dateKey] || [];
          const capacity = getCapacityForDate(day.dateKey, capacities);

          return (
            <DayColumn
              key={day.dateKey}
              dateKey={day.dateKey}
              dayName={day.dayName}
              dateNum={day.dateNum}
              isToday={day.isToday}
              blocksCount={capacity} 
              assignments={assignments}
              tasks={tasks}
              selectedTask={selectedTask}
              onAddAssignment={(e) => onAddAssignment(e, day.dateKey)}
              onDeleteAssignment={(assignmentId) => onDeleteAssignment(day.dateKey, assignmentId)}
              onResizeStart={(e, assignmentId) => onResizeStart(e, day.dateKey, assignmentId)}
              onCompleteResizeStart={(e, assignmentId) => onCompleteResizeStart(e, day.dateKey, assignmentId)}
              onUpdateCapacity={(val) => {
                const d = new Date(day.dateKey);
                const jsDay = d.getDay();
                const idx = jsDay === 0 ? 6 : jsDay - 1;
                const newCaps = [...capacities];
                newCaps[idx] = val;
                onUpdateCapacities(newCaps);
              }}
              onMoveAssignment={onMoveAssignment}
            />
          );
        })}
      </div>
    </div>
  );
}
