import { Pause, Play, Plus, Repeat, Trash2 } from "lucide-react";
import { useState } from "react";
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
  if (!nextRunDate) return "次回未定";

  const todayKey = formatDateKey(new Date());
  if (nextRunDate === todayKey) return "今日";
  return nextRunDate;
};

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
  const [activeTab, setActiveTab] = useState("tasks");
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);

  return (
    <>
      <div
        className={`flex h-full flex-col transition-all ${
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
        <div className="mx-4 mb-8 mt-4 flex items-center gap-2 rounded-2xl bg-[#111418] p-1">
          <button
            type="button"
            onClick={() => setActiveTab("tasks")}
            className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "tasks" ? "bg-[#090C0F] text-[#F7F7F8] shadow-md" : "text-[#8B949E] hover:text-[#F7F7F8]"
            }`}
          >
            タスク
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("workflows")}
            className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "workflows" ? "bg-[#090C0F] text-[#F7F7F8] shadow-md" : "text-[#8B949E] hover:text-[#F7F7F8]"
            }`}
          >
            ワークフロー
          </button>
        </div>

        <div className="mx-4 mb-4">
          <button
            type="button"
            onClick={() => (activeTab === "tasks" ? onCreateInlineTask() : setIsWorkflowModalOpen(true))}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0CCB8E] py-3 text-sm font-semibold text-[#06100D] shadow-[0_14px_28px_rgba(12,203,142,0.24)] transition-all hover:scale-[1.01] hover:bg-[#10B981]"
          >
            {activeTab === "tasks" ? <Plus className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            {activeTab === "tasks" ? "新規タスク" : "ワークフロー追加"}
          </button>
        </div>

        {activeTab === "tasks" ? (
          <>
            <div className="px-4 pb-3">
              <div className="rounded-lg border border-dashed border-[#2A3038] bg-[#111418]/70 px-4 py-3 text-center text-sm font-medium text-[#A8B2C0]">
                ここからドラッグしてカレンダーに配置
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#2A3038] bg-[#0B0E11] px-4 py-6 text-center">
                  <div className="text-sm font-medium text-[#B8C0CC]">未配置タスクはありません</div>
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
          </>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {workflows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#2A3038] bg-[#0B0E11] px-4 py-6 text-center">
                <div className="text-sm font-medium text-[#B8C0CC]">ワークフローはありません</div>
              </div>
            ) : (
              <div className="space-y-2">
                {workflows.map((workflow) => (
                  <div key={workflow.id} className="rounded-lg border border-[#34363D] bg-[#1C1D22] px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-[#F4F4F5]">{workflow.name}</div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              workflow.enabled ? "bg-emerald-500/10 text-emerald-300" : "bg-[#25272F] text-[#A1A1AA]"
                            }`}
                          >
                            {workflow.enabled ? "有効" : "停止中"}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-[#A1A1AA]">{workflow.template.title || "無題のタスク"}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[#A1A1AA]">
                          <span className="rounded-full bg-[#25272F] px-2 py-1">{describeWorkflowSchedule(workflow)}</span>
                          <span className="rounded-full bg-[#25272F] px-2 py-1">{describeWorkflowDeadline(workflow)}</span>
                          <span className="rounded-full bg-[#25272F] px-2 py-1">{formatNextRunLabel(workflow)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onToggleWorkflowEnabled?.(workflow.id)}
                          className="rounded-md p-2 text-[#71717A] transition-colors hover:bg-[#25272F] hover:text-[#F4F4F5]"
                          title={workflow.enabled ? "停止" : "再開"}
                        >
                          {workflow.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteWorkflow?.(workflow.id)}
                          className="rounded-md p-2 text-[#71717A] transition-colors hover:bg-red-500/10 hover:text-red-300"
                          title="削除"
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
        )}
      </div>

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
