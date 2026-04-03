import { useState, useCallback, useRef, useEffect } from "react";
import MainLayout from "./components/layout/MainLayout";
import TaskPool from "./components/TaskPool/TaskPool";
import CalendarArea from "./components/CalendarArea/CalendarArea";
import HandDrawnPopup from "./components/Common/HandDrawnPopup";
import { getTaskStats, getTaskStatus } from "./utils/taskTime";

const TASK_COLORS = ["#5B8DEF", "#4FB7A8", "#D9A441", "#8A7FD1", "#7FA36B", "#C97B63", "#5FA3B7", "#C27A92"];

const MOCK_TASKS = [
  {
    id: "p1",
    title: "Q4 Product Launch",
    color: TASK_COLORS[0],
    isExpanded: true,
    tags: ["Strategic"],
    deadline: "2026-04-30",
    description: "Launch planning and cross-team coordination"
  },
  {
    id: "t1",
    parentId: "p1",
    title: "User interview synthesis",
    color: TASK_COLORS[0],
    tags: ["Research"],
    deadline: "2026-04-10",
    description: "Summarize recent user interviews"
  },
  {
    id: "t2",
    parentId: "p1",
    title: "Landing page polish",
    color: TASK_COLORS[0],
    tags: ["Design"],
    deadline: "2026-04-15",
    description: "Tighten copy and final visuals"
  },
  {
    id: "t3",
    title: "API cleanup",
    color: TASK_COLORS[2],
    tags: ["Dev", "Refactor"],
    deadline: "2026-04-20",
    description: "Reduce legacy endpoints and simplify payloads"
  }
];

