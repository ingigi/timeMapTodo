const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const REPEAT_PRESETS = [
  { value: "none", label: "指定配置" },
  { value: "weekly", label: "毎週" },
  { value: "weekdays", label: "平日" },
  { value: "custom", label: "カスタム" }
];

const pad = (value) => String(value).padStart(2, "0");

export const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (value) => {
  if (!value || !DATE_KEY_RE.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const isRecurringTask = (task) => {
  return Boolean(task?.placementType === "recurring" && task?.recurrence && task.recurrence.preset !== "none");
};

export const getRecurringDeadlineOffsetDays = (task) => {
  if (!isRecurringTask(task)) return 0;
  return Math.max(0, Number(task?.recurrence?.deadlineOffsetDays) || 0);
};

export const getRecurringDeadlineLabel = (task) => {
  const offsetDays = getRecurringDeadlineOffsetDays(task);
  return offsetDays === 0 ? "当日" : `${offsetDays}日後`;
};

export const getRecurringDeadlineDateKey = (task, sourceDateKey) => {
  if (!isRecurringTask(task) || !sourceDateKey) return null;

  const sourceDate = parseDateKey(sourceDateKey);
  if (!sourceDate) return null;

  const deadlineDate = new Date(sourceDate);
  deadlineDate.setDate(deadlineDate.getDate() + getRecurringDeadlineOffsetDays(task));
  return formatDateKey(deadlineDate);
};

export const getRecurrenceSummary = (task) => {
  if (!isRecurringTask(task)) {
    return "指定配置";
  }

  const recurrence = task.recurrence || {};
  const offsetLabel = getRecurringDeadlineLabel(task);

  if (recurrence.preset === "weekdays") {
    return `自動配置・平日・期限 ${offsetLabel}`;
  }

  if (recurrence.preset === "custom") {
    const interval = Math.max(1, Number(recurrence.interval) || 1);
    const unit = recurrence.unit || "week";
    const unitLabel = unit === "day" ? "日" : unit === "month" ? "か月" : unit === "year" ? "年" : "週";
    return `自動配置・${interval}${unitLabel}ごと・期限 ${offsetLabel}`;
  }

  return `自動配置・毎週・期限 ${offsetLabel}`;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const getNextRecurringOccurrenceDateKey = (task, fromDateKey = null) => {
  if (!isRecurringTask(task)) return null;

  const recurrence = task.recurrence || {};
  const fromDate = fromDateKey ? parseDateKey(fromDateKey) : new Date();
  if (!fromDate) return null;

  if (recurrence.preset === "weekdays") {
    const cursor = addDays(fromDate, 1);
    while (cursor.getDay() === 0 || cursor.getDay() === 6) {
      cursor.setDate(cursor.getDate() + 1);
    }
    return formatDateKey(cursor);
  }

  if (recurrence.preset === "custom") {
    const interval = Math.max(1, Number(recurrence.interval) || 1);
    const unit = recurrence.unit || "week";
    const days = unit === "day" ? interval : unit === "month" ? interval * 30 : unit === "year" ? interval * 365 : interval * 7;
    return formatDateKey(addDays(fromDate, days));
  }

  return formatDateKey(addDays(fromDate, 7));
};

const buildAutoAssignment = (task, dateKey) => ({
  id: `rr_${task.id}_${dateKey}`,
  taskId: task.id,
  completed: false,
  source: "auto",
  recurrenceTaskId: task.id,
  recurrenceKey: dateKey
});

export const syncRecurringAssignmentsForTask = (boardState, task) => {
  if (!isRecurringTask(task)) {
    return Object.fromEntries(Object.entries(boardState).filter(([, assignments]) => assignments.length > 0));
  }

  const taskAssignments = [];
  Object.entries(boardState).forEach(([dateKey, assignments]) => {
    assignments.forEach((assignment) => {
      if (assignment.taskId === task.id) {
        taskAssignments.push({ ...assignment, dateKey });
      }
    });
  });

  const openAssignments = taskAssignments.filter((assignment) => !assignment.completed);
  if (openAssignments.length > 0) {
    return Object.fromEntries(Object.entries(boardState).filter(([, assignments]) => assignments.length > 0));
  }

  const latestReference = taskAssignments
    .slice()
    .sort((left, right) => (left.recurrenceKey || left.dateKey).localeCompare(right.recurrenceKey || right.dateKey))
    .at(-1);

  const baseDateKey = latestReference?.recurrenceKey || latestReference?.dateKey || task.deadline || null;
  const nextDateKey = getNextRecurringOccurrenceDateKey(task, baseDateKey);

  if (!nextDateKey) {
    return Object.fromEntries(Object.entries(boardState).filter(([, assignments]) => assignments.length > 0));
  }

  if (boardState[nextDateKey]?.some((assignment) => assignment.taskId === task.id)) {
    return Object.fromEntries(Object.entries(boardState).filter(([, assignments]) => assignments.length > 0));
  }

  const nextBoardState = {
    ...boardState,
    [nextDateKey]: [...(boardState[nextDateKey] || []), buildAutoAssignment(task, nextDateKey)]
  };

  return Object.fromEntries(Object.entries(nextBoardState).filter(([, assignments]) => assignments.length > 0));
};

export const generateRecurringDateKeys = (task, rangeStart, rangeEnd) => {
  if (!isRecurringTask(task)) return [];
  const nextDateKey = getNextRecurringOccurrenceDateKey(task, formatDateKey(rangeStart));
  if (!nextDateKey) return [];
  const nextDate = parseDateKey(nextDateKey);
  if (!nextDate || nextDate < rangeStart || nextDate > rangeEnd) return [];
  return [nextDateKey];
};




