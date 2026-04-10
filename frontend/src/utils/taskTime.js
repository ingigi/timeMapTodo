export function collectTaskFamilyIds(taskId, tasks) {
  const descendants = new Set();

  const collect = (id) => {
    descendants.add(id);
    tasks.filter((task) => task.parentId === id).forEach((child) => collect(child.id));
  };

  collect(taskId);
  return descendants;
}

export function getTaskAssignments(taskId, tasks, boardState) {
  const familyIds = collectTaskFamilyIds(taskId, tasks);

  return Object.entries(boardState).flatMap(([dateKey, assignments]) =>
    assignments
      .filter((assignment) => familyIds.has(assignment.taskId))
      .map((assignment) => ({ ...assignment, dateKey }))
  );
}

export function hasTaskAssignmentOnDate(boardState, dateKey, taskId, excludeAssignmentId = null) {
  return (boardState[dateKey] || []).some(
    (assignment) => assignment.taskId === taskId && assignment.id !== excludeAssignmentId
  );
}

export function getTaskStats(taskId, tasks, boardState) {
  const assignments = getTaskAssignments(taskId, tasks, boardState);
  const scheduledCount = assignments.length;
  const completedCount = assignments.filter((assignment) => assignment.completed).length;
  const openCount = scheduledCount - completedCount;

  return {
    scheduledCount,
    completedCount,
    openCount
  };
}

export function getTaskStatus(taskId, tasks, boardState) {
  const { scheduledCount, completedCount } = getTaskStats(taskId, tasks, boardState);

  if (scheduledCount === 0) return "NotStarted";
  if (completedCount === scheduledCount) return "Completed";
  return "InProgress";
}
