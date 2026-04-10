import { useState, useCallback, useRef, useEffect } from "react";
import MainLayout from "./components/layout/MainLayout";
import TaskPool from "./components/TaskPool/TaskPool";
import CalendarArea from "./components/CalendarArea/CalendarArea";
import HandDrawnPopup from "./components/Common/HandDrawnPopup";
import { getTaskStats, getTaskStatus, hasTaskAssignmentOnDate } from "./utils/taskTime";
import { getRecurringDeadlineDateKey, isRecurringTask, syncRecurringAssignmentsForTask } from "./utils/recurrence";

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
    id: "p1",
    title: "Q4 Product Launch",
    color: TASK_COLORS[0],
    isExpanded: true,
    tags: ["Strategic"],
    deadline: "2026-04-30",
    description: "Launch planning and cross-team coordination",
    placementType: "manual",
    recurrence: null
  },
  {
    id: "t1",
    parentId: "p1",
    title: "User interview synthesis",
    color: TASK_COLORS[0],
    tags: ["Research"],
    deadline: "2026-04-10",
    description: "Summarize recent user interviews",
    placementType: "manual",
    recurrence: null
  },
  {
    id: "t2",
    parentId: "p1",
    title: "Landing page polish",
    color: TASK_COLORS[0],
    tags: ["Design"],
    deadline: "2026-04-15",
    description: "Tighten copy and final visuals",
    placementType: "manual",
    recurrence: null
  },
  {
    id: "t3",
    title: "API cleanup",
    color: TASK_COLORS[2],
    tags: ["Dev", "Refactor"],
    deadline: "2026-04-20",
    description: "Reduce legacy endpoints and simplify payloads",
    placementType: "manual",
    recurrence: null
  }
];

const normalizeTaskRecord = (task) => ({
  ...task,
  placementType: task?.placementType === "recurring" || task?.placementType === "auto" ? "recurring" : "manual",
  recurrence: (task?.placementType === "recurring" || task?.placementType === "auto") && task?.recurrence ? task.recurrence : null
});

const normalizeLoadedBoardState = (boardState = {}) =>
  Object.fromEntries(
    Object.entries(boardState).map(([dateKey, assignments]) => [
      dateKey,
      (assignments || []).map((assignment) => ({
        id: assignment.id,
        taskId: assignment.taskId,
        completed: Boolean(assignment.completed),
        source: assignment.source === "auto" ? "auto" : assignment.source === "recurring" ? "recurring" : "manual",
        recurrenceTaskId: assignment.recurrenceTaskId || null,
        recurrenceKey: assignment.recurrenceKey || null
      }))
    ])
  );

const filterAssignmentsForVisibleTasks = (boardState, visibleTaskIds) =>
  Object.fromEntries(
    Object.entries(boardState)
      .map(([dateKey, assignments]) => [dateKey, assignments.filter((assignment) => visibleTaskIds.has(assignment.taskId))])
      .filter(([, assignments]) => assignments.length > 0)
  );

