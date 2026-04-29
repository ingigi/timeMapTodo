import { useState, useCallback, useRef, useEffect } from "react";
import MainLayout from "./components/layout/MainLayout";
import TaskPool from "./components/TaskPool/TaskPool";
import CalendarArea from "./components/CalendarArea/CalendarArea";
import HandDrawnPopup from "./components/Common/HandDrawnPopup";
import { getTaskStats, getTaskStatus } from "./utils/taskTime";
import { materializeWorkflowTasks, normalizeWorkflowRecord } from "./utils/workflows";
import {
  createAccountWithEmail,
  getFirebaseLegacyOwnerEmail,
  getFirebaseWorkspaceId,
  isFirebaseConfigured,
  loadLegacyFirebaseAppState,
  onFirebaseAuthChange,
  saveFirebaseAppState,
  signInWithEmail,
  signInWithGoogle,
  signOutFirebase,
  subscribeFirebaseAppState
} from "./services/firebaseAppState";

const TASK_COLORS = ["#5B8DEF", "#4FB7A8", "#D9A441", "#8A7FD1", "#7FA36B", "#C97B63", "#5FA3B7", "#C27A92"];
const UI_STORAGE_KEY = "timemaptodo-ui-settings-v1";

const DEFAULT_TASK_LIST_FILTER_CONFIG = { statuses: [], tags: [] };
const DEFAULT_BOARD_FILTER_CONFIG = { statuses: [], tags: [] };
const DEFAULT_SORT_CONFIG = { key: "deadline", order: "asc" };
const EMPTY_APP_STATE = {
  tasks: [],
  tagOptions: [],
  workflows: []
};

