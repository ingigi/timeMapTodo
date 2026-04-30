export function getTaskStats(task) {
  const scheduledCount = task.scheduledDate ? 1 : 0;
  const completedCount = task.completed ? 1 : 0;
  const openCount = scheduledCount && !task.completed ? 1 : 0;

  return {
    scheduledCount,
    completedCount,
    openCount
  };
}

export function getTaskStatus(task) {
  if (task.completed) return "Completed";
  if (task.scheduledDate) return "InProgress";
  return "NotStarted";
}




