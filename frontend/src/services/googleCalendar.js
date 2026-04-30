const CALENDAR_EVENTS_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toTimeLabel = (date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const getDurationMinutes = (start, end) => {
  if (!start || !end) return 60;
  return Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
};

const normalizeGoogleEvent = (event) => {
  const startDateTime = event.start?.dateTime;
  const endDateTime = event.end?.dateTime;
  const allDayDate = event.start?.date;

  if (startDateTime) {
    const start = new Date(startDateTime);
    const end = endDateTime ? new Date(endDateTime) : null;

    return {
      id: event.id,
      title: event.summary || "(No title)",
      dateKey: toDateKey(start),
      startTime: toTimeLabel(start),
      endTime: end ? toTimeLabel(end) : "",
      durationMinutes: getDurationMinutes(start, end),
      allDay: false,
      source: "google-calendar"
    };
  }

  if (allDayDate) {
    return null;
  }

  return null;
};

export const fetchGoogleCalendarEvents = async ({ accessToken, timeMin, timeMax }) => {
  if (!accessToken || !timeMin || !timeMax) return [];

  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults: "250"
  });

  const response = await fetch(`${CALENDAR_EVENTS_ENDPOINT}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error?.message || "Failed to load Google Calendar events.");
  }

  return (body.items || []).map(normalizeGoogleEvent).filter(Boolean);
};
