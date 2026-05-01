import { useState, useCallback, useRef, useEffect } from "react";
import { Bell, LogOut, Minus, Settings, ShieldCheck, Square, User, X } from "lucide-react";
import MainLayout from "./components/layout/MainLayout";
import TaskPool from "./components/TaskPool/TaskPool";
import CalendarArea from "./components/CalendarArea/CalendarArea";
import HandDrawnPopup from "./components/Common/HandDrawnPopup";
import { getTaskStats, getTaskStatus } from "./utils/taskTime";
import { materializeWorkflowTasks, normalizeWorkflowRecord } from "./utils/workflows";
import { addMonths, addWeeks, startOfWeek } from "./utils/dateUtils";
import {
  createAccountWithEmail,
  getFirebaseLegacyOwnerEmail,
  getGoogleCalendarAccessToken,
  isFirebaseConfigured,
  loadLegacyFirebaseAppState,
  onFirebaseAuthChange,
  restoreGoogleCalendarAccessToken,
  saveFirebaseAppState,
  signInWithEmail,
  signInWithGoogle,
  signOutFirebase,
  subscribeFirebaseAppState
} from "./services/firebaseAppState";
import { fetchGoogleCalendarEvents } from "./services/googleCalendar";

const TASK_COLORS = ["#5B8DEF", "#4FB7A8", "#D9A441", "#8A7FD1", "#7FA36B", "#C97B63", "#5FA3B7", "#C27A92"];
const UI_STORAGE_KEY = "timemaptodo-ui-settings-v1";
const GOOGLE_CALENDAR_REFRESH_INTERVAL_MS = 60 * 1000;
const DEFAULT_TASK_SIDEBAR_WIDTH = 320;
const MIN_TASK_SIDEBAR_WIDTH = 260;
const MAX_TASK_SIDEBAR_WIDTH = 560;
const GOOGLE_SIGN_IN_TIMEOUT_MS = 90 * 1000;

const EMPTY_APP_STATE = {
  tasks: [],
  tagOptions: [],
  workflows: []
};

const getCalendarFetchRange = (baseDate, viewType) => {
  if (viewType === "month") {
    const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const end = addMonths(start, 1);
    return { timeMin: start, timeMax: end };
  }

  const start = startOfWeek(baseDate);
  const end = addWeeks(start, 1);
  return { timeMin: start, timeMax: end };
};

const readPersistedUiSettings = () => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(UI_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    const sidebarWidth = Number(parsed.taskSidebarWidth);
    return {
      viewType: parsed.viewType === "month" ? "month" : "week",
      taskSidebarWidth:
        Number.isFinite(sidebarWidth) && sidebarWidth >= MIN_TASK_SIDEBAR_WIDTH && sidebarWidth <= MAX_TASK_SIDEBAR_WIDTH
          ? sidebarWidth
          : DEFAULT_TASK_SIDEBAR_WIDTH
    };
  } catch (error) {
    console.warn("Failed to read UI settings", error);
    return {};
  }
};

const MOCK_TASKS = [
  {
    id: "t1",
    title: "User interview synthesis",
    color: TASK_COLORS[0],
    tags: ["Research"],
    deadline: "2026-04-10",
    description: "Summarize recent user interviews",
    scheduledDate: null,
    completed: false
  },
  {
    id: "t2",
    title: "Landing page polish",
    color: TASK_COLORS[0],
    tags: ["Design"],
    deadline: "2026-04-15",
    description: "Tighten copy and final visuals",
    scheduledDate: "2026-04-14",
    completed: false
  },
  {
    id: "t3",
    title: "API cleanup",
    color: TASK_COLORS[2],
    tags: ["Dev", "Refactor"],
    deadline: "2026-04-20",
    description: "Reduce legacy endpoints and simplify payloads",
    scheduledDate: null,
    completed: false
  }
];

const normalizeTaskRecord = (task, index = 0) => ({
  id: task.id,
  title: task.title || "",
  color: task.color || TASK_COLORS[index % TASK_COLORS.length],
  tags: Array.isArray(task.tags) ? task.tags : [],
  deadline: task.deadline || null,
  description: task.description || "",
  scheduledDate: task.scheduledDate || null,
  scheduledTime: task.scheduledTime || null,
  scheduledDurationMinutes: Number.isFinite(Number(task.scheduledDurationMinutes))
    ? Math.max(15, Number(task.scheduledDurationMinutes))
    : 60,
  completed: Boolean(task.completed),
  sourceWorkflowId: task.sourceWorkflowId || null,
  workflowRunKey: task.workflowRunKey || null
});

