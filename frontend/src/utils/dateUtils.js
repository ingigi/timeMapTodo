export const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
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

const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

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
    const weekdayIndex = current.getDay() === 0 ? 6 : current.getDay() - 1;

    return {
      dateKey: formatDate(current),
      dayName: WEEKDAY_LABELS[weekdayIndex],
      dateNum: current.getDate(),
      monthLabel: `${current.getFullYear()}年${current.getMonth() + 1}月`,
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
  if (endDate.getDay() !== 0) {
    endDate.setDate(endDate.getDate() + (7 - endDate.getDay()));
  }

  const dates = [];
  let current = new Date(startDate);

  while (current <= endDate) {
    const weekdayIndex = current.getDay() === 0 ? 6 : current.getDay() - 1;
    dates.push({
      dateKey: formatDate(current),
      dayName: WEEKDAY_LABELS[weekdayIndex],
      dateNum: current.getDate(),
      isToday: formatDate(current) === formatDate(new Date()),
      isCurrentMonth: current.getMonth() === m
    });
    current.setDate(current.getDate() + 1);
  }

  return dates;
};
