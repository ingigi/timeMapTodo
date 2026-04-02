import { useState, useCallback, useRef, useEffect } from 'react';
import MainLayout from './components/layout/MainLayout';
import TaskPool from './components/TaskPool/TaskPool';
import CalendarArea from './components/CalendarArea/CalendarArea';
import HandDrawnPopup from './components/Common/HandDrawnPopup';

const TASK_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#8B5CF6', // Violet
  '#14B8A6', // Teal
  '#F43F5E', // Rose
];

const MOCK_TASKS = [
  { id: 'p1', title: 'Q4 プロダクトローンチ', category: 'プロダクトチーム', color: TASK_COLORS[0], totalTime: 7.0, isExpanded: true, tags: ['Strategic'], deadline: '2026-04-30', description: 'Q4の主力プロダクトのローンチ計画' },
  { id: 't1', parentId: 'p1', title: '市場分析', color: TASK_COLORS[0], totalTime: 4.0, tags: ['Analysis'], deadline: '2026-04-10', description: '競合他社の動向調査' },
  { id: 't2', parentId: 'p1', title: 'ユーザーペルソナ作成', color: TASK_COLORS[0], totalTime: 3.0, tags: ['Design'], deadline: '2026-04-15', description: 'ターゲットユーザーの詳細定義' },
  { id: 't3', title: 'API コアリファクタリング', category: 'エンジニアリングチーム', color: TASK_COLORS[2], totalTime: 8.0, tags: ['Dev', 'Refactor'], deadline: '2026-04-20', description: 'バックエンドAPIの最適化' },
];

const getTaskStatus = (taskId, tasks, boardState) => {
  const descendants = new Set();
  const collect = (id) => {
    descendants.add(id);
    tasks.filter(t => t.parentId === id).forEach(child => collect(child.id));
  };
  collect(taskId);

  let assignedTotal = 0;
  let completedAssignedTotal = 0;
  const todayStr = new Date().toISOString().split('T')[0];

  Object.entries(boardState).forEach(([dateKey, assignments]) => {
    assignments.forEach(a => {
      if (descendants.has(a.taskId)) {
        assignedTotal += a.duration;
        if (dateKey < todayStr) {
          completedAssignedTotal += a.duration;
        }
      }
    });
  });

  const task = tasks.find(t => t.id === taskId);
  if (!task) return 'NotStarted';

  if (assignedTotal === 0) return 'NotStarted';
  if (completedAssignedTotal >= task.totalTime) return 'Completed';
  return 'InProgress';
};

const BLOCK_HEIGHT_PX = 64; // 4rem = 64px roughly

const getTaskAssignedTime = (taskId, tasks, boardState) => {
  const descendants = new Set();
  const collect = (id) => {
    descendants.add(id);
    tasks.filter(t => t.parentId === id).forEach(child => collect(child.id));
  };
  collect(taskId);
  let sum = 0;
  Object.values(boardState).flat().forEach(a => {
    if (descendants.has(a.taskId)) sum += a.duration;
  });
  return sum;
};

const enforceHierarchicalTime = (tasks, modifiedTaskId) => {
  let currentTasks = [...tasks];
  let child = currentTasks.find(t => t.id === modifiedTaskId);
  
  while (child && child.parentId) {
    const parentId = child.parentId;
    const parentIdx = currentTasks.findIndex(t => t.id === parentId);
    if (parentIdx === -1) break;
    
    const parent = currentTasks[parentIdx];
    const childrenList = currentTasks.filter(t => t.parentId === parentId);
    const childrenSum = childrenList.reduce((sum, c) => sum + c.totalTime, 0);
    
    if (parent.totalTime < childrenSum) {
      currentTasks[parentIdx] = {
        ...parent,
        totalTime: childrenSum
      };
      child = currentTasks[parentIdx];
    } else {
      break; 
    }
  }
  return currentTasks;
};