const migrateLegacyTasks = (tasks = [], boardState = {}) => {
  const assignmentMap = new Map();

  Object.entries(boardState || {}).forEach(([dateKey, assignments]) => {
    (assignments || []).forEach((assignment) => {
      const existing = assignmentMap.get(assignment.taskId);
      const candidate = {
        dateKey,
        completed: Boolean(assignment.completed)
      };

      if (!existing || candidate.dateKey < existing.dateKey) {
        assignmentMap.set(assignment.taskId, candidate);
      }
    });
  });

  return tasks.map((task, index) => {
    const legacyAssignment = assignmentMap.get(task.id);
    return normalizeTaskRecord(
      {
        ...task,
        scheduledDate: task.scheduledDate ?? legacyAssignment?.dateKey ?? null,
        completed: task.completed ?? legacyAssignment?.completed ?? false
      },
      index
    );
  });
};

const groupTasksByScheduledDate = (tasks) =>
  tasks.reduce((groups, task) => {
    if (!task.scheduledDate) return groups;
    if (!groups[task.scheduledDate]) {
      groups[task.scheduledDate] = [];
    }
    groups[task.scheduledDate].push(task);
    return groups;
  }, {});

const normalizeStoredAppState = (data) => {
  if (!data || !data.tasks) return null;

  const migratedTasks = migrateLegacyTasks(data.tasks, data.boardState || {});

  return {
    tasks: migratedTasks,
    tagOptions: Array.from(new Set((data.tagOptions || migratedTasks.flatMap((task) => task.tags || [])))).sort((a, b) =>
      a.localeCompare(b)
    ),
    workflows: Array.isArray(data.workflows)
      ? data.workflows.map((workflow, index) => normalizeWorkflowRecord(workflow, index, TASK_COLORS))
      : []
  };
};

const isLegacyOwnerUser = (user) => {
  const legacyOwnerEmail = getFirebaseLegacyOwnerEmail();
  return Boolean(legacyOwnerEmail && user?.email?.toLowerCase() === legacyOwnerEmail);
};

function DesktopWindowControls() {
  const isDesktopApp = Boolean(window.api?.isDesktopApp);
  if (!isDesktopApp) return null;

  return (
    <div className="ml-2 flex h-14 items-center border-l border-[#20242A]" style={{ WebkitAppRegion: "no-drag" }}>
      <button
        type="button"
        onClick={() => window.api?.minimizeWindow?.()}
        className="flex h-14 w-12 items-center justify-center text-[#8B949E] transition-colors hover:bg-[#161A1F] hover:text-[#F7F7F8]"
        title="Minimize"
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => window.api?.toggleMaximizeWindow?.()}
        className="flex h-14 w-12 items-center justify-center text-[#8B949E] transition-colors hover:bg-[#161A1F] hover:text-[#F7F7F8]"
        title="Maximize"
      >
        <Square className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => window.api?.closeWindow?.()}
        className="flex h-14 w-12 items-center justify-center text-[#8B949E] transition-colors hover:bg-red-500/80 hover:text-white"
        title="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function AuthWindowHeader() {
  const isDesktopApp = Boolean(window.api?.isDesktopApp);

  return (
    <header
      className="absolute inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-[#20242A] bg-[#0B0E11]/95 pl-4 backdrop-blur"
      style={isDesktopApp ? { WebkitAppRegion: "drag" } : undefined}
    >
      <div className="flex min-w-0 items-center gap-4" style={isDesktopApp ? { WebkitAppRegion: "no-drag" } : undefined}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0CCB8E] to-[#0A9F74] text-sm font-bold text-[#06100D] shadow-[0_10px_30px_rgba(12,203,142,0.22)]">
          TM
        </div>
        <h1 className="text-lg font-semibold leading-6 tracking-tight text-[#F7F7F8]">TimeMapTodo</h1>
      </div>
      <DesktopWindowControls />
    </header>
  );
}

