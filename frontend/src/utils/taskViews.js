export const DEFAULT_STATUS_OPTIONS = [
  { id: "not-started", name: "未着手", standard: true },
  { id: "in-progress", name: "進行中", standard: true },
  { id: "completed", name: "完了", standard: true }
];

export const ALL_TASKS_VIEW_ID = "all";

export const DEFAULT_VIEWS = [
  {
    id: ALL_TASKS_VIEW_ID,
    name: "日付なし",
    locked: false,
    filters: [
      {
        id: "default_unscheduled_filter",
        joiner: "and",
        property: "placement",
        match: "values",
        values: ["unscheduled"]
      }
    ],
    sorts: []
  },
  {
    id: "due-soon",
    name: "期限が近い",
    locked: false,
    filters: [
      {
        id: "default_due_soon_filter",
        joiner: "and",
        property: "deadline",
        match: "range",
        dateRange: {
          startMode: "today",
          startOffsetDays: 0,
          endMode: "relative",
          endOffsetDays: 3
        },
        values: []
      }
    ],
    sorts: [
      {
        id: "default_due_soon_sort",
        property: "deadline",
        direction: "asc"
      }
    ]
  }
];

const normalizeOption = (option, fallback) => ({
  id: option?.id || fallback.id,
  name: option?.name || fallback.name,
  standard: Boolean(option?.standard || fallback.standard)
});

export const normalizeStatusOptions = (statusOptions = []) => {
  const savedOptions = Array.isArray(statusOptions) ? statusOptions : [];
  const savedById = new Map(savedOptions.map((option) => [option.id, option]));
  const standardOptions = DEFAULT_STATUS_OPTIONS.map((option) => normalizeOption(savedById.get(option.id), option));
  const customOptions = savedOptions
    .filter((option) => option?.id && !DEFAULT_STATUS_OPTIONS.some((standard) => standard.id === option.id))
    .map((option) => ({
      id: option.id,
      name: option.name || "ステータス",
      standard: false
    }));

  return [...standardOptions, ...customOptions];
};

const migrateFilter = (filter) => {
  if (!filter?.property) return null;

  if (filter.property === "scheduledDate") {
    const values = filter.match === "empty" ? ["unscheduled"] : ["scheduled"];
    return {
      id: filter.id || `filter_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      joiner: filter.joiner || "and",
      property: "placement",
      match: "values",
      values
    };
  }

  return {
    ...filter,
    match: filter.match || (filter.property === "deadline" ? "range" : "values")
  };
};

export const normalizeViews = (views = []) => {
  const savedViews = Array.isArray(views) ? views : [];
  const normalizedViews = savedViews
    .filter((view) => view?.id)
    .map((view) => ({
      id: view.id,
      name: view.name || "ビュー",
      locked: false,
      filters: Array.isArray(view.filters) ? view.filters.map(migrateFilter).filter(Boolean) : [],
      sorts: Array.isArray(view.sorts) ? view.sorts.filter((sort) => sort?.property && sort.property !== "scheduledDate") : []
    }));

  return normalizedViews.length > 0 ? normalizedViews : DEFAULT_VIEWS;
};

export const normalizeTagOptions = (tagOptions = []) =>
  Array.from(new Set(Array.isArray(tagOptions) ? tagOptions.filter(Boolean) : []));

const todayKey = () => formatDateKey(new Date());

export const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDaysToKey = (dateKey, days) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + Number(days || 0));
  return formatDateKey(date);
};

const resolveDateRange = (range = {}) => {
  const startBase = todayKey();
  const startOffset = range.startMode === "relative" ? Number(range.startOffsetDays || 0) : 0;
  const start = addDaysToKey(startBase, startOffset);
  const endOffset = range.endMode === "relative" ? Number(range.endOffsetDays || 0) : 0;
  const end = addDaysToKey(start, endOffset);
  return start <= end ? { start, end } : { start: end, end: start };
};

const getTaskValue = (task, property) => {
  if (property === "placement") return task.scheduledDate ? "scheduled" : "unscheduled";
  if (property === "deadline") return task.deadline || "";
  if (property === "tags") return task.tags || [];
  if (property === "status") return task.statusId || "not-started";
  return "";
};

const matchesFilter = (task, filter) => {
  if (!filter?.property) return true;

  if (filter.property === "deadline") {
    const value = getTaskValue(task, filter.property);
    if (filter.match === "empty") return !value;
    if (filter.match === "exists") return Boolean(value);
    if (!value) return false;
    const { start, end } = resolveDateRange(filter.dateRange);
    return value >= start && value <= end;
  }

  if (filter.property === "placement") {
    const values = Array.isArray(filter.values) ? filter.values : [];
    if (values.length === 0) return true;
    return values.includes(getTaskValue(task, "placement"));
  }

  if (filter.property === "tags") {
    const values = Array.isArray(filter.values) ? filter.values : [];
    if (values.length === 0) return true;
    const taskTags = new Set(task.tags || []);
    return values.some((tag) => taskTags.has(tag));
  }

  if (filter.property === "status") {
    const values = Array.isArray(filter.values) ? filter.values : [];
    if (values.length === 0) return true;
    return values.includes(task.statusId || "not-started");
  }

  return true;
};

export const filterTasksByView = (tasks, view) => {
  const filters = Array.isArray(view?.filters) ? view.filters.filter((filter) => filter?.property) : [];
  if (filters.length === 0) return tasks;

  return tasks.filter((task) =>
    filters.reduce((result, filter, index) => {
      const next = matchesFilter(task, filter);
      if (index === 0) return next;
      return filter.joiner === "or" ? result || next : result && next;
    }, true)
  );
};

const getStatusOrder = (statusOptions) => new Map(statusOptions.map((status, index) => [status.id, index]));
const getTagOrder = (tagOptions) => new Map(tagOptions.map((tag, index) => [tag, index]));

const compareBySort = (left, right, sort, tagOrder, statusOrder) => {
  let result = 0;

  if (sort.property === "deadline") {
    result = (left.deadline || "9999-99-99").localeCompare(right.deadline || "9999-99-99");
  } else if (sort.property === "tags") {
    const leftOrder = Math.min(...(left.tags || []).map((tag) => tagOrder.get(tag) ?? 9999), 9999);
    const rightOrder = Math.min(...(right.tags || []).map((tag) => tagOrder.get(tag) ?? 9999), 9999);
    result = leftOrder - rightOrder;
  } else if (sort.property === "status") {
    result = (statusOrder.get(left.statusId || "not-started") ?? 9999) - (statusOrder.get(right.statusId || "not-started") ?? 9999);
  }

  return sort.direction === "desc" ? result * -1 : result;
};

export const sortTasksByView = (tasks, view, tagOptions, statusOptions) => {
  const sorts = Array.isArray(view?.sorts) ? view.sorts.filter((sort) => sort?.property && sort.property !== "scheduledDate") : [];
  if (sorts.length === 0) return tasks;

  const tagOrder = getTagOrder(tagOptions);
  const statusOrder = getStatusOrder(statusOptions);
  return [...tasks].sort((left, right) => {
    for (const sort of sorts) {
      const result = compareBySort(left, right, sort, tagOrder, statusOrder);
      if (result !== 0) return result;
    }
    return left.title.localeCompare(right.title);
  });
};
