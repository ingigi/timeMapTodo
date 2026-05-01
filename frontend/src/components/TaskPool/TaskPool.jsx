import { Pause, Play, Plus, Settings2, Trash2, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import TaskListItem from "./TaskListItem";
import TaskWorkflowModal from "./TaskWorkflowModal";
import { getCurrentDrag } from "../../utils/dragState";
import {
  describeWorkflowDeadline,
  describeWorkflowSchedule,
  formatDateKey,
  getNextWorkflowRunDate
} from "../../utils/workflows";

const readDragPayload = (event) => {
  const rawText = event.dataTransfer.getData("text/plain");
  if (rawText) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // Ignore invalid payloads.
    }
  }

  return getCurrentDrag();
};

const formatNextRunLabel = (workflow) => {
  const nextRunDate = getNextWorkflowRunDate(workflow, new Date());
  if (!nextRunDate) return "\u6b21\u56de\u672a\u5b9a";

  const todayKey = formatDateKey(new Date());
  if (nextRunDate === todayKey) return "\u4eca\u65e5";
  return nextRunDate;
};

function WorkflowSettingsModal({
  workflows,
  onClose,
  onCreateClick,
  onToggleWorkflowEnabled,
  onDeleteWorkflow
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="flex max-h-[calc(100vh-32px)] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-[#34363D] bg-[#15171C] shadow-[0_28px_90px_rgba(0,0,0,0.52)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#2A2F37] px-6 py-5">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#8B949E]">Workflow</div>
            <h2 className="mt-1 text-xl font-bold text-[#F7F7F8]">{"\u30ef\u30fc\u30af\u30d5\u30ed\u30fc\u8a2d\u5b9a"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-[#A1A1AA] transition-colors hover:bg-[#25272F] hover:text-[#F4F4F5]"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={onCreateClick}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0CCB8E] py-3 text-sm font-bold text-[#06100D] shadow-[0_14px_28px_rgba(12,203,142,0.22)] transition-all hover:scale-[1.01] hover:bg-[#10B981]"
          >
            <Plus className="h-4 w-4" />
            {"\u30ef\u30fc\u30af\u30d5\u30ed\u30fc\u8ffd\u52a0"}
          </button>

          {workflows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#2A3038] bg-[#0B0E11] px-4 py-8 text-center">
              <div className="text-sm font-bold text-[#C4CAD3]">{"\u30ef\u30fc\u30af\u30d5\u30ed\u30fc\u306f\u307e\u3060\u3042\u308a\u307e\u305b\u3093"}</div>
            </div>
          ) : (
            <div className="space-y-2">
              {workflows.map((workflow) => (
                <div key={workflow.id} className="rounded-lg border border-[#34363D] bg-[#1C1D22] px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="break-words text-sm font-bold text-[#F7F7F8]">{workflow.name}</div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            workflow.enabled ? "bg-emerald-500/10 text-emerald-300" : "bg-[#25272F] text-[#A1A1AA]"
                          }`}
                        >
                          {workflow.enabled ? "\u6709\u52b9" : "\u505c\u6b62\u4e2d"}
                        </span>
                      </div>
                      <div className="mt-1 break-words text-xs font-semibold text-[#B4BDCA]">
                        {workflow.template.title || "\u7121\u984c\u306e\u30bf\u30b9\u30af"}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-[#B4BDCA]">
                        <span className="rounded-full bg-[#25272F] px-2 py-1">{describeWorkflowSchedule(workflow)}</span>
                        <span className="rounded-full bg-[#25272F] px-2 py-1">{describeWorkflowDeadline(workflow)}</span>
                        <span className="rounded-full bg-[#25272F] px-2 py-1">{formatNextRunLabel(workflow)}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onToggleWorkflowEnabled?.(workflow.id)}
                        className="rounded-md p-2 text-[#8B949E] transition-colors hover:bg-[#25272F] hover:text-[#F4F4F5]"
                        title={workflow.enabled ? "\u505c\u6b62" : "\u518d\u958b"}
                      >
                        {workflow.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteWorkflow?.(workflow.id)}
                        className="rounded-md p-2 text-[#8B949E] transition-colors hover:bg-red-500/10 hover:text-red-300"
                        title={"\u524a\u9664"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function TaskPool({
  tasks,
  workflows = [],
  selectedTaskId,
  hoveredTaskId,
  editingTaskId,
  onCreateInlineTask,
  onCreateWorkflow,
  onToggleWorkflowEnabled,
  onDeleteWorkflow,
  onDeleteTask,
  onUpdateTaskTitle,
  onOpenDetail,
  onHoverTask,
  onUnscheduleTask,
  availableTags = []
}) {
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [isWorkflowSettingsOpen, setIsWorkflowSettingsOpen] = useState(false);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);

  return (
    <>
      <div
        className={`flex h-full flex-col pt-6 transition-all ${
          isDropTarget ? "bg-[#111418] ring-2 ring-[#0CCB8E] ring-inset shadow-[inset_0_0_0_1px_rgba(12,203,142,0.22)]" : ""
        }`}
        onDragOver={(event) => {
          const payload = readDragPayload(event);
          if (!payload?.taskId || !payload?.sourceDateKey) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setIsDropTarget(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsDropTarget(false);
          }
        }}
        onDrop={(event) => {
          const payload = readDragPayload(event);
          if (!payload?.taskId || !payload?.sourceDateKey) return;
          event.preventDefault();
          setIsDropTarget(false);
          onUnscheduleTask(payload.taskId);
        }}
      >
        <div className="mx-4 mb-5 flex items-center gap-2">
          <button
            type="button"
            onClick={onCreateInlineTask}
            className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0CCB8E] py-3 text-sm font-bold text-[#06100D] shadow-[0_14px_28px_rgba(12,203,142,0.24)] transition-all hover:scale-[1.01] hover:bg-[#10B981]"
          >
            <Plus className="h-4 w-4" />
            {"\u65b0\u898f\u30bf\u30b9\u30af"}
          </button>
          <button
            type="button"
            onClick={() => setIsWorkflowSettingsOpen(true)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#20242A] bg-[#0B0E11] text-[#B4BDCA] transition-colors hover:border-[#34363D] hover:bg-[#111418] hover:text-[#F7F7F8]"
            title={"\u30ef\u30fc\u30af\u30d5\u30ed\u30fc\u8a2d\u5b9a"}
          >
            <Settings2 className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#2A3038] bg-[#0B0E11] px-4 py-6 text-center">
              <div className="text-sm font-bold text-[#B8C0CC]">{"\u672a\u914d\u7f6e\u30bf\u30b9\u30af\u306f\u3042\u308a\u307e\u305b\u3093"}</div>
            </div>
          ) : (
            tasks.map((task) => (
              <TaskListItem
                key={task.id}
                task={task}
                isActive={selectedTaskId === task.id}
                isRelated={hoveredTaskId === task.id}
                suppressInlineTitleAutoEdit={editingTaskId === task.id}
                onDelete={onDeleteTask}
                onUpdateTaskTitle={onUpdateTaskTitle}
                onOpenDetail={onOpenDetail}
                onHoverTask={onHoverTask}
              />
            ))
          )}
        </div>
      </div>

      {isWorkflowSettingsOpen ? (
        <WorkflowSettingsModal
          workflows={workflows}
          onClose={() => setIsWorkflowSettingsOpen(false)}
          onCreateClick={() => {
            setIsWorkflowSettingsOpen(false);
            setIsWorkflowModalOpen(true);
          }}
          onToggleWorkflowEnabled={onToggleWorkflowEnabled}
          onDeleteWorkflow={onDeleteWorkflow}
        />
      ) : null}

      {isWorkflowModalOpen ? (
        <TaskWorkflowModal
          availableTags={availableTags}
          onClose={() => setIsWorkflowModalOpen(false)}
          onSave={(workflowDraft) => {
            onCreateWorkflow?.(workflowDraft);
            setIsWorkflowModalOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