function AuthGate({ authState, onGoogleSignIn, onSignIn, onCreateAccount }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const googleSignInAttemptRef = useRef(0);

  useEffect(() => {
    if (!isGoogleSubmitting) return undefined;

    const attemptId = googleSignInAttemptRef.current;
    const timeoutId = window.setTimeout(() => {
      if (googleSignInAttemptRef.current !== attemptId) return;
      setIsGoogleSubmitting(false);
      setErrorMessage("Google sign-in timed out. Please try again.");
    }, GOOGLE_SIGN_IN_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isGoogleSubmitting]);

  const handleGoogleSignIn = async () => {
    setErrorMessage("");
    setIsGoogleSubmitting(true);
    googleSignInAttemptRef.current += 1;
    const attemptId = googleSignInAttemptRef.current;

    try {
      await onGoogleSignIn();
    } catch (error) {
      if (googleSignInAttemptRef.current === attemptId) {
        setErrorMessage(error.message || "Google sign-in failed.");
      }
    } finally {
      if (googleSignInAttemptRef.current === attemptId) {
        setIsGoogleSubmitting(false);
      }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      if (mode === "create") {
        await onCreateAccount(email, password);
      } else {
        await onSignIn(email, password);
      }
    } catch (error) {
      setErrorMessage(error.message || "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex h-screen items-center justify-center bg-[#15161A] px-6 pt-14">
      <AuthWindowHeader />
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[420px] rounded-lg border border-[#2A2D35] bg-[#1C1D22] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.32)]"
      >
        <div className="mb-7">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-gradient-to-br from-[#0CCB8E] to-[#0A9F74] text-sm font-semibold text-white shadow-[0_12px_34px_rgba(12,203,142,0.34)]">
            TM
          </div>
          <h1 className="text-2xl font-semibold text-[#F4F4F5]">TimeMapTodo</h1>
          <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">Sign in to keep tasks synced across your devices.</p>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleSubmitting || isSubmitting || authState.status === "loading"}
          className="mb-4 flex w-full items-center justify-center gap-3 rounded-md bg-[#F4F4F5] px-4 py-3 text-sm font-semibold text-[#15161A] transition hover:bg-white disabled:cursor-not-allowed disabled:bg-[#52525B] disabled:text-[#A1A1AA]"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-[#0CCB8E]">
            G
          </span>
          {isGoogleSubmitting ? "Opening Google..." : "Continue with Google"}
        </button>

        {isGoogleSubmitting ? (
          <button
            type="button"
            onClick={() => {
              googleSignInAttemptRef.current += 1;
              setIsGoogleSubmitting(false);
              setErrorMessage("Google sign-in was cancelled. Please try again.");
            }}
            className="-mt-2 mb-4 w-full rounded-md border border-[#34363D] px-4 py-2 text-sm font-medium text-[#A8B2C0] transition hover:bg-[#25272F] hover:text-[#F7F7F8]"
          >
            Cancel and try again
          </button>
        ) : null}

        <div className="mb-4 flex items-center gap-3 text-xs font-medium text-[#71717A]">
          <div className="h-px flex-1 bg-[#2A2D35]" />
          Email backup
          <div className="h-px flex-1 bg-[#2A2D35]" />
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-[#D4D4D8]">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-[#34363D] bg-[#15161A] px-3 py-2 text-sm text-[#F4F4F5] outline-none focus:border-[#0CCB8E] focus:ring-2 focus:ring-[#0CCB8E]/25"
            autoComplete="email"
            required
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-[#D4D4D8]">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-[#34363D] bg-[#15161A] px-3 py-2 text-sm text-[#F4F4F5] outline-none focus:border-[#0CCB8E] focus:ring-2 focus:ring-[#0CCB8E]/25"
            autoComplete={mode === "create" ? "new-password" : "current-password"}
            minLength={6}
            required
          />
        </label>

        {errorMessage || authState.error ? (
          <div className="mb-4 rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {errorMessage || authState.error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || isGoogleSubmitting || authState.status === "loading"}
          className="w-full rounded-md bg-[#0CCB8E] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10B981] disabled:cursor-not-allowed disabled:bg-[#52525B]"
        >
          {isSubmitting ? "Please wait..." : mode === "create" ? "Create account" : "Sign in"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((current) => (current === "create" ? "signin" : "create"));
            setErrorMessage("");
          }}
          className="mt-3 w-full rounded-md border border-[#34363D] px-4 py-2 text-sm font-medium text-[#34D399] transition hover:bg-[#25272F]"
        >
          {mode === "create" ? "Use an existing account" : "Create a new account"}
        </button>

        <div className="mt-5 flex items-center gap-2 rounded-md border border-[#34363D] bg-[#15161A] px-3 py-2 text-xs text-[#A1A1AA]">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#0CCB8E]" />
          <span>Google authentication protects each user's private workspace.</span>
        </div>
      </form>
    </div>
  );
}

function AppHeader({ user, onSignOut }) {
  const isDesktopApp = Boolean(window.api?.isDesktopApp);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    const handlePointerDown = (event) => {
      if (accountMenuRef.current?.contains(event.target)) return;
      setIsAccountMenuOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between border-b border-[#20242A] bg-[#0B0E11]/95 pl-4 backdrop-blur"
      style={isDesktopApp ? { WebkitAppRegion: "drag" } : undefined}
    >
      <div className="flex min-w-0 items-center gap-4" style={isDesktopApp ? { WebkitAppRegion: "no-drag" } : undefined}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0CCB8E] to-[#0A9F74] text-sm font-bold text-[#06100D] shadow-[0_10px_30px_rgba(12,203,142,0.22)]">
          TM
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-6 tracking-tight text-[#F7F7F8]">TimeMapTodo</h1>
        </div>
      </div>

      <div className="flex items-center gap-2" style={isDesktopApp ? { WebkitAppRegion: "no-drag" } : undefined}>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#8B949E] transition-colors hover:bg-[#161A1F] hover:text-[#F7F7F8]"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#8B949E] transition-colors hover:bg-[#161A1F] hover:text-[#F7F7F8]"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
        {user ? (
          <>
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setIsAccountMenuOpen((current) => !current)}
                className="flex max-w-[280px] items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-[#8B949E] transition-colors hover:bg-[#161A1F] hover:text-[#F7F7F8]"
                aria-expanded={isAccountMenuOpen}
                aria-haspopup="menu"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#161A1F]">
                  <User className="h-4 w-4" />
                </span>
                <span className="hidden truncate sm:block">{user.email || "Signed in"}</span>
              </button>

              {isAccountMenuOpen ? (
                <div
                  className="absolute right-0 top-[calc(100%+10px)] z-50 w-72 rounded-xl border border-[#252A32] bg-[#111418] p-2 shadow-[0_22px_70px_rgba(0,0,0,0.42)]"
                  role="menu"
                >
                  <div className="border-b border-[#252A32] px-3 py-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6F7A88]">Account</div>
                    <div className="mt-1 truncate text-sm font-semibold text-[#E5E7EB]">{user.email || "Signed in"}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onSignOut();
                    }}
                    className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#A8B2C0] transition-colors hover:bg-[#1A1F27] hover:text-[#F7F7F8]"
                    role="menuitem"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
        {isDesktopApp ? (
          <div className="ml-2 flex h-14 items-center border-l border-[#20242A]">
            <button
              type="button"
              onClick={() => window.api?.minimizeWindow?.()}
              className="flex h-14 w-12 items-center justify-center text-[#8B949E] transition-colors hover:bg-[#161A1F] hover:text-[#F7F7F8]"
              title="Minimize"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => window.api?.toggleMaximizeWindow?.()}
              className="flex h-14 w-12 items-center justify-center text-[#8B949E] transition-colors hover:bg-[#161A1F] hover:text-[#F7F7F8]"
              title="Maximize"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => window.api?.closeWindow?.()}
              className="flex h-14 w-12 items-center justify-center text-[#8B949E] transition-colors hover:bg-red-500/80 hover:text-white"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function App() {
  const [persistedUiSettings] = useState(() => readPersistedUiSettings());
  const [appState, setAppState] = useState({
    tasks: isFirebaseConfigured() ? [] : MOCK_TASKS.map(normalizeTaskRecord),
    tagOptions: isFirebaseConfigured()
      ? []
      : Array.from(new Set(MOCK_TASKS.flatMap((task) => task.tags || []))).sort((a, b) => a.localeCompare(b)),
    workflows: []
  });
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [baseDate, setBaseDate] = useState(new Date());
  const [viewType, setViewType] = useState(persistedUiSettings.viewType || "week");
  const [taskSidebarWidth, setTaskSidebarWidth] = useState(persistedUiSettings.taskSidebarWidth || DEFAULT_TASK_SIDEBAR_WIDTH);
  const [isResizingTaskSidebar, setIsResizingTaskSidebar] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [isInspectorMounted, setIsInspectorMounted] = useState(false);
  const [isInspectorVisible, setIsInspectorVisible] = useState(false);
  const [inspectorShouldFocusTitle, setInspectorShouldFocusTitle] = useState(false);
  const [hoveredTaskId, setHoveredTaskId] = useState(null);
  const [hoveredTaskMeta, setHoveredTaskMeta] = useState(null);
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState([]);
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState("idle");
  const [googleCalendarError, setGoogleCalendarError] = useState("");
  const [googleCalendarAuthVersion, setGoogleCalendarAuthVersion] = useState(0);
  const [googleCalendarRefreshVersion, setGoogleCalendarRefreshVersion] = useState(0);
  const saveTimeoutRef = useRef(null);
  const inspectorCloseTimeoutRef = useRef(null);
  const remoteApplyingRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [, setDataBackend] = useState(() => (isFirebaseConfigured() ? "firebase" : "local"));
  const [authState, setAuthState] = useState(() => ({
    status: isFirebaseConfigured() ? "loading" : "disabled",
    user: null,
    error: null
  }));

  useEffect(() => {
    if (!isFirebaseConfigured()) return undefined;

    return onFirebaseAuthChange((user) => {
      setAuthState({
        status: user ? "signed-in" : "signed-out",
        user,
        error: null
      });
      setIsLoaded(false);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeFirebase = () => {};

    const applyStoredData = (data, source) => {
      const normalizedState = normalizeStoredAppState(data);
      if (normalizedState) {
        if (source === "firebase") {
          remoteApplyingRef.current = true;
        }
        setAppState(normalizedState);
      }
    };

    const loadLocalData = async ({ apply = true, includeLegacy = false } = {}) => {
      if (window.api && window.api.loadData) {
        try {
          const data = await window.api.loadData(authState.user?.uid || null, { includeLegacy });
          if (!cancelled && apply) {
            applyStoredData(data, "local");
          }
          return data;
        } catch (err) {
          console.error("Failed to load local data", err);
        }
      }

      return null;
    };

    const finishWithLocalData = async () => {
      await loadLocalData();
      if (!cancelled) {
        setDataBackend("local");
        setIsLoaded(true);
      }
    };

    if (isFirebaseConfigured() && authState.status !== "signed-in") {
      return () => {
        cancelled = true;
        unsubscribeFirebase();
      };
    }

    if (isFirebaseConfigured()) {
      unsubscribeFirebase = subscribeFirebaseAppState({
        user: authState.user,
        onData: async (remoteData) => {
          if (cancelled) return;

          if (remoteData?.tasks) {
            applyStoredData(remoteData, "firebase");
            setDataBackend("firebase");
            setIsLoaded(true);
            return;
          }

          const shouldClaimLegacyData = isLegacyOwnerUser(authState.user);
          const localData = shouldClaimLegacyData ? await loadLocalData({ apply: false, includeLegacy: true }) : null;
          const legacyFirebaseData =
            shouldClaimLegacyData && !localData?.tasks
              ? await loadLegacyFirebaseAppState().catch((err) => {
                  console.error("Failed to read legacy Firebase data", err);
                  return null;
                })
              : null;
          if (cancelled) return;

          setDataBackend("firebase");
          setIsLoaded(true);

          if (legacyFirebaseData?.tasks || localData?.tasks) {
            const normalizedLocalState = normalizeStoredAppState(legacyFirebaseData || localData);
            if (normalizedLocalState) {
              setAppState(normalizedLocalState);
              saveFirebaseAppState(authState.user, normalizedLocalState).catch((err) => {
                console.error("Failed to seed Firebase data", err);
              });
            }
          } else {
            setAppState(EMPTY_APP_STATE);
          }
        },
        onError: async (err) => {
          if (cancelled) return;

          console.error("Failed to subscribe to Firebase data", err);
          await finishWithLocalData();
        }
      });
    } else {
      queueMicrotask(() => {
        finishWithLocalData();
      });
    }

    return () => {
      cancelled = true;
      unsubscribeFirebase();
    };
  }, [authState.status, authState.user]);

  const openInspector = useCallback((taskId, options = {}) => {
    if (inspectorCloseTimeoutRef.current) {
      clearTimeout(inspectorCloseTimeoutRef.current);
      inspectorCloseTimeoutRef.current = null;
    }

    setEditingTaskId(taskId);
    setInspectorShouldFocusTitle(Boolean(options.focusTitle));
    setIsInspectorMounted(true);
    requestAnimationFrame(() => {
      setIsInspectorVisible(true);
    });
  }, []);

  const closeInspector = useCallback(() => {
    setIsInspectorVisible(false);
    if (inspectorCloseTimeoutRef.current) {
      clearTimeout(inspectorCloseTimeoutRef.current);
    }

    inspectorCloseTimeoutRef.current = setTimeout(() => {
      setIsInspectorMounted(false);
      setEditingTaskId(null);
      setInspectorShouldFocusTitle(false);
      inspectorCloseTimeoutRef.current = null;
    }, 340);
  }, []);

  useEffect(() => {
    return () => {
      if (inspectorCloseTimeoutRef.current) {
        clearTimeout(inspectorCloseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isLoaded) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        const saveLocalBackup = window.api?.saveData
          ? window.api.saveData(appState, authState.user?.uid || null).catch((err) => {
              console.error("Local save error:", err);
            })
          : Promise.resolve();

        if (remoteApplyingRef.current) {
          remoteApplyingRef.current = false;
          void saveLocalBackup;
          return;
        }

        if (isFirebaseConfigured()) {
          saveFirebaseAppState(authState.user, appState).catch((err) => {
            console.error("Firebase save error:", err);
          });
        }

        void saveLocalBackup;
      }, 1000);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [appState, isLoaded, authState.user]);

  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return;

    const uiSettings = {
      viewType,
      taskSidebarWidth
    };

    try {
      window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(uiSettings));
    } catch (error) {
      console.warn("Failed to save UI settings", error);
    }
  }, [viewType, taskSidebarWidth, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;

    const materializeTimeoutId = window.setTimeout(() => {
      setAppState((prev) => {
        const { nextState, createdCount } = materializeWorkflowTasks(prev, TASK_COLORS, new Date());
        return createdCount > 0 || nextState !== prev ? nextState : prev;
      });
    }, 0);

    return () => {
      window.clearTimeout(materializeTimeoutId);
    };
  }, [isLoaded, appState.workflows]);

  useEffect(() => {
    if (!isLoaded || authState.status !== "signed-in" || !getGoogleCalendarAccessToken()) return;

    const refreshGoogleCalendar = () => {
      if (document.visibilityState === "hidden") return;
      setGoogleCalendarRefreshVersion((current) => current + 1);
    };

    const intervalId = window.setInterval(refreshGoogleCalendar, GOOGLE_CALENDAR_REFRESH_INTERVAL_MS);
    const unsubscribeAppResumed = window.api?.onAppResumed?.(refreshGoogleCalendar);
    window.addEventListener("focus", refreshGoogleCalendar);
    document.addEventListener("visibilitychange", refreshGoogleCalendar);

    return () => {
      window.clearInterval(intervalId);
      unsubscribeAppResumed?.();
      window.removeEventListener("focus", refreshGoogleCalendar);
      document.removeEventListener("visibilitychange", refreshGoogleCalendar);
    };
  }, [authState.status, isLoaded, googleCalendarAuthVersion]);

  useEffect(() => {
    if (!isLoaded || authState.status !== "signed-in" || getGoogleCalendarAccessToken()) return;

    let cancelled = false;

    restoreGoogleCalendarAccessToken(authState.user)
      .then((accessToken) => {
        if (cancelled || !accessToken) return;
        setGoogleCalendarStatus("idle");
        setGoogleCalendarError("");
        setGoogleCalendarAuthVersion((current) => current + 1);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("Failed to restore Google Calendar access", error);
      });

    return () => {
      cancelled = true;
    };
  }, [authState.status, authState.user, isLoaded]);

  useEffect(() => {
    if (!isLoaded || authState.status !== "signed-in") {
      queueMicrotask(() => {
        setGoogleCalendarEvents([]);
        setGoogleCalendarStatus("idle");
        setGoogleCalendarError("");
      });
      return;
    }

    const accessToken = getGoogleCalendarAccessToken();
    if (!accessToken) {
      queueMicrotask(() => {
        setGoogleCalendarEvents([]);
        setGoogleCalendarStatus("needs-sign-in");
        setGoogleCalendarError("");
      });
      return;
    }

    let cancelled = false;
    const { timeMin, timeMax } = getCalendarFetchRange(baseDate, viewType);
    queueMicrotask(() => {
      if (!cancelled) {
        setGoogleCalendarStatus((current) => (current === "ready" ? "ready" : "loading"));
        setGoogleCalendarError("");
      }
    });

    fetchGoogleCalendarEvents({ accessToken, timeMin, timeMax })
      .then((events) => {
        if (cancelled) return;
        setGoogleCalendarEvents(events);
        setGoogleCalendarStatus("ready");
        setGoogleCalendarError("");
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to load Google Calendar events", error);
        setGoogleCalendarEvents([]);
        setGoogleCalendarStatus("error");
        setGoogleCalendarError(error.message || "Failed to load Google Calendar events.");
      });

    return () => {
      cancelled = true;
    };
  }, [authState.status, baseDate, googleCalendarAuthVersion, googleCalendarRefreshVersion, isLoaded, viewType]);

  const handleCreateInlineTask = useCallback(() => {
    const newTaskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    openInspector(newTaskId, { focusTitle: true });

    setAppState((prev) => {
      const nextColor = TASK_COLORS[prev.tasks.length % TASK_COLORS.length];

      return {
        ...prev,
        tasks: [
          ...prev.tasks,
          {
            id: newTaskId,
            title: "",
            color: nextColor,
            tags: [],
            deadline: null,
            description: "",
            scheduledDate: null,
            completed: false
          }
        ]
      };
    });
  }, [openInspector]);

  const handleUpdateTaskTitle = useCallback((taskId, newTitle) => {
    setAppState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, title: newTitle } : task))
    }));
  }, []);

  const handleUpdateTaskDetails = useCallback((taskId, updates) => {
    setAppState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.id === taskId ? normalizeTaskRecord({ ...task, ...updates }) : task))
    }));
  }, []);

  const handleDeleteTask = useCallback(
    (taskId) => {
      setAppState((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((task) => task.id !== taskId)
      }));

      if (selectedTaskId === taskId) {
        setTimeout(() => setSelectedTaskId(null), 0);
      }
    },
    [selectedTaskId]
  );

  const handleDeleteTaskFromInspector = useCallback(
    (taskId) => {
      closeInspector();
      handleDeleteTask(taskId);
    },
    [closeInspector, handleDeleteTask]
  );

  const handleScheduleTask = useCallback((taskId, dateKey, scheduledTime = null, scheduledDurationMinutes = undefined) => {
    setAppState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              scheduledDate: dateKey,
              scheduledTime,
              scheduledDurationMinutes:
                scheduledDurationMinutes === undefined
                  ? task.scheduledDurationMinutes || 60
                  : Math.max(15, Number(scheduledDurationMinutes) || 60)
            }
          : task
      )
    }));
  }, []);

  const handleMoveTask = useCallback((taskId, dateKey, scheduledTime = null, scheduledDurationMinutes = undefined) => {
    setAppState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              scheduledDate: dateKey,
              scheduledTime,
              scheduledDurationMinutes:
                scheduledDurationMinutes === undefined
                  ? task.scheduledDurationMinutes || 60
                  : Math.max(15, Number(scheduledDurationMinutes) || 60)
            }
          : task
      )
    }));
  }, []);

  const handleUnscheduleTask = useCallback((taskId) => {
    setAppState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, scheduledDate: null, scheduledTime: null } : task))
    }));
  }, []);

  const handleToggleTaskComplete = useCallback((taskId) => {
    setAppState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task))
    }));
  }, []);

  const handleCreateTagOption = useCallback((tagName) => {
    const trimmed = tagName.trim();
    if (!trimmed) return;

    setAppState((prev) => ({
      ...prev,
      tagOptions: prev.tagOptions.includes(trimmed) ? prev.tagOptions : [...prev.tagOptions, trimmed].sort((a, b) => a.localeCompare(b))
    }));
  }, []);

  const handleDeleteTagOption = useCallback((tagName) => {
    setAppState((prev) => ({
      ...prev,
      tagOptions: prev.tagOptions.filter((tag) => tag !== tagName),
      tasks: prev.tasks.map((task) => ({
        ...task,
        tags: (task.tags || []).filter((tag) => tag !== tagName)
      }))
    }));
  }, []);

  const handleRenameTagOption = useCallback((oldTagName, nextTagName) => {
    const trimmedNext = nextTagName.trim();
    if (!oldTagName || !trimmedNext || oldTagName === trimmedNext) return;

    setAppState((prev) => {
      const mergedTags = prev.tagOptions.map((tag) => (tag === oldTagName ? trimmedNext : tag));
      const uniqueTagOptions = Array.from(new Set(mergedTags)).sort((a, b) => a.localeCompare(b));

      return {
        ...prev,
        tagOptions: uniqueTagOptions,
        tasks: prev.tasks.map((task) => ({
          ...task,
          tags: Array.from(new Set((task.tags || []).map((tag) => (tag === oldTagName ? trimmedNext : tag))))
        }))
      };
    });

  }, []);

  const handleCreateWorkflow = useCallback((workflowDraft) => {
    const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    setAppState((prev) => {
      const normalizedWorkflow = normalizeWorkflowRecord(
        {
          ...workflowDraft,
          id: workflowId
        },
        prev.workflows.length,
        TASK_COLORS
      );

      return {
        ...prev,
        workflows: [...prev.workflows, normalizedWorkflow],
        tagOptions: Array.from(new Set([...prev.tagOptions, ...(normalizedWorkflow.template.tags || [])])).sort((a, b) =>
          a.localeCompare(b)
        )
      };
    });
  }, []);

  const handleToggleWorkflowEnabled = useCallback((workflowId) => {
    setAppState((prev) => ({
      ...prev,
      workflows: prev.workflows.map((workflow) =>
        workflow.id === workflowId ? { ...workflow, enabled: !workflow.enabled } : workflow
      )
    }));
  }, []);

  const handleDeleteWorkflow = useCallback((workflowId) => {
    setAppState((prev) => ({
      ...prev,
      workflows: prev.workflows.filter((workflow) => workflow.id !== workflowId)
    }));
  }, []);

  const tasksWithStats = appState.tasks.map((task) => {
    const stats = getTaskStats(task);
    return {
      ...task,
      ...stats,
      status: getTaskStatus(task)
    };
  });

  const visiblePoolTasks = tasksWithStats.filter((task) => !task.scheduledDate);
  const boardFilteredTasks = tasksWithStats.filter((task) => task.scheduledDate);
  const scheduledTasksByDate = groupTasksByScheduledDate(boardFilteredTasks);
  const availableTags = appState.tagOptions;
  const editingTaskData = editingTaskId ? appState.tasks.find((task) => task.id === editingTaskId) : null;

  const handleOpenTaskDetail = useCallback(
    (taskId, options = {}) => {
      openInspector(taskId, options);
    },
    [openInspector]
  );

  const handleHoverTask = useCallback((taskId, meta = null) => {
    setHoveredTaskId(taskId);
    setHoveredTaskMeta(taskId ? meta : null);
  }, []);

  const handleSignOut = useCallback(() => {
    closeInspector();
    setAuthState({
      status: "signed-out",
      user: null,
      error: null
    });
    setIsLoaded(false);
    setGoogleCalendarEvents([]);
    setGoogleCalendarStatus("idle");
    setGoogleCalendarError("");
    signOutFirebase().catch((error) => {
      console.error("Sign out failed", error);
      setAuthState((prev) => ({
        ...prev,
        error: error.message || "Sign out failed."
      }));
    });
  }, [closeInspector]);

  const handleReconnectGoogleCalendar = useCallback(async () => {
    setGoogleCalendarStatus("loading");
    setGoogleCalendarError("");

    try {
      await signInWithGoogle();
      setGoogleCalendarAuthVersion((current) => current + 1);
    } catch (error) {
      console.error("Google Calendar reconnect failed", error);
      setGoogleCalendarStatus("error");
      setGoogleCalendarError(error.message || "Google Calendar reconnect failed.");
    }
  }, []);

  const handleTaskSidebarResizeStart = useCallback((event) => {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = taskSidebarWidth;
    const maxWidthForViewport = Math.min(MAX_TASK_SIDEBAR_WIDTH, Math.max(MIN_TASK_SIDEBAR_WIDTH, window.innerWidth - 520));

    setIsResizingTaskSidebar(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handlePointerMove = (moveEvent) => {
      const nextWidth = Math.min(maxWidthForViewport, Math.max(MIN_TASK_SIDEBAR_WIDTH, startWidth + moveEvent.clientX - startX));
      setTaskSidebarWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setIsResizingTaskSidebar(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }, [taskSidebarWidth]);

  const hoveredTask = hoveredTaskId ? tasksWithStats.find((task) => task.id === hoveredTaskId) : null;
  const hoveredTaskDeadlineKey = hoveredTaskMeta?.deadlineDateKey || hoveredTask?.deadline || null;

  if (!isLoaded) {
    if (isFirebaseConfigured() && authState.status !== "signed-in") {
      return (
          <AuthGate
            authState={authState}
            onGoogleSignIn={signInWithGoogle}
            onSignIn={signInWithEmail}
            onCreateAccount={createAccountWithEmail}
          />
      );
    }

    return <div className="flex h-screen items-center justify-center bg-[#06080A] font-medium text-[#8B949E]">Loading...</div>;
  }

  return (
    <MainLayout
      header={
        <AppHeader
          user={authState.user}
          onSignOut={handleSignOut}
        />
      }
    >
      <div className="relative flex h-full min-w-0 flex-1">
        <div
          className="shrink-0 bg-[#06080A]"
          style={{
            width: `${taskSidebarWidth}px`,
            minWidth: `${MIN_TASK_SIDEBAR_WIDTH}px`
          }}
        >
          <TaskPool
            tasks={visiblePoolTasks}
            workflows={appState.workflows}
            editingTaskId={editingTaskId}
            selectedTaskId={selectedTaskId}
            hoveredTaskId={hoveredTaskId}
            onSelectTask={setSelectedTaskId}
            onCreateInlineTask={handleCreateInlineTask}
            onCreateWorkflow={handleCreateWorkflow}
            onToggleWorkflowEnabled={handleToggleWorkflowEnabled}
            onDeleteWorkflow={handleDeleteWorkflow}
            onDeleteTask={handleDeleteTask}
            onUpdateTaskTitle={handleUpdateTaskTitle}
            onOpenDetail={handleOpenTaskDetail}
            onHoverTask={handleHoverTask}
            onUnscheduleTask={handleUnscheduleTask}
            availableTags={availableTags}
          />
        </div>

        <div
          className={`group relative z-30 w-2 shrink-0 cursor-col-resize bg-[#06080A] transition-colors ${
            isResizingTaskSidebar ? "bg-[#101820]" : "hover:bg-[#0C1116]"
          }`}
          onPointerDown={handleTaskSidebarResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="タスク一覧の幅を変更"
        >
          <div
            className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors ${
              isResizingTaskSidebar ? "bg-[#67D391]" : "bg-[#20242A] group-hover:bg-[#67D391]/70"
            }`}
          />
          <div
            className={`absolute left-1/2 top-1/2 h-14 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors ${
              isResizingTaskSidebar ? "bg-[#67D391]" : "bg-transparent group-hover:bg-[#67D391]/60"
            }`}
          />
        </div>

        {isInspectorMounted && editingTaskData ? (
          <div
            className={`absolute inset-y-0 left-0 z-40 h-full overflow-visible transition-[width] duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)] 2xl:static 2xl:shrink-0 ${
              isInspectorVisible ? "w-72 pointer-events-auto xl:w-80 2xl:w-[380px]" : "w-0 pointer-events-none"
            }`}
          >
            <div
              className={`h-full w-72 xl:w-80 2xl:w-[380px] transition-[opacity,transform] duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isInspectorVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
              }`}
            >
              <HandDrawnPopup
                key={editingTaskData.id}
                task={editingTaskData}
                availableTags={availableTags}
                onCreateTag={handleCreateTagOption}
                onDeleteTag={handleDeleteTagOption}
                onRenameTag={handleRenameTagOption}
                onClose={closeInspector}
                onUpdate={handleUpdateTaskDetails}
                onDelete={handleDeleteTaskFromInspector}
                autoFocusTitle={inspectorShouldFocusTitle}
              />
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1 overflow-hidden bg-[#06080A]">
          <CalendarArea
            baseDate={baseDate}
            setBaseDate={setBaseDate}
            viewType={viewType}
            setViewType={setViewType}
            scheduledTasksByDate={scheduledTasksByDate}
            tasks={boardFilteredTasks}
            googleCalendarEvents={googleCalendarEvents}
            googleCalendarStatus={googleCalendarStatus}
            googleCalendarError={googleCalendarError}
            onReconnectGoogleCalendar={handleReconnectGoogleCalendar}
            hoveredTaskId={hoveredTaskId}
            hoveredTaskDeadline={hoveredTaskDeadlineKey}
            onScheduleTask={handleScheduleTask}
            onUnscheduleTask={handleUnscheduleTask}
            onMoveTask={handleMoveTask}
            onToggleTaskComplete={handleToggleTaskComplete}
            onHoverTask={handleHoverTask}
            onOpenDetail={handleOpenTaskDetail}
          />
        </div>
      </div>
    </MainLayout>
  );
}

export default App;