const readPersistedUiSettings = () => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(UI_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return {
      viewType: parsed.viewType === "month" ? "month" : "week",
      taskListFilterConfig: {
        statuses: Array.isArray(parsed.taskListFilterConfig?.statuses) ? parsed.taskListFilterConfig.statuses : [],
        tags: Array.isArray(parsed.taskListFilterConfig?.tags) ? parsed.taskListFilterConfig.tags : []
      },
      boardFilterConfig: {
        statuses: Array.isArray(parsed.boardFilterConfig?.statuses) ? parsed.boardFilterConfig.statuses : [],
        tags: Array.isArray(parsed.boardFilterConfig?.tags) ? parsed.boardFilterConfig.tags : []
      },
      sortConfig:
        parsed.sortConfig?.key && ["deadline", "scheduledCount", "title", "status"].includes(parsed.sortConfig.key)
          ? {
              key: parsed.sortConfig.key,
              order: parsed.sortConfig.order === "desc" ? "desc" : "asc"
            }
          : undefined
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

function AuthGate({ authState, onGoogleSignIn, onSignIn, onCreateAccount }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    setErrorMessage("");
    setIsGoogleSubmitting(true);

    try {
      await onGoogleSignIn();
    } catch (error) {
      setErrorMessage(error.message || "Google sign-in failed.");
    } finally {
      setIsGoogleSubmitting(false);
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
    <div className="flex h-screen items-center justify-center bg-[#F8F9FB] px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-[380px] rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">TimeMapTodo</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Sign in with Google to sync tasks securely with Firebase.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleSubmitting || isSubmitting || authState.status === "loading"}
          className="mb-4 flex w-full items-center justify-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-xs font-bold text-blue-600">
            G
          </span>
          {isGoogleSubmitting ? "Opening Google..." : "Continue with Google"}
        </button>

        <div className="mb-4 flex items-center gap-3 text-xs font-medium text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          Email backup
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            autoComplete="email"
            required
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            autoComplete={mode === "create" ? "new-password" : "current-password"}
            minLength={6}
            required
          />
        </label>

        {errorMessage || authState.error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage || authState.error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || isGoogleSubmitting || authState.status === "loading"}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? "Please wait..." : mode === "create" ? "Create account" : "Sign in"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((current) => (current === "create" ? "signin" : "create"));
            setErrorMessage("");
          }}
          className="mt-3 w-full rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          {mode === "create" ? "Use an existing account" : "Create a new account"}
        </button>
      </form>
    </div>
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
  const [taskListFilterConfig, setTaskListFilterConfig] = useState(
    persistedUiSettings.taskListFilterConfig || DEFAULT_TASK_LIST_FILTER_CONFIG
  );
  const [boardFilterConfig, setBoardFilterConfig] = useState(
    persistedUiSettings.boardFilterConfig || DEFAULT_BOARD_FILTER_CONFIG
  );
  const [sortConfig, setSortConfig] = useState(persistedUiSettings.sortConfig || DEFAULT_SORT_CONFIG);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [isInspectorMounted, setIsInspectorMounted] = useState(false);
  const [isInspectorVisible, setIsInspectorVisible] = useState(false);
  const [inspectorShouldFocusTitle, setInspectorShouldFocusTitle] = useState(false);
  const [hoveredTaskId, setHoveredTaskId] = useState(null);
  const [hoveredTaskMeta, setHoveredTaskMeta] = useState(null);
  const saveTimeoutRef = useRef(null);
  const inspectorCloseTimeoutRef = useRef(null);
  const remoteApplyingRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [dataBackend, setDataBackend] = useState(() => (isFirebaseConfigured() ? "firebase" : "local"));
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
    }, 240);
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
      taskListFilterConfig,
      boardFilterConfig,
      sortConfig
    };

    try {
      window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(uiSettings));
    } catch (error) {
      console.warn("Failed to save UI settings", error);
    }
  }, [viewType, taskListFilterConfig, boardFilterConfig, sortConfig, isLoaded]);

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

  const handleScheduleTask = useCallback((taskId, dateKey) => {
    setAppState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, scheduledDate: dateKey } : task))
    }));
  }, []);

  const handleMoveTask = useCallback((taskId, dateKey) => {
    setAppState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, scheduledDate: dateKey } : task))
    }));
  }, []);

  const handleUnscheduleTask = useCallback((taskId) => {
    setAppState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, scheduledDate: null } : task))
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
    setTaskListFilterConfig((prev) => ({
      ...prev,
      tags: (prev.tags || []).filter((tag) => tag !== tagName)
    }));
    setBoardFilterConfig((prev) => ({
      ...prev,
      tags: (prev.tags || []).filter((tag) => tag !== tagName)
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

    setTaskListFilterConfig((prev) => ({
      ...prev,
      tags: (prev.tags || []).map((tag) => (tag === oldTagName ? trimmedNext : tag))
    }));
    setBoardFilterConfig((prev) => ({
      ...prev,
      tags: (prev.tags || []).map((tag) => (tag === oldTagName ? trimmedNext : tag))
    }));
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

  const filterTasks = useCallback((sourceTasks, filterConfig) => {
    return sourceTasks
      .filter((task) => {
        if (!filterConfig.statuses?.length) return true;
        return filterConfig.statuses.includes(task.status.toLowerCase());
      })
      .filter((task) => {
        if (!filterConfig.tags?.length) return true;
        return filterConfig.tags.some((tag) => task.tags?.includes(tag));
      });
  }, []);

  const filteredTasks = filterTasks(tasksWithStats, taskListFilterConfig).sort((a, b) => {
    const order = sortConfig.order === "asc" ? 1 : -1;

    if (sortConfig.key === "deadline") return (a.deadline || "").localeCompare(b.deadline || "") * order;
    if (sortConfig.key === "scheduledCount") return (a.scheduledCount - b.scheduledCount) * order;
    if (sortConfig.key === "title") return (a.title || "").localeCompare(b.title || "") * order;
    if (sortConfig.key === "status") return a.status.localeCompare(b.status) * order;
    return 0;
  });

  const visiblePoolTasks = filteredTasks.filter((task) => !task.scheduledDate);
  const boardFilteredTasks = filterTasks(tasksWithStats.filter((task) => task.scheduledDate), boardFilterConfig);
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

    return <div className="flex h-screen items-center justify-center bg-[#F8F9FB] font-medium text-slate-500">Loading...</div>;
  }

  return (
    <MainLayout>
      <div className="flex h-full min-w-0 flex-1 gap-6">
        <div className="w-[360px] min-w-[320px] shrink-0">
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
            filterConfig={taskListFilterConfig}
            setFilterConfig={setTaskListFilterConfig}
            sortConfig={sortConfig}
            setSortConfig={setSortConfig}
            availableTags={availableTags}
            onCreateTag={handleCreateTagOption}
            onDeleteTag={handleDeleteTagOption}
            onRenameTag={handleRenameTagOption}
          />
        </div>

        {isInspectorMounted && editingTaskData ? (
          <div
            className={`h-full shrink-0 overflow-hidden transition-[width,opacity,transform,margin] duration-300 ease-out ${
              isInspectorVisible
                ? "w-[380px] opacity-100 translate-x-0 mx-0"
                : "w-0 opacity-0 -translate-x-4 -mx-6 pointer-events-none"
            }`}
          >
            <div className="h-full w-[380px]">
              <HandDrawnPopup
                key={editingTaskData.id}
                task={editingTaskData}
                availableTags={availableTags}
                onCreateTag={handleCreateTagOption}
                onDeleteTag={handleDeleteTagOption}
                onRenameTag={handleRenameTagOption}
                onClose={closeInspector}
                onUpdate={handleUpdateTaskDetails}
                autoFocusTitle={inspectorShouldFocusTitle}
              />
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1 overflow-hidden rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <CalendarArea
            baseDate={baseDate}
            setBaseDate={setBaseDate}
            viewType={viewType}
            setViewType={setViewType}
            scheduledTasksByDate={scheduledTasksByDate}
            tasks={boardFilteredTasks}
            hoveredTaskId={hoveredTaskId}
            hoveredTaskDeadline={hoveredTaskDeadlineKey}
            onScheduleTask={handleScheduleTask}
            onUnscheduleTask={handleUnscheduleTask}
            onMoveTask={handleMoveTask}
            onToggleTaskComplete={handleToggleTaskComplete}
            onHoverTask={handleHoverTask}
            onOpenDetail={handleOpenTaskDetail}
            boardFilterConfig={boardFilterConfig}
            setBoardFilterConfig={setBoardFilterConfig}
            availableTags={availableTags}
            onCreateTag={handleCreateTagOption}
            onDeleteTag={handleDeleteTagOption}
            onRenameTag={handleRenameTagOption}
          />
        </div>
      </div>
      <div className="fixed bottom-3 right-4 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-medium text-slate-500 shadow-sm backdrop-blur">
        {dataBackend === "firebase" ? `Firebase: ${getFirebaseWorkspaceId()} / ${authState.user?.email || "signed in"}` : "Local only"}
        {authState.user ? (
          <button type="button" onClick={signOutFirebase} className="ml-2 border-l border-slate-200 pl-2 text-slate-700 hover:text-slate-950">
            Sign out
          </button>
        ) : null}
      </div>
    </MainLayout>
  );
}

export default App;
