import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Bell, LogOut, Minus, Settings2, ShieldCheck, Square, User, X } from "lucide-react";
import MainLayout from "./components/layout/MainLayout";
import TaskPool from "./components/TaskPool/TaskPool";
import CalendarArea from "./components/CalendarArea/CalendarArea";
import HandDrawnPopup from "./components/Common/HandDrawnPopup";
import LogoMark from "./components/Common/LogoMark";
import { getTaskStats, getTaskStatus } from "./utils/taskTime";
import { materializeWorkflowTasks, normalizeWorkflowRecord } from "./utils/workflows";
import { addMonths, addWeeks, startOfWeek } from "./utils/dateUtils";
import { normalizeNoteBlocks } from "./utils/noteBlocks";
import {
  ALL_TASKS_VIEW_ID,
  DEFAULT_STATUS_OPTIONS,
  filterTasksByView,
  normalizeStatusOptions,
  normalizeTagOptions,
  normalizeViews,
  sortTasksByView
} from "./utils/taskViews";
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
const COLLAPSED_TASK_SIDEBAR_RAIL_WIDTH = 18;
const GOOGLE_SIGN_IN_TIMEOUT_MS = 90 * 1000;

const EMPTY_APP_STATE = {
  tasks: [],
  tagOptions: [],
  statusOptions: DEFAULT_STATUS_OPTIONS,
  views: [],
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
      taskSidebarCollapsed: parsed.taskSidebarCollapsed === true,
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
  noteBlocks: normalizeNoteBlocks(task.noteBlocks, task.description || ""),
  scheduledDate: task.scheduledDate || null,
  scheduledTime: task.scheduledTime || null,
  scheduledDurationMinutes: Number.isFinite(Number(task.scheduledDurationMinutes))
    ? Math.max(15, Number(task.scheduledDurationMinutes))
    : 60,
  completed: Boolean(task.completed),
  statusId: task.completed ? "completed" : task.statusId || task.status || "not-started",
  previousStatusId: task.previousStatusId || null,
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
    tagOptions: normalizeTagOptions(data.tagOptions || migratedTasks.flatMap((task) => task.tags || [])),
    statusOptions: normalizeStatusOptions(data.statusOptions),
    views: normalizeViews(data.views),
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
        <LogoMark className="h-8 w-8 shrink-0" />
        <h1 className="text-lg font-semibold leading-6 tracking-tight text-[#F7F7F8]">banboo</h1>
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
          <LogoMark className="mb-4 h-11 w-11" />
          <h1 className="text-2xl font-semibold text-[#F4F4F5]">banboo</h1>
          <p className="mt-2 text-sm leading-6 text-[#A1A1AA]">Sign in to keep tasks synced across your devices.</p>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleSubmitting || isSubmitting || authState.status === "loading"}
          className="mb-4 flex w-full items-center justify-center gap-3 rounded-md bg-[#F4F4F5] px-4 py-3 text-sm font-semibold text-[#15161A] transition hover:bg-white disabled:cursor-not-allowed disabled:bg-[#52525B] disabled:text-[#A1A1AA]"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-[#60B964]">
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
            className="w-full rounded-md border border-[#34363D] bg-[#15161A] px-3 py-2 text-sm text-[#F4F4F5] outline-none focus:border-[#60B964] focus:ring-2 focus:ring-[#60B964]/25"
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
            className="w-full rounded-md border border-[#34363D] bg-[#15161A] px-3 py-2 text-sm text-[#F4F4F5] outline-none focus:border-[#60B964] focus:ring-2 focus:ring-[#60B964]/25"
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
          className="w-full rounded-md bg-[#60B964] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#54A85C] disabled:cursor-not-allowed disabled:bg-[#52525B]"
        >
          {isSubmitting ? "Please wait..." : mode === "create" ? "Create account" : "Sign in"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((current) => (current === "create" ? "signin" : "create"));
            setErrorMessage("");
          }}
          className="mt-3 w-full rounded-md border border-[#34363D] px-4 py-2 text-sm font-medium text-[#78D27F] transition hover:bg-[#25272F]"
        >
          {mode === "create" ? "Use an existing account" : "Create a new account"}
        </button>

        <div className="mt-5 flex items-center gap-2 rounded-md border border-[#34363D] bg-[#15161A] px-3 py-2 text-xs text-[#A1A1AA]">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#60B964]" />
          <span>Google authentication protects each user's private workspace.</span>
        </div>
      </form>
    </div>
  );
}

