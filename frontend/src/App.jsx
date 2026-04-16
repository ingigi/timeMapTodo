import { useState, useCallback, useRef, useEffect } from "react";
import MainLayout from "./components/layout/MainLayout";
import TaskPool from "./components/TaskPool/TaskPool";
import CalendarArea from "./components/CalendarArea/CalendarArea";
import HandDrawnPopup from "./components/Common/HandDrawnPopup";
import { getTaskStats, getTaskStatus } from "./utils/taskTime";
import { materializeWorkflowTasks, normalizeWorkflowRecord } from "./utils/workflows";

const TASK_COLORS = ["#5B8DEF", "#4FB7A8", "#D9A441", "#8A7FD1", "#7FA36B", "#C97B63", "#5FA3B7", "#C27A92"];
const UI_STORAGE_KEY = "timemaptodo-ui-settings-v1";

const DEFAULT_TASK_LIST_FILTER_CONFIG = { statuses: [], tags: [] };
const DEFAULT_BOARD_FILTER_CONFIG = { statuses: [], tags: [] };
const DEFAULT_SORT_CONFIG = { key: "deadline", order: "asc" };

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

function App() {
  const [persistedUiSettings] = useState(() => readPersistedUiSettings());
  const [appState, setAppState] = useState({
    tasks: MOCK_TASKS.map(normalizeTaskRecord),
    tagOptions: Array.from(new Set(MOCK_TASKS.flatMap((task) => task.tags || []))).sort((a, b) => a.localeCompare(b)),
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
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (window.api && window.api.loadData) {
      window.api
        .loadData()
        .then((data) => {
          if (cancelled) return;

          if (data && data.tasks) {
            const migratedTasks = migrateLegacyTasks(data.tasks, data.boardState || {});

            setAppState({
              tasks: migratedTasks,
              tagOptions: Array.from(new Set((data.tagOptions || migratedTasks.flatMap((task) => task.tags || [])))).sort((a, b) =>
                a.localeCompare(b)
              ),
              workflows: Array.isArray(data.workflows)
                ? data.workflows.map((workflow, index) => normalizeWorkflowRecord(workflow, index, TASK_COLORS))
                : []
            });
          }
          setIsLoaded(true);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error("Failed to load data", err);
          setIsLoaded(true);
        });
    } else {
      queueMicrotask(() => {
        if (!cancelled) {
          setIsLoaded(true);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (isLoaded && window.api && window.api.saveData) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        window.api.saveData(appState).catch((err) => {
          console.error("Save error:", err);
        });
      }, 1000);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [appState, isLoaded]);

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

    setAppState((prev) => {
      const { nextState, createdCount } = materializeWorkflowTasks(prev, TASK_COLORS, new Date());
      return createdCount > 0 || nextState !== prev ? nextState : prev;
    });
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
    </MainLayout>
  );
}

export default App;
