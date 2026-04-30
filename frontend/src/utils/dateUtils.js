export const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const formatMonthLabel = (date) => `${date.getFullYear()}\u5e74${date.getMonth() + 1}\u6708`;

export const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  return new Date(d.setDate(d.getDate() - day));
};

export const addWeeks = (date, weeks) => {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
};

export const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

export const subWeeks = (date, weeks) => addWeeks(date, -weeks);

export const subMonths = (date, months) => addMonths(date, -months);

export const WEEKDAY_LABELS = ["\u65e5", "\u6708", "\u706b", "\u6c34", "\u6728", "\u91d1", "\u571f"];

export const getWeekDates = (baseDate) => {
  const start = startOfWeek(baseDate);
  return WEEKDAY_LABELS.map((dayName, idx) => {
    const d = new Date(start);
    d.setDate(d.getDate() + idx);
    return {
      dateKey: formatDate(d),
      dayName,
      dateNum: d.getDate(),
      isToday: formatDate(d) === formatDate(new Date())
    };
  });
};

export const getDateRangeDates = (centerDate, daysBefore = 15, daysAfter = 15) => {
  const start = new Date(centerDate);
  start.setDate(start.getDate() - daysBefore);
  const total = daysBefore + daysAfter + 1;

  return Array.from({ length: total }, (_, idx) => {
    const current = new Date(start);
    current.setDate(start.getDate() + idx);

    return {
      dateKey: formatDate(current),
      dayName: WEEKDAY_LABELS[current.getDay()],
      dateNum: current.getDate(),
      monthLabel: formatMonthLabel(current),
      isToday: formatDate(current) === formatDate(new Date())
    };
  });
};

export const getMonthDates = (baseDate) => {
  const y = baseDate.getFullYear();
  const m = baseDate.getMonth();
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m + 1, 0);
  const startDate = startOfWeek(firstDay);

  const endDate = new Date(lastDay);
  if (endDate.getDay() !== 6) {
    endDate.setDate(endDate.getDate() + ((6 - endDate.getDay() + 7) % 7));
  }

  const dates = [];
  let current = new Date(startDate);

  while (current <= endDate) {
    dates.push({
      dateKey: formatDate(current),
      dayName: WEEKDAY_LABELS[current.getDay()],
      dateNum: current.getDate(),
      isToday: formatDate(current) === formatDate(new Date()),
      isCurrentMonth: current.getMonth() === m
    });
    current.setDate(current.getDate() + 1);
  }

  return dates;
};




