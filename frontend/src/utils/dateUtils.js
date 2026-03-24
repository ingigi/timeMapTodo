export const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
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

export const subWeeks = (date, weeks) => {
  return addWeeks(date, -weeks);
};

export const subMonths = (date, months) => {
  return addMonths(date, -months);
};

export const getWeekDates = (baseDate) => {
  const start = startOfWeek(baseDate);
  const days = ['月', '火', '水', '木', '金', '土', '日'];
  return days.map((dayName, idx) => {
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

  const days = ['月', '火', '水', '木', '金', '土', '日'];
  
  const dates = [];
  let current = new Date(startDate);
  
  while (current <= endDate) {
    dates.push({
      dateKey: formatDate(current),
      dayName: days[(current.getDay() === 0 ? 6 : current.getDay() - 1)],
      dateNum: current.getDate(),
      isToday: formatDate(current) === formatDate(new Date()),
      isCurrentMonth: current.getMonth() === m
    });
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
};

export const getCapacityForDate = (dateKey, capacities) => {
  // capacities is [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
  const d = new Date(dateKey);
  const day = d.getDay(); // 0 is Sun, 1 is Mon
  const idx = day === 0 ? 6 : day - 1;
  return capacities[idx] || 0;
};