function App() {
  const [appState, setAppState] = useState({
    tasks: MOCK_TASKS,
    boardState: {} // `dateKey` (YYYY-MM-DD) -> array of { id, taskId, duration, completedDuration }
  });
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [baseDate, setBaseDate] = useState(new Date());
  const [viewType, setViewType] = useState('week'); // 'week' | 'month'
  const [filterConfig, setFilterConfig] = useState({ status: 'all', tag: 'all' });
  const [sortConfig, setSortConfig] = useState({ key: 'deadline', order: 'asc' });
  const [editingTask, setEditingTask] = useState(null); // For Detail Popup
  const [hoveredTaskId, setHoveredTaskId] = useState(null);
  
  const resizingRef = useRef(null);
  const completionResizingRef = useRef(null);
  const saveTimeoutRef = useRef(null); // 保存処理のデバウンス用
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (window.api && window.api.loadData) {
      window.api.loadData().then(data => {
        if (data && data.tasks) {
          setAppState(data);
        }
        setIsLoaded(true);
      }).catch(err => {
        console.error("Failed to load data", err);
        setIsLoaded(true);
      });
    } else {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && window.api && window.api.saveData) {
      // 既存のタイマーがあればクリアする
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // 1000ms待機してから保存を実行する
      saveTimeoutRef.current = setTimeout(() => {
        window.api.saveData(appState).then(result => {
          if (result && !result.success) {
            console.error("Save failed:", result.error);
          }
        }).catch(err => {
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
    setAppState(prev => {
      let newTasks = [...prev.tasks];
      const parentTask = parentId ? prev.tasks.find(t => t.id === parentId) : null;
      
      const nextColor = TASK_COLORS[prev.tasks.length % TASK_COLORS.length];
      const newTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      newTasks.push({
        id: newTaskId,
        title: '', 
        category: parentTask ? parentTask.category : '',
        color: nextColor,
        totalTime: 1.0,
        parentId: parentId,
        isExpanded: true,
        tags: [],
        deadline: new Date().toISOString().split('T')[0],
        description: ''
      });

      if (parentId) {
        const parentIdx = newTasks.findIndex(t => t.id === parentId);
        if (parentIdx >= 0) newTasks[parentIdx] = { ...newTasks[parentIdx], isExpanded: true };
        newTasks = enforceHierarchicalTime(newTasks, newTaskId);
      }
      
      return { ...prev, tasks: newTasks };
    });
  }, []);

  const handleUpdateTaskTitle = useCallback((taskId, newTitle) => {
    setAppState(prev => {
      const taskIdx = prev.tasks.findIndex(t => t.id === taskId);
      if (taskIdx === -1) return prev;
      const newTasks = [...prev.tasks];
      newTasks[taskIdx] = { ...newTasks[taskIdx], title: newTitle };
      return { ...prev, tasks: newTasks };
    });
  }, []);

  const handleUpdateTaskDetails = useCallback((taskId, updates) => {
    setAppState(prev => {
      const taskIdx = prev.tasks.findIndex(t => t.id === taskId);
      if (taskIdx === -1) return prev;
      const newTasks = [...prev.tasks];
      newTasks[taskIdx] = { ...newTasks[taskIdx], ...updates };
      return { ...prev, tasks: newTasks };
    });
  }, []);

  const handleDeleteTask = useCallback((taskId) => {
    setAppState(prev => {
      const taskToDelete = prev.tasks.find(t => t.id === taskId);
      if (!taskToDelete) return prev;

      const taskIdsToDelete = new Set([taskId]);
      const collectDescendants = (parentId) => {
        prev.tasks.filter(t => t.parentId === parentId).forEach(child => {
          taskIdsToDelete.add(child.id);
          collectDescendants(child.id);
        });
      };
      collectDescendants(taskId);

      if (taskIdsToDelete.has(selectedTaskId)) {
         setTimeout(() => setSelectedTaskId(null), 0);
      }

      const newTasks = prev.tasks.filter(t => !taskIdsToDelete.has(t.id));
      const newBoardState = {};
      let isBoardChanged = false;
      
      for (const [dateKey, assignments] of Object.entries(prev.boardState)) {
        const filteredAssignments = assignments.filter(a => !taskIdsToDelete.has(a.taskId));
        if (filteredAssignments.length !== assignments.length) {
          isBoardChanged = true;
        }
        if (filteredAssignments.length > 0) {
          newBoardState[dateKey] = filteredAssignments;
        }
      }

      return { 
        ...prev, 
        tasks: newTasks,
        boardState: isBoardChanged ? newBoardState : prev.boardState
      };
    });
  }, [selectedTaskId]);

  const handleToggleParent = useCallback((taskId) => {
    setAppState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === taskId ? { ...t, isExpanded: !t.isExpanded } : t)
    }));
  }, []);

  const handleAdjustTime = useCallback((taskId, delta) => {
    setAppState(prev => {
       const taskIdx = prev.tasks.findIndex(t => t.id === taskId);
       if (taskIdx === -1) return prev;
       
       const task = prev.tasks[taskIdx];
       let newTotal = task.totalTime + delta;

       const children = prev.tasks.filter(t => t.parentId === task.id);
       const minTotal = children.reduce((sum, c) => sum + c.totalTime, 0);
       newTotal = Math.max(minTotal, newTotal);
       
       newTotal = Math.max(0, newTotal);

       if (newTotal === task.totalTime) return prev;
       
       let newTasks = [...prev.tasks];
       newTasks[taskIdx] = { ...task, totalTime: newTotal };
       
       newTasks = enforceHierarchicalTime(newTasks, taskId);

       return { ...prev, tasks: newTasks };
    });
  }, []);

  const handleMoveAssignment = useCallback((sourceDateKey, targetDateKey, assignmentId, dragType = 'all') => {
    if (sourceDateKey === targetDateKey && dragType === 'all') return;

    setAppState(prev => {
      const sourceAssignments = prev.boardState[sourceDateKey] || [];
      const assignmentToMove = sourceAssignments.find(a => a.id === assignmentId);
      if (!assignmentToMove) return prev;

      const targetAssignments = prev.boardState[targetDateKey] || [];
      
      let durationToMove = assignmentToMove.duration;
      let completedToMove = assignmentToMove.completedDuration || 0;
      let remainingDurationInSource = 0;
      let remainingCompletedInSource = 0;

      if (dragType === 'completed') {
         durationToMove = assignmentToMove.completedDuration || 0;
         completedToMove = assignmentToMove.completedDuration || 0;
         remainingDurationInSource = assignmentToMove.duration - durationToMove;
         remainingCompletedInSource = 0;
      } else if (dragType === 'incomplete') {
         durationToMove = assignmentToMove.duration - (assignmentToMove.completedDuration || 0);
         completedToMove = 0;
         remainingDurationInSource = assignmentToMove.completedDuration || 0;
         remainingCompletedInSource = assignmentToMove.completedDuration || 0;
      }

      const targetTotalExcludingMoved = targetAssignments.filter(a => a.id !== assignmentId).reduce((sum, a) => sum + a.duration, 0)
        + (sourceDateKey === targetDateKey && dragType !== 'all' ? remainingDurationInSource : 0);

      let newSourceAssignments = [...sourceAssignments];
      newSourceAssignments = sourceAssignments.filter(a => a.id !== assignmentId);

      let newTargetAssignments = sourceDateKey === targetDateKey ? newSourceAssignments : [...targetAssignments];
      const existingInTargetIdx = newTargetAssignments.findIndex(a => a.taskId === assignmentToMove.taskId && a.id !== assignmentId);

      if (existingInTargetIdx >= 0) {
        newTargetAssignments[existingInTargetIdx] = {
           ...newTargetAssignments[existingInTargetIdx],
           duration: newTargetAssignments[existingInTargetIdx].duration + durationToMove
        };
      } else {
        newTargetAssignments.push({
           ...assignmentToMove,
           id: `evt_${Date.now()}_${Math.random()}`,
           duration: durationToMove
        });
      }

      return {
        ...prev,
        boardState: {
          ...prev.boardState,
          [sourceDateKey]: newSourceAssignments,
          [targetDateKey]: newTargetAssignments
        }
      };
    });
  }, []);

  const handleDeleteAssignment = useCallback((dateKey, assignmentId) => {
    setAppState(prev => {
      const dayAssignments = prev.boardState[dateKey] || [];
      if (!dayAssignments.find(a => a.id === assignmentId)) return prev;

      const newAssignments = dayAssignments.filter(a => a.id !== assignmentId);
      return { ...prev, boardState: { ...prev.boardState, [dateKey]: newAssignments } };
    });
  }, []);


  const handleAddAssignmentFromSidebar = useCallback((taskId, dateKey) => {
    const task = appState.tasks.find(t => t.id === taskId);
    if (!task) return;
    const assignedTime = getTaskAssignedTime(taskId, appState.tasks, appState.boardState);
    if (task.totalTime - assignedTime <= 0) return;

    const dayAssignments = appState.boardState[dateKey] || [];

    setAppState(prev => {
      const prevDayAssigments = prev.boardState[dateKey] || [];
      const existingAssignIdx = prevDayAssigments.findIndex(a => a.taskId === taskId);
      let newAssignments = [...prevDayAssigments];

      if (existingAssignIdx >= 0) {
        newAssignments[existingAssignIdx] = {
          ...newAssignments[existingAssignIdx],
          duration: newAssignments[existingAssignIdx].duration + 1
        };
      } else {
        newAssignments.push({
          id: `evt_${Date.now()}_${Math.random()}`,
          taskId: taskId,
          duration: 1
        });
      }

      return { ...prev, boardState: { ...prev.boardState, [dateKey]: newAssignments } };
    });
  }, [appState.tasks, appState.boardState]);

  const handleAddAssignment = useCallback((e, dateKey) => {
    e.preventDefault();
    if (!selectedTaskId) return;
    handleAddAssignmentFromSidebar(selectedTaskId, dateKey);
  }, [selectedTaskId, handleAddAssignmentFromSidebar]);

  // Handle explicit adjustment from MonthView buttons
  const handleQuickAdjust = useCallback((dateKey, assignmentId, delta) => {
    setAppState(prev => {
      const dayAssignments = prev.boardState[dateKey] || [];
      const assignIdx = dayAssignments.findIndex(a => a.id === assignmentId);
      if (assignIdx === -1) return prev;

      const assignment = dayAssignments[assignIdx];
      const newDuration = assignment.duration + delta;

      if (newDuration < 1) {
        // Remove assignment
        const newAssignments = dayAssignments.filter(a => a.id !== assignmentId);
        return { ...prev, boardState: { ...prev.boardState, [dateKey]: newAssignments } };
      }

      if (delta > 0) {
        const taskIdx = prev.tasks.findIndex(t => t.id === assignment.taskId);
        if (taskIdx === -1) return prev;
        const unassigned = prev.tasks[taskIdx].totalTime - getTaskAssignedTime(assignment.taskId, prev.tasks, prev.boardState);
        if (unassigned < delta) return prev; 

      }

      const newAssignments = [...dayAssignments];
      newAssignments[assignIdx] = { ...assignment, duration: newDuration };
      return { ...prev, boardState: { ...prev.boardState, [dateKey]: newAssignments } };
    });
  }, []);

  const tasksWithRemainingTime = appState.tasks.map(t => ({
    ...t,
    remainingTime: t.totalTime - getTaskAssignedTime(t.id, appState.tasks, appState.boardState)
  }));

  const filteredTasks = tasksWithRemainingTime
    .filter(t => {
      if (filterConfig.status === 'all') return true;
      const status = getTaskStatus(t.id, appState.tasks, appState.boardState);
      return status.toLowerCase() === filterConfig.status.toLowerCase();
    })
    .filter(t => {
      if (filterConfig.tag === 'all') return true;
      return t.tags?.includes(filterConfig.tag);
    })
    .sort((a, b) => {
      const key = sortConfig.key;
      const order = sortConfig.order === 'asc' ? 1 : -1;
      
      if (key === 'deadline') {
        return (a.deadline || '').localeCompare(b.deadline || '') * order;
      }
      if (key === 'remainingTime') {
        return (a.remainingTime - b.remainingTime) * order;
      }
      if (key === 'title') {
        return (a.title || '').localeCompare(b.title || '') * order;
      }
      if (key === 'status') {
         const sa = getTaskStatus(a.id, appState.tasks, appState.boardState);
         const sb = getTaskStatus(b.id, appState.tasks, appState.boardState);
         return sa.localeCompare(sb) * order;
      }
      return 0;
    });

  const selectedTask = tasksWithRemainingTime.find(t => t.id === selectedTaskId) || null;

  if (!isLoaded) {
    return <div className="flex items-center justify-center h-screen bg-[#F8F9FB] text-slate-500 font-medium">データを読み込み中...</div>;
  }

  return (
    <MainLayout>
      <div className="flex-1 w-1/3 min-w-[320px] max-w-[400px]">
        <TaskPool 
          tasks={filteredTasks} 
          allTasks={tasksWithRemainingTime}
          boardState={appState.boardState}
          selectedTaskId={selectedTaskId} 
          hoveredTaskId={hoveredTaskId}
          onSelectTask={setSelectedTaskId} 
          onToggleParent={handleToggleParent}
          onAdjustTime={handleAdjustTime}
          onCreateInlineTask={handleCreateInlineTask}
          onDeleteTask={handleDeleteTask}
          onUpdateTaskTitle={handleUpdateTaskTitle}
          onOpenDetail={setEditingTask}
          onHoverTask={setHoveredTaskId}
          filterConfig={filterConfig}
          setFilterConfig={setFilterConfig}
          sortConfig={sortConfig}
          setSortConfig={setSortConfig}
          onAddAssignment={handleAddAssignmentFromSidebar}
        />
      </div>
      <div className="flex-[2] rounded-md bg-white p-6 shadow-sm border border-slate-200 flex flex-col overflow-hidden min-w-[800px] relative">
        <CalendarArea 
          baseDate={baseDate}
          setBaseDate={setBaseDate}
          viewType={viewType}
          setViewType={setViewType}
          boardState={appState.boardState}
          tasks={tasksWithRemainingTime}
          hoveredTaskId={hoveredTaskId}
          onAddAssignmentFromSidebar={handleAddAssignmentFromSidebar}
          onDeleteAssignment={handleDeleteAssignment}
          onMoveAssignment={handleMoveAssignment}
          onQuickAdjust={handleQuickAdjust}
          onHoverTask={setHoveredTaskId}
        />
      </div>
      {editingTask && (
        <HandDrawnPopup 
          task={appState.tasks.find(t => t.id === editingTask)} 
          onClose={() => setEditingTask(null)}
          onUpdate={handleUpdateTaskDetails}
        />
      )}
    </MainLayout>
  );
}

export default App;
