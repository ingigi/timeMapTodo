import { useState, useCallback, useRef, useEffect } from 'react';
import MainLayout from './components/layout/MainLayout';
import TaskPool from './components/TaskPool/TaskPool';
import CalendarArea from './components/CalendarArea/CalendarArea';
import { getCapacityForDate } from './utils/dateUtils';

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
  { id: 'p1', title: 'Q4 プロダクトローンチ', category: 'プロダクトチーム', color: TASK_COLORS[0], totalTime: 7.0, isExpanded: true },
  { id: 't1', parentId: 'p1', title: '市場分析', color: TASK_COLORS[0], totalTime: 4.0 },
  { id: 't2', parentId: 'p1', title: 'ユーザーペルソナ作成', color: TASK_COLORS[0], totalTime: 3.0 },
  { id: 't3', title: 'API コアリファクタリング', category: 'エンジニアリングチーム', color: TASK_COLORS[2], totalTime: 8.0 },
];

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
    boardState: {}, // `dateKey` (YYYY-MM-DD) -> array of { id, taskId, duration, completedDuration }
    capacities: [8, 8, 8, 8, 8, 0, 0] // 8h default for Mon-Fri, 0 for Sat-Sun
  });
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [baseDate, setBaseDate] = useState(new Date());
  const [viewType, setViewType] = useState('week'); // 'week' | 'month'
  
  const resizingRef = useRef(null);
  const completionResizingRef = useRef(null);
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
      window.api.saveData(appState);
    }
  }, [appState, isLoaded]);

  const handleUpdateCapacities = useCallback((newCapacities) => {
    setAppState(prev => ({ ...prev, capacities: newCapacities }));
  }, []);

  const handleCreateInlineTask = useCallback((parentId = null) => {
    setAppState(prev => {
      let newTasks = [...prev.tasks];
      const parentTask = parentId ? prev.tasks.find(t => t.id === parentId) : null;
      
      const nextColor = TASK_COLORS[prev.tasks.length % TASK_COLORS.length];

      const newTaskId = `t_${Date.now()}`;
      newTasks.push({
        id: newTaskId,
        title: '', 
        category: parentTask ? parentTask.category : '',
        color: nextColor,
        totalTime: 1.0,
        parentId: parentId,
        isExpanded: true
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
      if (taskIdx === -1 || prev.tasks[taskIdx].title === newTitle) return prev;
      const newTasks = [...prev.tasks];
      newTasks[taskIdx] = { ...newTasks[taskIdx], title: newTitle };
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
      const targetCapacity = getCapacityForDate(targetDateKey, prev.capacities);
      
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

      // Check capacity
      if (targetTotalExcludingMoved + durationToMove > targetCapacity) return prev; 

      let newSourceAssignments = [...sourceAssignments];
      if (dragType === 'all' || remainingDurationInSource === 0) {
        newSourceAssignments = sourceAssignments.filter(a => a.id !== assignmentId);
      } else {
        const assignIdx = newSourceAssignments.findIndex(a => a.id === assignmentId);
        newSourceAssignments[assignIdx] = {
           ...newSourceAssignments[assignIdx],
           duration: remainingDurationInSource,
           completedDuration: remainingCompletedInSource
        };
      }

      let newTargetAssignments = sourceDateKey === targetDateKey ? newSourceAssignments : [...targetAssignments];
      const existingInTargetIdx = newTargetAssignments.findIndex(a => a.taskId === assignmentToMove.taskId && a.id !== assignmentId);

      if (existingInTargetIdx >= 0) {
        newTargetAssignments[existingInTargetIdx] = {
           ...newTargetAssignments[existingInTargetIdx],
           duration: newTargetAssignments[existingInTargetIdx].duration + durationToMove,
           completedDuration: (newTargetAssignments[existingInTargetIdx].completedDuration || 0) + completedToMove
        };
      } else {
        newTargetAssignments.push({
           ...assignmentToMove,
           id: dragType === 'all' ? assignmentToMove.id : `evt_${Date.now()}_${Math.random()}`,
           duration: durationToMove,
           completedDuration: completedToMove
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

  const applyResize = useCallback((dateKey, assignmentId, newDuration) => {
    setAppState(prev => {
      const dayAssignments = prev.boardState[dateKey] || [];
      const assignIdx = dayAssignments.findIndex(a => a.id === assignmentId);
      if (assignIdx === -1) return prev;
      
      const assignment = dayAssignments[assignIdx];
      if (newDuration < 1) return prev; 

      const diff = newDuration - assignment.duration;
      if (diff === 0) return prev; 

      const taskIdx = prev.tasks.findIndex(t => t.id === assignment.taskId);
      if (taskIdx === -1) return prev;
      
      if (diff > 0) {
        const unassigned = prev.tasks[taskIdx].totalTime - getTaskAssignedTime(assignment.taskId, prev.tasks, prev.boardState);
        if (unassigned < diff) return prev; 
      }
      
      const maxCapacity = getCapacityForDate(dateKey, prev.capacities);
      const currentTotal = dayAssignments.reduce((sum, a) => sum + a.duration, 0);
      if (currentTotal + diff > maxCapacity) return prev; 

      const newAssignments = [...dayAssignments];
      const clampedCompleted = Math.min(newDuration, assignment.completedDuration || 0);

      newAssignments[assignIdx] = { ...assignment, duration: newDuration, completedDuration: clampedCompleted };

      return { ...prev, boardState: { ...prev.boardState, [dateKey]: newAssignments } };
    });
  }, []);

  const handleResizeMove = useCallback((e) => {
    if (!resizingRef.current) return;
    const { dateKey, assignmentId, startY, startDuration } = resizingRef.current;
    
    const deltaY = e.clientY - startY;
    const deltaHours = Math.round(deltaY / BLOCK_HEIGHT_PX);
    const newDuration = Math.max(1, startDuration + deltaHours);
    
    applyResize(dateKey, assignmentId, newDuration);
  }, [applyResize]);

  const handleResizeEnd = useCallback(function onResizeEnd() {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
  }, [handleResizeMove]);

  const applyCompleteResize = useCallback((dateKey, assignmentId, newCompleted) => {
    setAppState(prev => {
      const dayAssignments = prev.boardState[dateKey] || [];
      const assignIdx = dayAssignments.findIndex(a => a.id === assignmentId);
      if (assignIdx === -1) return prev;
      
      const assignment = dayAssignments[assignIdx];
      const clampedCompleted = Math.max(0, Math.min(assignment.duration, newCompleted));
      
      if (clampedCompleted === (assignment.completedDuration || 0)) return prev;

      const newAssignments = [...dayAssignments];
      newAssignments[assignIdx] = { ...assignment, completedDuration: clampedCompleted };
      return { ...prev, boardState: { ...prev.boardState, [dateKey]: newAssignments } };
    });
  }, []);

  const handleCompleteResizeMove = useCallback((e) => {
    if (!completionResizingRef.current) return;
    const { dateKey, assignmentId, startY, startCompleted } = completionResizingRef.current;
    
    const deltaY = e.clientY - startY;
    const deltaHours = Math.round(deltaY / BLOCK_HEIGHT_PX);
    const newCompleted = Math.max(0, startCompleted + deltaHours);
    
    applyCompleteResize(dateKey, assignmentId, newCompleted);
  }, [applyCompleteResize]);

  const handleCompleteResizeEnd = useCallback(function onCompleteResizeEnd() {
    completionResizingRef.current = null;
    document.removeEventListener('mousemove', handleCompleteResizeMove);
    document.removeEventListener('mouseup', onCompleteResizeEnd);
  }, [handleCompleteResizeMove]);

  const handleCompleteResizeStart = useCallback((e, dateKey, assignmentId) => {
    e.preventDefault();
    const assignment = appState.boardState[dateKey]?.find(a => a.id === assignmentId);
    if (!assignment) return;
    
    completionResizingRef.current = { dateKey, assignmentId, startY: e.clientY, startCompleted: assignment.completedDuration || 0 };
    
    document.addEventListener('mousemove', handleCompleteResizeMove);
    document.addEventListener('mouseup', handleCompleteResizeEnd);
  }, [appState.boardState, handleCompleteResizeMove, handleCompleteResizeEnd]);

  const handleAddAssignment = useCallback((e, dateKey) => {
    e.preventDefault();
    if (!selectedTaskId) return;

    const task = appState.tasks.find(t => t.id === selectedTaskId);
    if (!task) return;
    const assignedTime = getTaskAssignedTime(selectedTaskId, appState.tasks, appState.boardState);
    if (task.totalTime - assignedTime <= 0) return;

    const maxCapacity = getCapacityForDate(dateKey, appState.capacities);
    const dayAssignments = appState.boardState[dateKey] || [];
    const totalAssigned = dayAssignments.reduce((sum, a) => sum + a.duration, 0);
    if (totalAssigned >= maxCapacity) return; 

    const existingAssignment = dayAssignments.find(a => a.taskId === selectedTaskId);
    const assignmentId = existingAssignment ? existingAssignment.id : `evt_${Date.now()}_${Math.random()}`;
    const startDuration = existingAssignment ? existingAssignment.duration + 1 : 1;

    setAppState(prev => {
      const taskIdx = prev.tasks.findIndex(t => t.id === selectedTaskId);
      if (taskIdx === -1) return prev;
      
      const unassigned = prev.tasks[taskIdx].totalTime - getTaskAssignedTime(selectedTaskId, prev.tasks, prev.boardState);
      if (unassigned <= 0) return prev;
      
      const prevDayAssigments = prev.boardState[dateKey] || [];
      const currentTotal = prevDayAssigments.reduce((sum, a) => sum + a.duration, 0);
      if (currentTotal >= getCapacityForDate(dateKey, prev.capacities)) return prev; 

      const existingAssignIdx = prevDayAssigments.findIndex(a => a.taskId === selectedTaskId);
      let newAssignments = [...prevDayAssigments];

      if (existingAssignIdx >= 0) {
        newAssignments[existingAssignIdx] = {
          ...newAssignments[existingAssignIdx],
          duration: newAssignments[existingAssignIdx].duration + 1
        };
      } else {
        newAssignments.push({
          id: assignmentId,
          taskId: selectedTaskId,
          duration: 1,
          completedDuration: 0
        });
      }

      return { ...prev, boardState: { ...prev.boardState, [dateKey]: newAssignments } };
    });

    resizingRef.current = { dateKey, assignmentId, startY: e.clientY, startDuration };
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, [selectedTaskId, appState.tasks, appState.boardState, appState.capacities, handleResizeMove, handleResizeEnd]);

  const handleResizeStart = useCallback((e, dateKey, assignmentId) => {
    e.preventDefault();
    const assignment = appState.boardState[dateKey]?.find(a => a.id === assignmentId);
    if (!assignment) return;
    
    resizingRef.current = { dateKey, assignmentId, startY: e.clientY, startDuration: assignment.duration };
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, [appState.boardState, handleResizeMove, handleResizeEnd]);

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

        const maxCapacity = getCapacityForDate(dateKey, prev.capacities);
        const currentTotal = dayAssignments.reduce((sum, a) => sum + a.duration, 0);
        if (currentTotal + delta > maxCapacity) return prev; 
      }

      const newAssignments = [...dayAssignments];
      const clampedCompleted = Math.min(newDuration, assignment.completedDuration || 0);

      newAssignments[assignIdx] = { ...assignment, duration: newDuration, completedDuration: clampedCompleted };
      return { ...prev, boardState: { ...prev.boardState, [dateKey]: newAssignments } };
    });
  }, []);

  const selectedTask = appState.tasks.find(t => t.id === selectedTaskId) || null;

  if (!isLoaded) {
    return <div className="flex items-center justify-center h-screen bg-[#F8F9FB] text-slate-500 font-medium">データを読み込み中...</div>;
  }

  return (
    <MainLayout>
      <div className="flex-1 w-1/3 min-w-[320px] max-w-[400px]">
        <TaskPool 
          tasks={appState.tasks} 
          boardState={appState.boardState}
          selectedTaskId={selectedTaskId} 
          onSelectTask={setSelectedTaskId} 
          onToggleParent={handleToggleParent}
          onAdjustTime={handleAdjustTime}
          onCreateInlineTask={handleCreateInlineTask}
          onDeleteTask={handleDeleteTask}
          onUpdateTaskTitle={handleUpdateTaskTitle}
        />
      </div>
      <div className="flex-[2] rounded-md bg-white p-6 shadow-sm border border-slate-200 flex flex-col overflow-hidden min-w-[800px] relative">
        <CalendarArea 
          baseDate={baseDate}
          setBaseDate={setBaseDate}
          viewType={viewType}
          setViewType={setViewType}
          boardState={appState.boardState}
          tasks={appState.tasks}
          capacities={appState.capacities}
          selectedTask={selectedTask}
          onAddAssignment={handleAddAssignment}
          onDeleteAssignment={handleDeleteAssignment}
          onResizeStart={handleResizeStart}
          onCompleteResizeStart={handleCompleteResizeStart}
          onUpdateCapacities={handleUpdateCapacities}
          onMoveAssignment={handleMoveAssignment}
          onQuickAdjust={handleQuickAdjust}
        />
      </div>
    </MainLayout>
  );
}

export default App;
