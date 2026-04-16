const DEFAULT_COLOR = "#5B8DEF";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const formatDateKey = (value) => {
  const date = startOfDay(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (dateKey) => {
  if (!dateKey) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

export const addDays = (dateKey, days) => {
  const base = parseDateKey(dateKey);
  if (!base) return null;
  base.setDate(base.getDate() + Number(days || 0));
  return formatDateKey(base);
};

const normalizeWeekdays = (workflow) => {
  const rawWeekdays = Array.isArray(workflow.schedule?.weekdays)
    ? workflow.schedule.weekdays
    : typeof workflow.schedule?.weekday === "number"
      ? [workflow.schedule.weekday]
      : [1];

  return Array.from(new Set(rawWeekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).sort((a, b) => a - b);
};

export const normalizeWorkflowRecord = (workflow = {}, index = 0, colorPalette = []) => {
  const fallbackColor = colorPalette[index % colorPalette.length] || DEFAULT_COLOR;
  const normalizedTags = Array.isArray(workflow.template?.tags)
    ? workflow.template.tags.filter(Boolean)
    : Array.isArray(workflow.tags)
      ? workflow.tags.filter(Boolean)
      : [];

  const weekdays = normalizeWeekdays(workflow);

  return {
    id: workflow.id || `workflow_${Date.now()}_${index}`,
    name: workflow.name || workflow.template?.title || workflow.title || "新しいワークフロー",
    enabled: workflow.enabled !== false,
    schedule: {
      frequency: ["daily", "weekly", "monthly"].includes(workflow.schedule?.frequency)
        ? workflow.schedule.frequency
        : "weekly",
      startDate: workflow.schedule?.startDate || formatDateKey(new Date()),
      weekdays,
      weekday: weekdays[0] ?? 1,
      dayOfMonth:
        typeof workflow.schedule?.dayOfMonth === "number" && workflow.schedule.dayOfMonth >= 1 && workflow.schedule.dayOfMonth <= 31
          ? workflow.schedule.dayOfMonth
          : 1
    },
    template: {
      title: workflow.template?.title || workflow.title || "",
      description: workflow.template?.description || workflow.description || "",
      tags: normalizedTags,
      color: workflow.template?.color || workflow.color || fallbackColor,
      dueOffsetDays:
        typeof workflow.template?.dueOffsetDays === "number"
          ? workflow.template.dueOffsetDays
          : typeof workflow.dueOffsetDays === "number"
            ? workflow.dueOffsetDays
            : 0
    },
    generatedRunKeys: Array.isArray(workflow.generatedRunKeys)
      ? Array.from(new Set(workflow.generatedRunKeys.filter(Boolean))).sort()
      : []
  };
};

const matchesRunDate = (workflow, date) => {
  const dateKey = formatDateKey(date);
  if (dateKey < workflow.schedule.startDate) return false;

  if (workflow.schedule.frequency === "daily") {
    return true;
  }

  if (workflow.schedule.frequency === "weekly") {
    return (workflow.schedule.weekdays || []).includes(date.getDay());
  }

  if (workflow.schedule.frequency === "monthly") {
    return date.getDate() === workflow.schedule.dayOfMonth;
  }

  return false;
};

export const describeWorkflowSchedule = (workflow) => {
  if (workflow.schedule.frequency === "daily") {
    return "毎日";
  }

  if (workflow.schedule.frequency === "weekly") {
    const labels = (workflow.schedule.weekdays || []).map((day) => `${WEEKDAY_LABELS[day]}曜`);
    return `毎週 ${labels.join("・")}`;
  }

  return `毎月${workflow.schedule.dayOfMonth}日`;
};

export const describeWorkflowDeadline = (workflow) => {
  const offset = Number(workflow.template.dueOffsetDays || 0);
  if (offset === 0) return "期限は作成当日";
  if (offset > 0) return `期限は${offset}日後`;
  return `期限は${Math.abs(offset)}日前`;
};

export const getNextWorkflowRunDate = (workflow, fromDate = new Date()) => {
  const cursor = startOfDay(fromDate);
  for (let index = 0; index < 400; index += 1) {
    const candidate = new Date(cursor);
    candidate.setDate(cursor.getDate() + index);
    if (matchesRunDate(workflow, candidate)) {
      return formatDateKey(candidate);
    }
  }
  return null;
};

export const materializeWorkflowTasks = (state, colorPalette = [], referenceDate = new Date()) => {
  const todayKey = formatDateKey(referenceDate);
  const workflows = Array.isArray(state.workflows)
    ? state.workflows.map((workflow, index) => normalizeWorkflowRecord(workflow, index, colorPalette))
    : [];
  const existingRunKeys = new Set(
    (state.tasks || [])
      .filter((task) => task.sourceWorkflowId && task.workflowRunKey)
      .map((task) => `${task.sourceWorkflowId}:${task.workflowRunKey}`)
  );

  let createdTasks = [];
  let workflowChanged = false;

  const nextWorkflows = workflows.map((workflow, index) => {
    if (!workflow.enabled) {
      return workflow;
    }

    const runKeys = new Set(workflow.generatedRunKeys || []);
    const nextRunKeys = new Set(runKeys);

    const startDate = parseDateKey(workflow.schedule.startDate);
    const todayDate = parseDateKey(todayKey);

    if (!startDate || !todayDate || startDate > todayDate) {
      return workflow;
    }

    const cursor = new Date(startDate);

    while (cursor <= todayDate) {
      if (matchesRunDate(workflow, cursor)) {
        const runKey = formatDateKey(cursor);
        const globalRunKey = `${workflow.id}:${runKey}`;

        if (!nextRunKeys.has(runKey) && !existingRunKeys.has(globalRunKey)) {
          const taskId = `task_${Date.now()}_${index}_${createdTasks.length}`;
          createdTasks.push({
            id: taskId,
            title: workflow.template.title,
            color: workflow.template.color || colorPalette[index % colorPalette.length] || DEFAULT_COLOR,
            tags: workflow.template.tags || [],
            deadline: addDays(runKey, workflow.template.dueOffsetDays || 0),
            description: workflow.template.description || "",
            scheduledDate: null,
            completed: false,
            sourceWorkflowId: workflow.id,
            workflowRunKey: runKey
          });
          nextRunKeys.add(runKey);
          existingRunKeys.add(globalRunKey);
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    const normalizedRunKeys = Array.from(nextRunKeys).sort();
    if (normalizedRunKeys.join("|") !== (workflow.generatedRunKeys || []).join("|")) {
      workflowChanged = true;
      return {
        ...workflow,
        generatedRunKeys: normalizedRunKeys
      };
    }

    return workflow;
  });

  if (!createdTasks.length && !workflowChanged) {
    return { nextState: state, createdCount: 0 };
  }

  const nextTagOptions = Array.from(
    new Set([...(state.tagOptions || []), ...createdTasks.flatMap((task) => task.tags || [])])
  ).sort((a, b) => a.localeCompare(b));

  return {
    nextState: {
      ...state,
      tasks: [...(state.tasks || []), ...createdTasks],
      workflows: nextWorkflows,
      tagOptions: nextTagOptions
    },
    createdCount: createdTasks.length
  };
};
