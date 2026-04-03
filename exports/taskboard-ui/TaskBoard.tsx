type Task = {
  id: string;
  title: string;
  status: "NotStarted" | "InProgress" | "Completed";
  deadline: string;
  color: string;
};

type Assignment = {
  id: string;
  taskId: string;
  completed: boolean;
};

type BoardState = Record<string, Assignment[]>;

export function TaskBoard({
  tasks,
  boardState,
}: {
  tasks: Task[];
  boardState: BoardState;
  baseDate: Date;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-title">タスク</h2>
          <span className="count-badge">{tasks.length}件</span>
        </div>

        <button className="create-btn">+ 新しいタスク</button>

        <div className="task-list">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      </aside>

      <main className="calendar-panel">
        <CalendarToolbar />
        <WeekBoard boardState={boardState} tasks={tasks} />
      </main>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const completed = task.status === "Completed";
  const statusLabel = task.status === "NotStarted" ? "未着手" : task.status === "InProgress" ? "進行中" : "完了";

  return (
    <div
      className={`task-row ${completed ? "task-row-completed" : ""}`}
      style={{ "--accent": task.color } as React.CSSProperties}
    >
      <div className="task-accent" />
      <div className="task-body">
        <div className="task-topline">
          <span className={`status-pill status-${task.status}`}>{statusLabel}</span>
          <span className="deadline">期限 {task.deadline}</span>
        </div>
        <div className="task-title">{task.title}</div>
      </div>
      <button className="row-trash" aria-label="delete">
        🗑
      </button>
    </div>
  );
}

function CalendarToolbar() {
  return (
    <div className="toolbar">
      <div className="segmented">
        <button className="segmented-active">Week</button>
        <button>Month</button>
      </div>

      <button className="today-btn">今日</button>

      <div className="range-pill">
        <button className="range-arrow">‹</button>
        <span>3/30 - 4/5 を中心に表示</span>
        <button className="range-arrow">›</button>
      </div>
    </div>
  );
}

function WeekBoard({
  boardState,
  tasks,
}: {
  boardState: BoardState;
  tasks: Task[];
}) {
  return (
    <div className="week-scroll">
      <div className="week-grid">
        {Array.from({ length: 8 }).map((_, i) => {
          const dateKey = `2026-04-${String(i + 1).padStart(2, "0")}`;
          const monthLabel = i === 0 ? "2026年3月" : "2026年4月";
          return (
            <DayColumn
              key={dateKey}
              monthLabel={monthLabel}
              dayLabel={String(i + 1)}
              tasks={boardState[dateKey] || []}
              allTasks={tasks}
            />
          );
        })}
      </div>
    </div>
  );
}

function DayColumn({
  monthLabel,
  dayLabel,
  tasks,
  allTasks,
}: {
  monthLabel: string;
  dayLabel: string;
  tasks: Assignment[];
  allTasks: Task[];
}) {
  return (
    <section className="day-column">
      <header className="day-header">
        <div className="month-label">{monthLabel}</div>
        <div className="day-number-wrap">
          <div className="day-number">{dayLabel}</div>
          <div className="day-count">Tasks {tasks.length}</div>
        </div>
      </header>

      <div className="day-dropzone">
        {tasks.map((assignment) => {
          const task = allTasks.find((item) => item.id === assignment.taskId)!;
          return <PlannedCard key={assignment.id} task={task} completed={assignment.completed} />;
        })}
      </div>
    </section>
  );
}

function PlannedCard({ task, completed }: { task: Task; completed: boolean }) {
  return (
    <div
      className={`planned-card ${completed ? "planned-card-completed" : ""}`}
      style={{ "--accent": task.color } as React.CSSProperties}
    >
      <button className="card-close" aria-label="close">
        ×
      </button>

      <div className="planned-title">{task.title}</div>

      <div className="planned-footer">
        <div className="planned-bar" />
        <button className="complete-btn">✓ 完了</button>
      </div>
    </div>
  );
}