function App() {
  const [appState, setAppState] = useState({
    tasks: MOCK_TASKS,
    tagOptions: Array.from(new Set(MOCK_TASKS.flatMap((task) => task.tags || []))).sort((a, b) => a.localeCompare(b)),
    boardState: {} // `dateKey` -> array of { id, taskId, completed }
  });
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [baseDate, setBaseDate] = useState(new Date());
  const [viewType, setViewType] = useState("week");
  const [filterConfig, setFilterConfig] = useState({ statuses: [], tag: "all" });
  const [sortConfig, setSortConfig] = useState({ key: "deadline", order: "asc" });
  const [editingTask, setEditingTask] = useState(null);
  const [hoveredTaskId, setHoveredTaskId] = useState(null);
  const saveTimeoutRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (window.api && window.api.loadData) {
      window.api
        .loadData()
        .then((data) => {
          if (data && data.tasks) {
            const normalizedBoardState = Object.fromEntries(
              Object.entries(data.boardState || {}).map(([dateKey, assignments]) => [
                dateKey,
                assignments.map((assignment) => ({
                  id: assignment.id,
                  taskId: assignment.taskId,
                  completed: Boolean(assignment.completed)
                }))
              ])
            );

            setAppState({
              tasks: data.tasks.map((task) => {
                const { totalTime, ...rest } = task;
                return rest;
              }),
              tagOptions: Array.from(new Set((data.tagOptions || data.tasks.flatMap((task) => task.tags || [])))).sort((a, b) => a.localeCompare(b)),
              boardState: normalizedBoardState
            });
          }
          setIsLoaded(true);
        })
        .catch((err) => {
          console.error("Failed to load data", err);
          setIsLoaded(true);
        });
    } else {
      setIsLoaded(true);
    }
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

  const handleCreateInlineTask = useCallback((parentId = null) => {
    setAppState((prev) => {
      const parentTask = parentId ? prev.tasks.find((task) => task.id === parentId) : null;
      const nextColor = parentTask?.color || TASK_COLORS[prev.tasks.length % TASK_COLORS.length];
      const newTaskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const newTasks = [
        ...prev.tasks,
        {
          id: newTaskId,
          title: "",
          color: nextColor,
          parentId,
          isExpanded: true,
          tags: [],
          deadline: new Date().toISOString().split("T")[0],
          description: ""
        }
      ].map((task) => (task.id === parentId ? { ...task, isExpanded: true } : task));

      return { ...prev, tasks: newTasks };
    });
  }, []);

  const handleUpdateTaskTitle = useCallback((taskId, newTitle) => {
    setAppState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, title: newTitle } : task))
    }));
  }, []);

  const handleUpdateTaskDetails = useCallback((taskId, updates) => {
    setAppState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task))
    }));
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
      boardState: {
        ...prev.boardState,
        [dateKey]: [
          ...(prev.boardState[dateKey] || []),
          {
            id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            taskId,
            completed: false
          }
        ]
      }
    }));
  }, []);

  const handleToggleAssignmentComplete = useCallback((dateKey, assignmentId) => {
    setAppState((prev) => ({
      ...prev,
      boardState: {
        ...prev.boardState,
        [dateKey]: (prev.boardState[dateKey] || []).map((assignment) =>
          assignment.id === assignmentId ? { ...assignment, completed: !assignment.completed } : assignment
        )
      }
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

  const tasksWithStats = appState.tasks.map((task) => {
    const stats = getTaskStats(task.id, appState.tasks, appState.boardState);
    return {
      ...task,
      ...stats,
      status: getTaskStatus(task.id, appState.tasks, appState.boardState)
    };
  });

  const filteredTasks = tasksWithStats
    .filter((task) => {
      if (!filterConfig.statuses?.length) return true;
      return filterConfig.statuses.includes(task.status.toLowerCase());
    })
    .filter((task) => {
      if (filterConfig.tag === "all") return true;
      return task.tags?.includes(filterConfig.tag);
    })
    .sort((a, b) => {
      const order = sortConfig.order === "asc" ? 1 : -1;

      if (sortConfig.key === "deadline") return (a.deadline || "").localeCompare(b.deadline || "") * order;
      if (sortConfig.key === "scheduledCount") return (a.scheduledCount - b.scheduledCount) * order;
      if (sortConfig.key === "title") return (a.title || "").localeCompare(b.title || "") * order;
      if (sortConfig.key === "status") return a.status.localeCompare(b.status) * order;
      return 0;
    });

  const visibleTaskIds = new Set(filteredTasks.map((task) => task.id));
  const filteredBoardState = Object.fromEntries(
    Object.entries(appState.boardState)
      .map(([dateKey, assignments]) => [dateKey, assignments.filter((assignment) => visibleTaskIds.has(assignment.taskId))])
      .filter(([, assignments]) => assignments.length > 0)
  );
  const availableTags = appState.tagOptions;

  if (!isLoaded) {
    return <div className="flex h-screen items-center justify-center bg-[#F8F9FB] font-medium text-slate-500">Loading...</div>;
  }

  return (
    <MainLayout>
      <div className="w-1/3 min-w-[320px] max-w-[400px] flex-1">
        <TaskPool
          tasks={filteredTasks}
          allTasks={tasksWithStats}
          selectedTaskId={selectedTaskId}
          hoveredTaskId={hoveredTaskId}
          onSelectTask={setSelectedTaskId}
          onToggleParent={handleToggleParent}
          onCreateInlineTask={handleCreateInlineTask}
          onDeleteTask={handleDeleteTask}
          onUpdateTaskTitle={handleUpdateTaskTitle}
          onOpenDetail={setEditingTask}
          onHoverTask={setHoveredTaskId}
          filterConfig={filterConfig}
          setFilterConfig={setFilterConfig}
          sortConfig={sortConfig}
          setSortConfig={setSortConfig}
          availableTags={availableTags}
        />
      </div>
      <div className="relative flex min-w-[800px] flex-[2] flex-col overflow-hidden rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <CalendarArea
          baseDate={baseDate}
          setBaseDate={setBaseDate}
          viewType={viewType}
          setViewType={setViewType}
          boardState={filteredBoardState}
          tasks={filteredTasks}
          hoveredTaskId={hoveredTaskId}
          onAddAssignmentFromSidebar={handleAddAssignmentFromSidebar}
          onDeleteAssignment={handleDeleteAssignment}
          onMoveAssignment={handleMoveAssignment}
          onToggleAssignmentComplete={handleToggleAssignmentComplete}
          onHoverTask={setHoveredTaskId}
          onOpenDetail={setEditingTask}
        />
      </div>
      {editingTask && (
        <HandDrawnPopup
          task={appState.tasks.find((task) => task.id === editingTask)}
          availableTags={availableTags}
          onCreateTag={handleCreateTagOption}
          onDeleteTag={handleDeleteTagOption}
          onClose={() => setEditingTask(null)}
          onUpdate={handleUpdateTaskDetails}
        />
      )}
    </MainLayout>
  );
}

export default App;