function App() {
  const [persistedUiSettings] = useState(() => readPersistedUiSettings());
  const [appState, setAppState] = useState({
    tasks: MOCK_TASKS.map(normalizeTaskRecord),
    tagOptions: Array.from(new Set(MOCK_TASKS.flatMap((task) => task.tags || []))).sort((a, b) => a.localeCompare(b)),
    boardState: {} // `dateKey` -> array of { id, taskId, completed }
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
            const normalizedBoardState = normalizeLoadedBoardState(data.boardState || {});

            setAppState({
              tasks: data.tasks.map((task) => {
                const { totalTime: _totalTime, ...rest } = task;
                return normalizeTaskRecord(rest);
              }),
              tagOptions: Array.from(new Set((data.tagOptions || data.tasks.flatMap((task) => task.tags || [])))).sort((a, b) => a.localeCompare(b)),
                boardState: normalizedBoardState
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

  const handleCreateInlineTask = useCallback((parentId = null) => {
    const newTaskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    openInspector(newTaskId, { focusTitle: true });

    setAppState((prev) => {
      const parentTask = parentId ? prev.tasks.find((task) => task.id === parentId) : null;
      const nextColor = parentTask?.color || TASK_COLORS[prev.tasks.length % TASK_COLORS.length];

      const newTasks = [
        ...prev.tasks,
        {
          id: newTaskId,
          title: "",
          color: nextColor,
          parentId,
          isExpanded: true,
          tags: [],
          deadline: null,
          description: "",
          placementType: "manual",
          recurrence: null
        }
      ].map((task) => (task.id === parentId ? { ...task, isExpanded: true } : task));

      return { ...prev, tasks: newTasks };
    });
  }, [openInspector]);

  const handleUpdateTaskTitle = useCallback((taskId, newTitle) => {
    setAppState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, title: newTitle } : task))
    }));
  }, []);

  const handleUpdateTaskDetails = useCallback((taskId, updates) => {
    setAppState((prev) => {
      const currentTask = prev.tasks.find((task) => task.id === taskId);
      if (!currentTask) return prev;

      const nextTasks = prev.tasks.map((task) => (task.id === taskId ? normalizeTaskRecord({ ...task, ...updates }) : task));
      const nextTask = nextTasks.find((task) => task.id === taskId);
      const currentRecurring = isRecurringTask(currentTask);
      const nextRecurring = isRecurringTask(nextTask);
      const recurrenceChanged =
        currentTask.deadline !== nextTask.deadline ||
        currentTask.placementType !== nextTask.placementType ||
        JSON.stringify(currentTask.recurrence || null) !== JSON.stringify(nextTask.recurrence || null);

      const nextBoardState = recurrenceChanged && (currentRecurring || nextRecurring)
        ? syncRecurringAssignmentsForTask(prev.boardState, nextTask)
        : prev.boardState;

      if (!recurrenceChanged) {
        return { ...prev, tasks: nextTasks };
      }

      return {
        ...prev,
        tasks: nextTasks,
        boardState: nextBoardState
      };
    });
  }, []);

  const handleDeleteTask = useCallback(
    (taskId) => {
      setAppState((prev) => {
        const taskIdsToDelete = new Set([taskId]);

        const collectDescendants = (parentId) => {
          prev.tasks
            .filter((task) => task.parentId === parentId)
            .forEach((child) => {
              taskIdsToDelete.add(child.id);
              collectDescendants(child.id);
            });
        };

        collectDescendants(taskId);

        if (taskIdsToDelete.has(selectedTaskId)) {
          setTimeout(() => setSelectedTaskId(null), 0);
        }

        const nextBoardState = Object.fromEntries(
          Object.entries(prev.boardState)
            .map(([dateKey, assignments]) => [
              dateKey,
              assignments.filter((assignment) => !taskIdsToDelete.has(assignment.taskId))
            ])
            .filter(([, assignments]) => assignments.length > 0)
        );

        return {
          ...prev,
          tasks: prev.tasks.filter((task) => !taskIdsToDelete.has(task.id)),
          boardState: nextBoardState
        };
      });
    },
    [selectedTaskId]
  );

  const handleToggleParent = useCallback((taskId) => {
    setAppState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, isExpanded: !task.isExpanded } : task))
    }));
  }, []);

  const handleMoveAssignment = useCallback((sourceDateKey, targetDateKey, assignmentId) => {
    if (sourceDateKey === targetDateKey) return;

    setAppState((prev) => {
      const sourceAssignments = prev.boardState[sourceDateKey] || [];
      const assignmentToMove = sourceAssignments.find((assignment) => assignment.id === assignmentId);
      if (!assignmentToMove) return prev;

      if (hasTaskAssignmentOnDate(prev.boardState, targetDateKey, assignmentToMove.taskId, assignmentId)) {
        return prev;
      }

      const nextSourceAssignments = sourceAssignments.filter((assignment) => assignment.id !== assignmentId);
      const nextTargetAssignments = [...(prev.boardState[targetDateKey] || []), assignmentToMove];
      const nextBoardState = { ...prev.boardState, [targetDateKey]: nextTargetAssignments };

      if (nextSourceAssignments.length > 0) {
        nextBoardState[sourceDateKey] = nextSourceAssignments;
      } else {
        delete nextBoardState[sourceDateKey];
      }

      return { ...prev, boardState: nextBoardState };
    });
  }, []);

  const handleDeleteAssignment = useCallback((dateKey, assignmentId) => {
    setAppState((prev) => {
      const dayAssignments = prev.boardState[dateKey] || [];
      const nextAssignments = dayAssignments.filter((assignment) => assignment.id !== assignmentId);
      const nextBoardState = { ...prev.boardState };

      if (nextAssignments.length > 0) {
        nextBoardState[dateKey] = nextAssignments;
      } else {
        delete nextBoardState[dateKey];
      }

      return { ...prev, boardState: nextBoardState };
    });
  }, []);

  const handleAddAssignmentFromSidebar = useCallback((taskId, dateKey) => {
    setAppState((prev) => ({
      ...prev,
      boardState: hasTaskAssignmentOnDate(prev.boardState, dateKey, taskId)
        ? prev.boardState
        : {
            ...prev.boardState,
            [dateKey]: [
              ...(prev.boardState[dateKey] || []),
              {
                id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                taskId,
                completed: false,
                source: prev.tasks.find((task) => task.id === taskId)?.placementType === "recurring" ? "auto" : "manual"
              }
            ]
          }
    }));
  }, []);

  const handleToggleAssignmentComplete = useCallback((dateKey, assignmentId) => {
    setAppState((prev) => {
      const dayAssignments = prev.boardState[dateKey] || [];
      const targetAssignment = dayAssignments.find((assignment) => assignment.id === assignmentId);
      if (!targetAssignment) return prev;

      const nextDayAssignments = dayAssignments.map((assignment) =>
        assignment.id === assignmentId ? { ...assignment, completed: !assignment.completed } : assignment
      );

      let nextBoardState = {
        ...prev.boardState,
        [dateKey]: nextDayAssignments
      };

      const targetTask = prev.tasks.find((task) => task.id === targetAssignment.taskId);
      const shouldAdvance = targetTask && isRecurringTask(targetTask) && !targetAssignment.completed;

      if (shouldAdvance) {
        nextBoardState = syncRecurringAssignmentsForTask(nextBoardState, targetTask);
      }

      return {
        ...prev,
        boardState: nextBoardState
      };
    });
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
          tags: Array.from(
            new Set((task.tags || []).map((tag) => (tag === oldTagName ? trimmedNext : tag)))
          )
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

  const tasksWithStats = appState.tasks.map((task) => {
    const stats = getTaskStats(task.id, appState.tasks, appState.boardState);
    return {
      ...task,
      ...stats,
      status: getTaskStatus(task.id, appState.tasks, appState.boardState)
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

  const visiblePoolTasks = filteredTasks;

  const boardFilteredTasks = filterTasks(tasksWithStats, boardFilterConfig);
  const visibleTaskIds = new Set(boardFilteredTasks.map((task) => task.id));
  const filteredBoardState = filterAssignmentsForVisibleTasks(appState.boardState, visibleTaskIds);
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
  const hoveredRecurringAssignmentDateKey =
    hoveredTask && hoveredTask.placementType === "recurring"
      ? Object.entries(appState.boardState)
          .flatMap(([dateKey, assignments]) =>
            assignments.some((assignment) => assignment.taskId === hoveredTask.id) ? [dateKey] : []
          )
          .sort()
          .at(-1) || null
      : null;
  const hoveredTaskDeadlineKey =
    hoveredTaskMeta?.deadlineDateKey ||
    (hoveredTask?.placementType === "recurring"
      ? getRecurringDeadlineDateKey(hoveredTask, hoveredRecurringAssignmentDateKey || hoveredTask.deadline)
      : hoveredTask?.deadline || null);
  if (!isLoaded) {
    return <div className="flex h-screen items-center justify-center bg-[#F8F9FB] font-medium text-slate-500">Loading...</div>;
  }

  return (
    <MainLayout>
      <div className="flex h-full min-w-0 flex-1 gap-6">
        <div className="w-[360px] min-w-[320px] shrink-0">
          <TaskPool
            tasks={visiblePoolTasks}
            allTasks={tasksWithStats}
            editingTaskId={editingTaskId}
            selectedTaskId={selectedTaskId}
            hoveredTaskId={hoveredTaskId}
            onSelectTask={setSelectedTaskId}
            onToggleParent={handleToggleParent}
            onCreateInlineTask={handleCreateInlineTask}
            onDeleteTask={handleDeleteTask}
            onUpdateTaskTitle={handleUpdateTaskTitle}
            onOpenDetail={handleOpenTaskDetail}
            onHoverTask={handleHoverTask}
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
            boardState={filteredBoardState}
            tasks={boardFilteredTasks}
            hoveredTaskId={hoveredTaskId}
            hoveredTaskDeadline={hoveredTaskDeadlineKey}
            onAddAssignmentFromSidebar={handleAddAssignmentFromSidebar}
            onDeleteAssignment={handleDeleteAssignment}
            onMoveAssignment={handleMoveAssignment}
            onToggleAssignmentComplete={handleToggleAssignmentComplete}
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