function AppSettingsScreen({ user, googleCalendarStatus, googleCalendarError, onReconnectGoogleCalendar, onBack }) {
  const [activeTab, setActiveTab] = useState("account");
  const tabs = [
    { id: "account", label: "アカウント" },
    { id: "calendar", label: "Googleカレンダー" },
    { id: "display", label: "表示" },
    { id: "sync", label: "データと同期" },
    { id: "about", label: "アプリ情報" }
  ];

  const renderContent = () => {
    if (activeTab === "account") {
      return (
        <section className="rounded-xl border border-[#2A2F37] bg-[#111418] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B949E]">Account</div>
          <div className="mt-4 flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1C1D22] text-[#AAB4C2]">
              <User className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-[#F7F7F8]">{user?.email || "Signed in"}</div>
              <div className="mt-0.5 text-xs font-semibold text-[#8B949E]">Google アカウント</div>
            </div>
          </div>
        </section>
      );
    }

    if (activeTab === "calendar") {
      const isCalendarReady = googleCalendarStatus === "ready";
      const statusLabel =
        isCalendarReady
          ? "接続済み"
          : googleCalendarStatus === "loading"
            ? "接続確認中"
            : googleCalendarStatus === "error"
              ? "再接続が必要"
              : "未接続";
      return (
        <section className="rounded-xl border border-[#2A2F37] bg-[#111418] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B949E]">Google Calendar</div>
              <h3 className="mt-2 text-lg font-bold text-[#F7F7F8]">予定の表示</h3>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-[#8B949E]">
                ログイン中のGoogleアカウントの予定を週表示に読み込みます。banboo側から予定の編集は行いません。
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                isCalendarReady ? "bg-[#1F3423] text-[#78D27F]" : "bg-[#25272F] text-[#AAB4C2]"
              }`}
            >
              {statusLabel}
            </span>
          </div>
          {googleCalendarError ? <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">{googleCalendarError}</div> : null}
          <button
            type="button"
            onClick={onReconnectGoogleCalendar}
            disabled={googleCalendarStatus === "loading"}
            className="mt-5 rounded-lg bg-[#60B964] px-4 py-2 text-sm font-bold text-[#06100D] transition-colors hover:bg-[#54A85C] disabled:cursor-wait disabled:opacity-70"
          >
            {isCalendarReady ? "Googleカレンダーを再接続" : googleCalendarStatus === "loading" ? "接続中..." : "Googleカレンダーを接続"}
          </button>
        </section>
      );
    }

    if (activeTab === "display") {
      return (
        <section className="rounded-xl border border-[#2A2F37] bg-[#111418] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B949E]">Display</div>
          <h3 className="mt-2 text-lg font-bold text-[#F7F7F8]">表示設定</h3>
          <div className="mt-4 space-y-3 text-sm font-semibold text-[#AAB4C2]">
            <div className="rounded-lg border border-[#2A2F37] bg-[#15171C] px-4 py-3">テーマはダークモード固定です。</div>
            <div className="rounded-lg border border-[#2A2F37] bg-[#15171C] px-4 py-3">左サイドバー幅とカレンダー表示は現在の操作状態を保存します。</div>
          </div>
        </section>
      );
    }

    if (activeTab === "sync") {
      return (
        <section className="rounded-xl border border-[#2A2F37] bg-[#111418] p-5">
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B949E]">Data</div>
          <h3 className="mt-2 text-lg font-bold text-[#F7F7F8]">データと同期</h3>
          <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-[#8B949E]">
            タスク、ビュー、ワークフロー、タグ、ステータスはログイン中のユーザーごとにFirebaseへ保存されます。
          </p>
        </section>
      );
    }

    return (
      <section className="rounded-xl border border-[#2A2F37] bg-[#111418] p-5">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#8B949E]">About</div>
        <h3 className="mt-2 text-lg font-bold text-[#F7F7F8]">banboo</h3>
        <p className="mt-2 text-sm font-semibold text-[#8B949E]">タスクをカレンダーに配置して、予定と一緒に時間管理するためのアプリです。</p>
      </section>
    );
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[#06080A]">
      <div className="flex h-14 shrink-0 items-center border-b border-[#20242A] px-6">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#AAB4C2] transition-colors hover:bg-[#111418] hover:text-[#F7F7F8]"
          title="戻る"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="mb-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#8B949E]">SETTINGS</div>
          <h2 className="mt-1 text-xl font-bold text-[#F7F7F8]">設定</h2>
        </div>
        <div className="grid w-full max-w-[980px] grid-cols-[220px_minmax(0,1fr)] gap-6">
          <nav className="space-y-1 border-r border-[#20242A] pr-5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors ${
                  activeTab === tab.id ? "bg-[#1F3423] text-[#78D27F]" : "text-[#AAB4C2] hover:bg-[#111418] hover:text-[#F7F7F8]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="min-w-0 max-w-[620px]">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
}

function AppHeader({ user, onSignOut, onOpenSettings }) {
  const isDesktopApp = Boolean(window.api?.isDesktopApp);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [accountMenuPosition, setAccountMenuPosition] = useState({ top: 56, right: 12 });
  const accountMenuRef = useRef(null);
  const accountPanelRef = useRef(null);

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    const handlePointerDown = (event) => {
      if (accountMenuRef.current?.contains(event.target)) return;
      if (accountPanelRef.current?.contains(event.target)) return;
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
      className="relative z-[70] flex h-14 shrink-0 items-center justify-between border-b border-[#20242A] bg-[#0B0E11]/95 pl-4 backdrop-blur"
      style={isDesktopApp ? { WebkitAppRegion: "drag" } : undefined}
    >
      <div className="flex min-w-0 items-center gap-4" style={isDesktopApp ? { WebkitAppRegion: "no-drag" } : undefined}>
        <LogoMark className="h-8 w-8 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-6 tracking-tight text-[#F7F7F8]">banboo</h1>
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
        {user ? (
          <>
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setAccountMenuPosition({
                    top: rect.bottom + 10,
                    right: Math.max(12, window.innerWidth - rect.right)
                  });
                  setIsAccountMenuOpen((current) => !current);
                }}
                className="flex max-w-[280px] items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-[#8B949E] transition-colors hover:bg-[#161A1F] hover:text-[#F7F7F8]"
                aria-expanded={isAccountMenuOpen}
                aria-haspopup="menu"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#161A1F]">
                  <User className="h-4 w-4" />
                </span>
                <span className="hidden truncate sm:block">{user.email || "Signed in"}</span>
              </button>

              {isAccountMenuOpen
                ? createPortal(
                <div
                  ref={accountPanelRef}
                  className="fixed z-[160] w-72 rounded-xl border border-[#252A32] bg-[#111418] p-2 shadow-[0_22px_70px_rgba(0,0,0,0.42)]"
                  style={{ top: accountMenuPosition.top, right: accountMenuPosition.right }}
                  role="menu"
                >
                  <div className="border-b border-[#252A32] px-3 py-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6F7A88]">ACCOUNT</div>
                    <div className="mt-1 truncate text-sm font-semibold text-[#E5E7EB]">{user.email || "Signed in"}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onOpenSettings?.();
                    }}
                    className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-[#D7DEE8] transition-colors hover:bg-[#1A1F27] hover:text-[#F7F7F8]"
                    role="menuitem"
                  >
                    <Settings2 className="h-4 w-4 text-[#8B949E]" />
                    アプリ設定
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onSignOut();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-[#D7DEE8] transition-colors hover:bg-[#1A1F27] hover:text-[#F7F7F8]"
                    role="menuitem"
                  >
                    <LogOut className="h-4 w-4 text-[#8B949E]" />
                    サインアウト
                  </button>
                </div>,
                document.body
              )
                : null}
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
    tagOptions: isFirebaseConfigured() ? [] : normalizeTagOptions(MOCK_TASKS.flatMap((task) => task.tags || [])),
    statusOptions: DEFAULT_STATUS_OPTIONS,
    views: [],
    workflows: []
  });
  const [activeScreen, setActiveScreen] = useState("calendar");
  const [activeTaskViewId, setActiveTaskViewId] = useState(ALL_TASKS_VIEW_ID);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [baseDate, setBaseDate] = useState(new Date());
  const [viewType, setViewType] = useState(persistedUiSettings.viewType || "week");
  const [taskSidebarWidth, setTaskSidebarWidth] = useState(persistedUiSettings.taskSidebarWidth || DEFAULT_TASK_SIDEBAR_WIDTH);
  const [isTaskSidebarCollapsed, setIsTaskSidebarCollapsed] = useState(Boolean(persistedUiSettings.taskSidebarCollapsed));
  const [isTaskSidebarPeeking, setIsTaskSidebarPeeking] = useState(false);
  const [isTaskSidebarDragPeeking, setIsTaskSidebarDragPeeking] = useState(false);
  const [isTaskSidebarInspectorPinned, setIsTaskSidebarInspectorPinned] = useState(false);
  const [isResizingTaskSidebar, setIsResizingTaskSidebar] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [isInspectorMounted, setIsInspectorMounted] = useState(false);
  const [isInspectorVisible, setIsInspectorVisible] = useState(false);
  const [isInspectorClosing, setIsInspectorClosing] = useState(false);
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
  const inspectorOpenAnimationRef = useRef(false);
  const taskSidebarContainerRef = useRef(null);
  const droppedOnPeekingSidebarRef = useRef(false);
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

    if (isTaskSidebarCollapsed && (options.pinTaskSidebar || isTaskSidebarPeeking || isTaskSidebarDragPeeking)) {
      setIsTaskSidebarInspectorPinned(true);
      setIsTaskSidebarPeeking(true);
      setIsTaskSidebarDragPeeking(false);
    }

    setEditingTaskId(taskId);
    setInspectorShouldFocusTitle(Boolean(options.focusTitle));
    setIsInspectorClosing(false);
    if (!isInspectorMounted || !isInspectorVisible || editingTaskId !== taskId) {
      setIsInspectorVisible(false);
      inspectorOpenAnimationRef.current = true;
    }
    setIsInspectorMounted(true);
  }, [editingTaskId, isInspectorMounted, isInspectorVisible, isTaskSidebarCollapsed, isTaskSidebarDragPeeking, isTaskSidebarPeeking]);

  const closeInspector = useCallback(() => {
    inspectorOpenAnimationRef.current = false;
    setIsInspectorVisible(false);
    setIsInspectorClosing(true);
    setIsTaskSidebarInspectorPinned(false);
    if (isTaskSidebarCollapsed) {
      setIsTaskSidebarPeeking(false);
      setIsTaskSidebarDragPeeking(false);
    }

    if (inspectorCloseTimeoutRef.current) {
      clearTimeout(inspectorCloseTimeoutRef.current);
    }

    inspectorCloseTimeoutRef.current = setTimeout(() => {
      setIsInspectorMounted(false);
      setIsInspectorClosing(false);
      setEditingTaskId(null);
      setInspectorShouldFocusTitle(false);
      inspectorCloseTimeoutRef.current = null;
    }, 460);
  }, [isTaskSidebarCollapsed]);

  const toggleTaskSidebar = useCallback(() => {
    setIsTaskSidebarCollapsed((current) => !current);
    setIsTaskSidebarPeeking(false);
    setIsTaskSidebarDragPeeking(false);
    setIsTaskSidebarInspectorPinned(false);
  }, []);

  useEffect(() => {
    return () => {
      if (inspectorCloseTimeoutRef.current) {
        clearTimeout(inspectorCloseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isTaskSidebarDragPeeking) return undefined;

    const clearDragPeek = () => {
      setIsTaskSidebarDragPeeking(false);
      setIsTaskSidebarPeeking(false);
    };

    const handleDrop = (event) => {
      if (taskSidebarContainerRef.current?.contains(event.target)) {
        droppedOnPeekingSidebarRef.current = true;
        setIsTaskSidebarDragPeeking(false);
        setIsTaskSidebarPeeking(true);
        return;
      }

      clearDragPeek();
    };

    const handleDragEnd = () => {
      if (droppedOnPeekingSidebarRef.current) {
        droppedOnPeekingSidebarRef.current = false;
        setIsTaskSidebarDragPeeking(false);
        setIsTaskSidebarPeeking(true);
        return;
      }

      clearDragPeek();
    };

    const handleDragMove = (event) => {
      if (event.clientX > taskSidebarWidth + 24) {
        clearDragPeek();
      }
    };

    window.addEventListener("dragover", handleDragMove);
    window.addEventListener("dragend", handleDragEnd);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragover", handleDragMove);
      window.removeEventListener("dragend", handleDragEnd);
      window.removeEventListener("drop", handleDrop);
    };
  }, [isTaskSidebarDragPeeking, taskSidebarWidth]);

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
      taskSidebarWidth,
      taskSidebarCollapsed: isTaskSidebarCollapsed
    };

    try {
      window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(uiSettings));
    } catch (error) {
      console.warn("Failed to save UI settings", error);
    }
  }, [viewType, taskSidebarWidth, isTaskSidebarCollapsed, isLoaded]);

  useEffect(() => {
    document.documentElement.style.colorScheme = "dark";
    document.documentElement.classList.remove("theme-light");
    document.documentElement.classList.add("theme-dark");
  }, []);

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

    openInspector(newTaskId, { focusTitle: true, pinTaskSidebar: true });

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
            noteBlocks: [],
            scheduledDate: null,
            completed: false,
            statusId: "not-started",
            previousStatusId: null
          }
        ]
      };
    });
  }, [openInspector]);

  const handleUpdateTaskDetails = useCallback((taskId, updates) => {
    setAppState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const merged = { ...task, ...updates };
        if (updates.completed === true) {
          merged.previousStatusId = task.statusId === "completed" ? task.previousStatusId : task.statusId || "not-started";
          merged.statusId = "completed";
        }
        if (updates.completed === false && task.completed) {
          merged.statusId =
            task.previousStatusId && prev.statusOptions.some((status) => status.id === task.previousStatusId)
              ? task.previousStatusId
              : "not-started";
          merged.previousStatusId = null;
        }
        if (updates.statusId && updates.statusId !== "completed") {
          merged.completed = false;
          merged.previousStatusId = null;
        }
        if (updates.statusId === "completed") {
          merged.completed = true;
          merged.previousStatusId = task.statusId === "completed" ? task.previousStatusId : task.statusId || "not-started";
        }
        return normalizeTaskRecord(merged);
      })
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
      tasks: prev.tasks.map((task) => {
        if (task.id !== taskId) return task;
        if (task.completed) {
          const restoredStatusId =
            task.previousStatusId && prev.statusOptions.some((status) => status.id === task.previousStatusId)
              ? task.previousStatusId
              : "not-started";
          return { ...task, completed: false, statusId: restoredStatusId, previousStatusId: null };
        }

        return {
          ...task,
          completed: true,
          previousStatusId: task.statusId === "completed" ? task.previousStatusId : task.statusId || "not-started",
          statusId: "completed"
        };
      })
    }));
  }, []);

  const handleCreateTagOption = useCallback((tagName) => {
    const trimmed = tagName.trim();
    if (!trimmed) return;

    setAppState((prev) => ({
      ...prev,
      tagOptions: prev.tagOptions.includes(trimmed) ? prev.tagOptions : [...prev.tagOptions, trimmed]
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
      const uniqueTagOptions = normalizeTagOptions(mergedTags);

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

  const handleReorderTagOptions = useCallback((fromIndex, toIndex) => {
    setAppState((prev) => {
      const nextTags = [...prev.tagOptions];
      const [moved] = nextTags.splice(fromIndex, 1);
      nextTags.splice(toIndex, 0, moved);
      return { ...prev, tagOptions: nextTags };
    });
  }, []);

  const handleCreateStatusOption = useCallback((statusName) => {
    const trimmed = statusName.trim();
    if (!trimmed) return;
    setAppState((prev) => ({
      ...prev,
      statusOptions: [...prev.statusOptions, { id: `status_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: trimmed, standard: false }]
    }));
  }, []);

  const handleRenameStatusOption = useCallback((statusId, nextName) => {
    const trimmed = nextName.trim();
    if (!statusId || !trimmed) return;
    setAppState((prev) => ({
      ...prev,
      statusOptions: prev.statusOptions.map((status) => (status.id === statusId ? { ...status, name: trimmed } : status))
    }));
  }, []);

  const handleDeleteStatusOption = useCallback((statusId) => {
    setAppState((prev) => {
      const status = prev.statusOptions.find((item) => item.id === statusId);
      if (!status || status.standard) return prev;
      return {
        ...prev,
        statusOptions: prev.statusOptions.filter((item) => item.id !== statusId),
        tasks: prev.tasks.map((task) => ({
          ...task,
          statusId: task.statusId === statusId ? "not-started" : task.statusId,
          previousStatusId: task.previousStatusId === statusId ? "not-started" : task.previousStatusId
        }))
      };
    });
  }, []);

  const handleReorderStatusOptions = useCallback((fromIndex, toIndex) => {
    setAppState((prev) => {
      const nextStatuses = [...prev.statusOptions];
      const [moved] = nextStatuses.splice(fromIndex, 1);
      nextStatuses.splice(toIndex, 0, moved);
      return { ...prev, statusOptions: nextStatuses };
    });
  }, []);

  const handleSaveTaskView = useCallback((viewDraft) => {
    setAppState((prev) => {
      const normalizedView = {
        id: viewDraft.id || `view_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: viewDraft.name?.trim() || "新しいビュー",
        locked: false,
        filters: Array.isArray(viewDraft.filters) ? viewDraft.filters : [],
        sorts: Array.isArray(viewDraft.sorts) ? viewDraft.sorts : []
      };
      const exists = prev.views.some((view) => view.id === normalizedView.id);
      const views = exists
        ? prev.views.map((view) => (view.id === normalizedView.id ? { ...view, ...normalizedView } : view))
        : [...prev.views, normalizedView];
      setActiveTaskViewId(normalizedView.id);
      return { ...prev, views };
    });
  }, []);

  const handleDeleteTaskView = useCallback((viewId) => {
    setAppState((prev) => {
      const views = normalizeViews(prev.views);
      if (views.length <= 1) return prev;

      const nextViews = views.filter((view) => view.id !== viewId);
      if (nextViews.length === views.length || nextViews.length === 0) return prev;

      setActiveTaskViewId((current) => (current === viewId ? nextViews[0].id : current));
      return { ...prev, views: nextViews };
    });
  }, []);

  const handleReorderTaskViews = useCallback((fromIndex, toIndex) => {
    setAppState((prev) => {
      const views = normalizeViews(prev.views);
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= views.length || toIndex >= views.length) return prev;
      const nextViews = [...views];
      const [moved] = nextViews.splice(fromIndex, 1);
      nextViews.splice(toIndex, 0, moved);
      return { ...prev, views: nextViews };
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
        tagOptions: normalizeTagOptions([...prev.tagOptions, ...(normalizedWorkflow.template.tags || [])])
      };
    });
  }, []);

  const handleUpdateWorkflow = useCallback((workflowDraft) => {
    setAppState((prev) => {
      const workflowIndex = prev.workflows.findIndex((workflow) => workflow.id === workflowDraft.id);
      if (workflowIndex < 0) return prev;

      const previousWorkflow = prev.workflows[workflowIndex];
      const normalizedWorkflow = normalizeWorkflowRecord(
        {
          ...previousWorkflow,
          ...workflowDraft,
          id: previousWorkflow.id,
          generatedRunKeys: previousWorkflow.generatedRunKeys || []
        },
        workflowIndex,
        TASK_COLORS
      );

      return {
        ...prev,
        workflows: prev.workflows.map((workflow) => (workflow.id === normalizedWorkflow.id ? normalizedWorkflow : workflow)),
        tagOptions: normalizeTagOptions([...prev.tagOptions, ...(normalizedWorkflow.template.tags || [])])
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
      status: getTaskStatus(task),
      statusId: task.completed ? "completed" : task.statusId || "not-started"
    };
  });

  const taskViews = normalizeViews(appState.views);
  const statusOptions = normalizeStatusOptions(appState.statusOptions);
  const activeTaskView = taskViews.find((view) => view.id === activeTaskViewId) || taskViews[0];
  const visiblePoolTasks = sortTasksByView(
    filterTasksByView(tasksWithStats, activeTaskView),
    activeTaskView,
    appState.tagOptions,
    statusOptions
  );
  const boardFilteredTasks = tasksWithStats.filter((task) => task.scheduledDate);
  const scheduledTasksByDate = groupTasksByScheduledDate(boardFilteredTasks);
  const availableTags = appState.tagOptions;
  const editingTaskData = editingTaskId ? appState.tasks.find((task) => task.id === editingTaskId) : null;

  useEffect(() => {
    if (!inspectorOpenAnimationRef.current || !isInspectorMounted || !editingTaskData || isInspectorVisible) return undefined;

    let nextFrameId = null;
    const frameId = requestAnimationFrame(() => {
      nextFrameId = requestAnimationFrame(() => {
        inspectorOpenAnimationRef.current = false;
        setIsInspectorVisible(true);
      });
    });

    return () => {
      cancelAnimationFrame(frameId);
      if (nextFrameId) cancelAnimationFrame(nextFrameId);
    };
  }, [editingTaskData, isInspectorMounted, isInspectorVisible]);

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

  const handleJumpToScheduledTask = useCallback((task) => {
    if (!task?.scheduledDate) {
      openInspector(task.id);
      return;
    }

    const [year, month, day] = task.scheduledDate.split("-").map(Number);
    if (year && month && day) {
      setBaseDate(new Date(year, month - 1, day));
    }
    setSelectedTaskId(task.id);
    setHoveredTaskId(task.id);
    setHoveredTaskMeta({ deadlineDateKey: task.deadline || null });
    window.setTimeout(() => setHoveredTaskId((current) => (current === task.id ? null : current)), 1500);
  }, [openInspector]);

  const handleSignOut = useCallback(() => {
    closeInspector();
    setActiveScreen("calendar");
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
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = taskSidebarWidth;
    const maxWidthForViewport = Math.min(MAX_TASK_SIDEBAR_WIDTH, Math.max(MIN_TASK_SIDEBAR_WIDTH, window.innerWidth - 520));

    setIsResizingTaskSidebar(true);
    if (isTaskSidebarCollapsed) {
      setIsTaskSidebarPeeking(true);
      setIsTaskSidebarDragPeeking(false);
    }
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
  }, [isTaskSidebarCollapsed, taskSidebarWidth]);

  const hoveredTask = hoveredTaskId ? tasksWithStats.find((task) => task.id === hoveredTaskId) : null;
  const hoveredTaskDeadlineKey = hoveredTaskMeta?.deadlineDateKey || hoveredTask?.deadline || null;
  const shouldShowTaskSidebar = !isTaskSidebarCollapsed || isTaskSidebarPeeking || isTaskSidebarDragPeeking || isTaskSidebarInspectorPinned;
  const taskSidebarSlotMotionClass =
    !isResizingTaskSidebar
      ? "transition-[width,min-width,max-width,flex-basis] duration-[760ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
      : "transition-none";
  const taskSidebarMotionClass = "transition-transform duration-[760ms] ease-[cubic-bezier(0.16,1,0.3,1)]";
  const taskSidebarSlotWidth = isTaskSidebarCollapsed ? COLLAPSED_TASK_SIDEBAR_RAIL_WIDTH : taskSidebarWidth;

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
    <MainLayout header={<AppHeader user={authState.user} onSignOut={handleSignOut} onOpenSettings={() => setActiveScreen("settings")} />}>
      {activeScreen === "settings" ? (
        <AppSettingsScreen
          user={authState.user}
          googleCalendarStatus={googleCalendarStatus}
          googleCalendarError={googleCalendarError}
          onReconnectGoogleCalendar={handleReconnectGoogleCalendar}
          onBack={() => setActiveScreen("calendar")}
        />
      ) : (
      <div className="relative flex h-full min-w-0 flex-1 overflow-hidden">
        <div
          className={`relative z-40 shrink-0 overflow-visible bg-[#06080A] ${taskSidebarSlotMotionClass}`}
          style={{
            width: `${taskSidebarSlotWidth}px`,
            flexBasis: `${taskSidebarSlotWidth}px`,
            minWidth: `${taskSidebarSlotWidth}px`,
            maxWidth: `${taskSidebarSlotWidth}px`
          }}
        >
          <div
            ref={taskSidebarContainerRef}
            className={`absolute inset-y-0 left-0 z-10 bg-[#06080A] ${taskSidebarMotionClass} ${
              isTaskSidebarCollapsed && shouldShowTaskSidebar ? "shadow-[18px_0_50px_rgba(0,0,0,0.32)]" : ""
            } ${shouldShowTaskSidebar ? "translate-x-0" : "-translate-x-[110%] pointer-events-none"}`}
            style={{
              width: `${taskSidebarWidth}px`,
              minWidth: `${MIN_TASK_SIDEBAR_WIDTH}px`
            }}
            onMouseEnter={() => {
              if (isTaskSidebarCollapsed) setIsTaskSidebarPeeking(true);
            }}
            onMouseLeave={() => {
              if (isTaskSidebarCollapsed && !isResizingTaskSidebar && !isTaskSidebarDragPeeking && !isTaskSidebarInspectorPinned) {
                setIsTaskSidebarPeeking(false);
              }
            }}
            onDragEnter={(event) => {
              if (!isTaskSidebarCollapsed) return;
              event.preventDefault();
              setIsTaskSidebarDragPeeking(true);
              setIsTaskSidebarPeeking(true);
            }}
            onDragOver={(event) => {
              if (!isTaskSidebarCollapsed) return;
              event.preventDefault();
              setIsTaskSidebarDragPeeking(true);
              setIsTaskSidebarPeeking(true);
            }}
            onDrop={() => {
              setIsTaskSidebarDragPeeking(false);
              setIsTaskSidebarPeeking(true);
              droppedOnPeekingSidebarRef.current = true;
            }}
          >
            <TaskPool
              tasks={visiblePoolTasks}
              views={taskViews}
              activeViewId={activeTaskView.id}
              taskSidebarWidth={taskSidebarWidth}
              statusOptions={statusOptions}
              workflows={appState.workflows}
              selectedTaskId={selectedTaskId}
              hoveredTaskId={hoveredTaskId}
              onSelectTask={setSelectedTaskId}
              onSelectView={setActiveTaskViewId}
              onSaveView={handleSaveTaskView}
              onDeleteView={handleDeleteTaskView}
              onReorderView={handleReorderTaskViews}
              onCreateInlineTask={handleCreateInlineTask}
              onCreateWorkflow={handleCreateWorkflow}
              onUpdateWorkflow={handleUpdateWorkflow}
              onToggleWorkflowEnabled={handleToggleWorkflowEnabled}
              onDeleteWorkflow={handleDeleteWorkflow}
              onDeleteTask={handleDeleteTask}
              onOpenDetail={handleOpenTaskDetail}
              onJumpToScheduledTask={handleJumpToScheduledTask}
              onHoverTask={handleHoverTask}
              onUnscheduleTask={handleUnscheduleTask}
              availableTags={availableTags}
              onCreateTag={handleCreateTagOption}
              onRenameTag={handleRenameTagOption}
              onDeleteTag={handleDeleteTagOption}
              onReorderTag={handleReorderTagOptions}
              onCreateStatus={handleCreateStatusOption}
              onRenameStatus={handleRenameStatusOption}
              onDeleteStatus={handleDeleteStatusOption}
              onReorderStatus={handleReorderStatusOptions}
            />

            {isTaskSidebarCollapsed ? (
              <div
                className={`group absolute inset-y-0 right-[-4px] z-30 w-3 cursor-col-resize transition-colors ${
                  isResizingTaskSidebar ? "bg-[#101820]" : "hover:bg-[#0C1116]/80"
                }`}
                onPointerDown={handleTaskSidebarResizeStart}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize task sidebar"
              >
                <div
                  className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors ${
                    isResizingTaskSidebar ? "bg-[#78D27F]" : "bg-[#20242A] group-hover:bg-[#78D27F]/70"
                  }`}
                />
                <div
                  className={`absolute left-1/2 top-1/2 h-14 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors ${
                    isResizingTaskSidebar ? "bg-[#78D27F]" : "bg-transparent group-hover:bg-[#78D27F]/60"
                  }`}
                />
              </div>
            ) : null}
          </div>

          {isTaskSidebarCollapsed ? (
            <div
              className="group absolute inset-y-0 left-0 z-0 cursor-pointer bg-[#06080A] transition-colors hover:bg-[#0C1116]"
              style={{ width: `${COLLAPSED_TASK_SIDEBAR_RAIL_WIDTH}px` }}
              onMouseEnter={() => setIsTaskSidebarPeeking(true)}
              onMouseLeave={() => {
                if (!isResizingTaskSidebar && !isTaskSidebarDragPeeking && !isTaskSidebarInspectorPinned) setIsTaskSidebarPeeking(false);
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsTaskSidebarDragPeeking(true);
                setIsTaskSidebarPeeking(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsTaskSidebarDragPeeking(true);
                setIsTaskSidebarPeeking(true);
              }}
              onDragLeave={() => {}}
              onClick={() => {
                toggleTaskSidebar();
              }}
              role="button"
              tabIndex={0}
              aria-label="Toggle task sidebar"
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleTaskSidebar();
                }
              }}
            >
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#20242A] transition-colors group-hover:bg-[#78D27F]/70" />
              <div
                className={`absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-[#78D27F] shadow-[0_0_22px_rgba(120,210,127,0.45)] transition-opacity ${
                  isTaskSidebarPeeking ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              />
            </div>
          ) : null}
        </div>

        {!isTaskSidebarCollapsed ? (
          <div
            className={`group relative z-30 w-2 shrink-0 cursor-col-resize bg-[#06080A] transition-colors ${
              isResizingTaskSidebar ? "bg-[#101820]" : "hover:bg-[#0C1116]"
            }`}
            onPointerDown={handleTaskSidebarResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize task sidebar"
          >
            <div
              className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors ${
                isResizingTaskSidebar ? "bg-[#78D27F]" : "bg-[#20242A] group-hover:bg-[#78D27F]/70"
              }`}
            />
            <div
              className={`absolute left-1/2 top-1/2 h-14 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors ${
                isResizingTaskSidebar ? "bg-[#78D27F]" : "bg-transparent group-hover:bg-[#78D27F]/60"
              }`}
            />
          </div>
        ) : null}

        {isInspectorMounted && editingTaskData ? (
          <div
            className={`absolute inset-y-0 right-0 z-50 h-full w-[min(720px,calc(100vw-48px))] overflow-visible ${
              isInspectorVisible ? "pointer-events-auto" : "pointer-events-none"
            }`}
          >
            <div
              className={`task-inspector-panel h-full w-[min(720px,calc(100vw-48px))] ${
                isInspectorVisible ? "is-open" : isInspectorClosing ? "is-closed" : ""
              }`}
            >
              <HandDrawnPopup
                key={editingTaskData.id}
                task={editingTaskData}
                availableTags={availableTags}
                statusOptions={statusOptions}
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
            isTaskSidebarCollapsed={isTaskSidebarCollapsed}
            onToggleTaskSidebar={toggleTaskSidebar}
          />
        </div>
      </div>
      )}
    </MainLayout>
  );
}

export default App;




