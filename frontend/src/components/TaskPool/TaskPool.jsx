import clsx from "clsx";
import { ChevronDown, Edit3, GripVertical, MoreHorizontal, Pause, Play, Plus, Settings2, Trash2, X } from "lucide-react";
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

const FILTER_PROPERTIES = [
  { value: "placement", label: "配置状態" },
  { value: "deadline", label: "期限日" },
  { value: "tags", label: "タグ" },
  { value: "status", label: "ステータス" }
];

const SORT_PROPERTIES = [
  { value: "deadline", label: "期限日" },
  { value: "tags", label: "タグ" },
  { value: "status", label: "ステータス" }
];

const PLACEMENT_OPTIONS = [
  { id: "unscheduled", name: "未配置" },
  { id: "scheduled", name: "配置済み" }
];

const createDateRange = () => ({
  startMode: "today",
  startOffsetDays: 0,
  endMode: "same-day",
  endOffsetDays: 0
});

const createFilter = (joiner = "and") => ({
  id: `filter_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  joiner,
  property: "deadline",
  match: "range",
  dateRange: createDateRange(),
  values: []
});

const createSort = () => ({
  id: `sort_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  property: "deadline",
  direction: "asc"
});

const readDragPayload = (event) => {
  const rawText = event.dataTransfer.getData("text/plain");
  if (rawText) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === "object") return parsed;
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

function CenterModal({ title, eyebrow, onClose, children, footer }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[calc(100vh-32px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#34363D] bg-[#15171C] shadow-[0_28px_90px_rgba(0,0,0,0.52)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#2A2F37] px-6 py-5">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#8B949E]">{eyebrow}</div>
            <h2 className="mt-1 text-xl font-bold text-[#F7F7F8]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-[#A1A1AA] transition-colors hover:bg-[#25272F] hover:text-[#F4F4F5]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>
        {footer ? <div className="shrink-0 border-t border-[#2A2F37] px-6 py-4">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

function MultiSelect({ options, selectedValues, onChange }) {
  const selectedSet = new Set(selectedValues || []);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const value = typeof option === "string" ? option : option.id;
        const label = typeof option === "string" ? option : option.name;
        const selected = selectedSet.has(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => {
              onChange(selected ? selectedValues.filter((item) => item !== value) : [...selectedValues, value]);
            }}
            className={clsx(
              "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
              selected ? "border-[#60B964] bg-[#60B964]/15 text-[#78D27F]" : "border-[#34363D] text-[#AAB4C2] hover:text-[#F7F7F8]"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function DateRangeEditor({ value, onChange }) {
  const range = value || createDateRange();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={range.startMode}
        onChange={(event) => onChange({ ...range, startMode: event.target.value })}
        className="rounded-md border border-[#34363D] bg-[#202229] px-2 py-2 text-xs font-bold text-[#F4F4F5] outline-none"
      >
        <option value="today">今日</option>
        <option value="relative">今日から</option>
      </select>
      {range.startMode === "relative" ? (
        <input
          type="number"
          min="0"
          value={range.startOffsetDays || 0}
          onChange={(event) => onChange({ ...range, startOffsetDays: Number(event.target.value) })}
          className="w-20 rounded-md border border-[#34363D] bg-[#202229] px-2 py-2 text-xs font-bold text-[#F4F4F5] outline-none"
        />
      ) : null}
      <span className="text-xs font-bold text-[#8B949E]">～</span>
      <select
        value={range.endMode}
        onChange={(event) => onChange({ ...range, endMode: event.target.value })}
        className="rounded-md border border-[#34363D] bg-[#202229] px-2 py-2 text-xs font-bold text-[#F4F4F5] outline-none"
      >
        <option value="same-day">当日</option>
        <option value="relative">当日から</option>
      </select>
      {range.endMode === "relative" ? (
        <input
          type="number"
          min="0"
          value={range.endOffsetDays || 0}
          onChange={(event) => onChange({ ...range, endOffsetDays: Number(event.target.value) })}
          className="w-20 rounded-md border border-[#34363D] bg-[#202229] px-2 py-2 text-xs font-bold text-[#F4F4F5] outline-none"
        />
      ) : null}
      <span className="text-xs font-bold text-[#8B949E]">日後</span>
    </div>
  );
}

function ViewEditorModal({ view, availableTags, statusOptions, onSave, onClose }) {
  const [draft, setDraft] = useState(() => ({
    id: view?.id,
    name: view?.name || "",
    locked: Boolean(view?.locked),
    filters: Array.isArray(view?.filters) ? view.filters : [],
    sorts: Array.isArray(view?.sorts) ? view.sorts : []
  }));

  const updateFilter = (filterId, patch) => {
    setDraft((current) => ({
      ...current,
      filters: current.filters.map((filter) => (filter.id === filterId ? { ...filter, ...patch } : filter))
    }));
  };

  const updateSort = (sortId, patch) => {
    setDraft((current) => ({
      ...current,
      sorts: current.sorts.map((sort) => (sort.id === sortId ? { ...sort, ...patch } : sort))
    }));
  };

  const moveSort = (index, direction) => {
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.sorts.length) return current;
      const sorts = [...current.sorts];
      const [moved] = sorts.splice(index, 1);
      sorts.splice(target, 0, moved);
      return { ...current, sorts };
    });
  };

  return (
    <CenterModal
      title={draft.id ? "ビューを編集" : "ビューを作成"}
      eyebrow="View"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-bold text-[#A1A1AA] hover:bg-[#25272F]">
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="rounded-lg bg-[#60B964] px-4 py-2 text-sm font-bold text-[#06100D] hover:bg-[#54A85C]"
          >
            保存
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <label className="block">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#8B949E]">Name</div>
          <input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            className="w-full rounded-lg border border-[#34363D] bg-[#202229] px-3 py-2.5 text-sm font-bold text-[#F7F7F8] outline-none focus:border-[#60B964]"
            placeholder="ビュー名"
          />
        </label>

        <section className="rounded-lg border border-[#2A2F37] bg-[#111418] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#F7F7F8]">フィルター</h3>
            <button
              type="button"
              onClick={() => setDraft((current) => ({ ...current, filters: [...current.filters, createFilter(current.filters.length ? "and" : "and")] }))}
              className="rounded-md border border-[#34363D] px-3 py-1.5 text-xs font-bold text-[#AAB4C2] hover:bg-[#202229]"
            >
              条件を追加
            </button>
          </div>
          <div className="space-y-3">
            {draft.filters.length === 0 ? <div className="text-sm font-semibold text-[#8B949E]">条件なし</div> : null}
            {draft.filters.map((filter, index) => (
              <div key={filter.id} className="rounded-lg border border-[#34363D] bg-[#15171C] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {index > 0 ? (
                    <select
                      value={filter.joiner || "and"}
                      onChange={(event) => updateFilter(filter.id, { joiner: event.target.value })}
                      className="rounded-md border border-[#34363D] bg-[#202229] px-2 py-2 text-xs font-bold text-[#F4F4F5]"
                    >
                      <option value="and">AND</option>
                      <option value="or">OR</option>
                    </select>
                  ) : null}
                  <select
                    value={filter.property}
                    onChange={(event) => {
                      const property = event.target.value;
                      updateFilter(filter.id, {
                        property,
                        match: property === "deadline" ? "range" : "values",
                        values: [],
                        dateRange: property === "deadline" ? createDateRange() : undefined
                      });
                    }}
                    className="rounded-md border border-[#34363D] bg-[#202229] px-2 py-2 text-xs font-bold text-[#F4F4F5]"
                  >
                    {FILTER_PROPERTIES.map((property) => (
                      <option key={property.value} value={property.value}>
                        {property.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setDraft((current) => ({ ...current, filters: current.filters.filter((item) => item.id !== filter.id) }))}
                    className="ml-auto rounded-md p-2 text-[#8B949E] hover:bg-red-500/10 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3">
                  {filter.property === "deadline" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={filter.match || "range"}
                        onChange={(event) => updateFilter(filter.id, { match: event.target.value })}
                        className="rounded-md border border-[#34363D] bg-[#202229] px-2 py-2 text-xs font-bold text-[#F4F4F5] outline-none"
                      >
                        <option value="range">範囲内</option>
                        <option value="empty">未設定</option>
                        <option value="exists">設定あり</option>
                      </select>
                      {(filter.match || "range") === "range" ? (
                        <DateRangeEditor value={filter.dateRange} onChange={(dateRange) => updateFilter(filter.id, { dateRange })} />
                      ) : null}
                    </div>
                  ) : (
                    <MultiSelect
                      options={filter.property === "tags" ? availableTags : filter.property === "placement" ? PLACEMENT_OPTIONS : statusOptions}
                      selectedValues={filter.values || []}
                      onChange={(values) => updateFilter(filter.id, { values })}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#2A2F37] bg-[#111418] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#F7F7F8]">ソート</h3>
            <button
              type="button"
              onClick={() => setDraft((current) => ({ ...current, sorts: [...current.sorts, createSort()] }))}
              className="rounded-md border border-[#34363D] px-3 py-1.5 text-xs font-bold text-[#AAB4C2] hover:bg-[#202229]"
            >
              ソートを追加
            </button>
          </div>
          <div className="space-y-2">
            {draft.sorts.length === 0 ? <div className="text-sm font-semibold text-[#8B949E]">設定なし</div> : null}
            {draft.sorts.map((sort, index) => (
              <div key={sort.id} className="flex items-center gap-2 rounded-lg border border-[#34363D] bg-[#15171C] p-2">
                <button type="button" onClick={() => moveSort(index, -1)} className="rounded-md px-2 py-1 text-xs text-[#AAB4C2] hover:bg-[#202229]">
                  ↑
                </button>
                <button type="button" onClick={() => moveSort(index, 1)} className="rounded-md px-2 py-1 text-xs text-[#AAB4C2] hover:bg-[#202229]">
                  ↓
                </button>
                <select
                  value={sort.property}
                  onChange={(event) => updateSort(sort.id, { property: event.target.value })}
                  className="rounded-md border border-[#34363D] bg-[#202229] px-2 py-2 text-xs font-bold text-[#F4F4F5]"
                >
                  {SORT_PROPERTIES.map((property) => (
                    <option key={property.value} value={property.value}>
                      {property.label}
                    </option>
                  ))}
                </select>
                <select
                  value={sort.direction || "asc"}
                  onChange={(event) => updateSort(sort.id, { direction: event.target.value })}
                  className="rounded-md border border-[#34363D] bg-[#202229] px-2 py-2 text-xs font-bold text-[#F4F4F5]"
                >
                  <option value="asc">昇順</option>
                  <option value="desc">降順</option>
                </select>
                <button
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, sorts: current.sorts.filter((item) => item.id !== sort.id) }))}
                  className="ml-auto rounded-md p-2 text-[#8B949E] hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </CenterModal>
  );
}

function SettingsModal({
  workflows,
  tags,
  statuses,
  onClose,
  onCreateWorkflowClick,
  onEditWorkflow,
  onToggleWorkflowEnabled,
  onDeleteWorkflow,
  onCreateTag,
  onRenameTag,
  onDeleteTag,
  onReorderTag,
  onCreateStatus,
  onRenameStatus,
  onDeleteStatus,
  onReorderStatus
}) {
  const [tab, setTab] = useState("workflow");
  const [draft, setDraft] = useState("");

  const renderSortableList = (items, type) => (
    <div className="space-y-2">
      {items.map((item, index) => {
        const id = typeof item === "string" ? item : item.id;
        const name = typeof item === "string" ? item : item.name;
        const standard = typeof item === "string" ? false : item.standard;
        return (
          <div
            key={id}
            className="group flex items-center gap-2 rounded-lg border border-[#34363D] bg-[#1C1D22] px-3 py-2"
            draggable
            onDragStart={(event) => event.dataTransfer.setData("text/plain", JSON.stringify({ type, index }))}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const payload = JSON.parse(event.dataTransfer.getData("text/plain") || "{}");
              if (payload.type !== type) return;
              if (type === "tag") onReorderTag(payload.index, index);
              if (type === "status") onReorderStatus(payload.index, index);
            }}
          >
            <GripVertical className="h-4 w-4 shrink-0 text-[#66717F] opacity-0 transition-opacity group-hover:opacity-100" />
            <input
              value={name}
              onChange={(event) => (type === "tag" ? onRenameTag(id, event.target.value) : onRenameStatus(id, event.target.value))}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#F7F7F8] outline-none"
            />
            {standard ? <span className="rounded-full bg-[#25272F] px-2 py-0.5 text-[10px] font-bold text-[#8B949E]">標準</span> : null}
            {!standard ? (
              <button
                type="button"
                onClick={() => (type === "tag" ? onDeleteTag(id) : onDeleteStatus(id))}
                className="rounded-md p-1.5 text-[#8B949E] hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <CenterModal title="設定" eyebrow="Settings" onClose={onClose}>
      <div className="grid min-h-[420px] grid-cols-[150px_1fr] gap-5">
        <div className="space-y-2 border-r border-[#2A2F37] pr-4">
          {[
            ["workflow", "ワークフロー"],
            ["tag", "タグ"],
            ["status", "ステータス"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={clsx(
                "w-full rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors",
                tab === value ? "bg-[#1F3423] text-[#78D27F]" : "text-[#AAB4C2] hover:bg-[#202229] hover:text-[#F7F7F8]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-w-0">
          {tab === "workflow" ? (
            <div>
              <button
                type="button"
                onClick={onCreateWorkflowClick}
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#60B964] py-3 text-sm font-bold text-[#06100D]"
              >
                <Plus className="h-4 w-4" />
                ワークフロー追加
              </button>
              <div className="space-y-2">
                {workflows.map((workflow) => (
                  <div key={workflow.id} className="rounded-lg border border-[#34363D] bg-[#1C1D22] px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="break-words text-sm font-bold text-[#F7F7F8]">{workflow.name}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-[#B4BDCA]">
                          <span className="rounded-full bg-[#25272F] px-2 py-1">{describeWorkflowSchedule(workflow)}</span>
                          <span className="rounded-full bg-[#25272F] px-2 py-1">{describeWorkflowDeadline(workflow)}</span>
                          <span className="rounded-full bg-[#25272F] px-2 py-1">{formatNextRunLabel(workflow)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button type="button" onClick={() => onEditWorkflow?.(workflow)} className="rounded-md p-2 text-[#8B949E] hover:bg-[#25272F] hover:text-[#F7F7F8]">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => onToggleWorkflowEnabled?.(workflow.id)} className="rounded-md p-2 text-[#8B949E] hover:bg-[#25272F]">
                          {workflow.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                        <button type="button" onClick={() => onDeleteWorkflow?.(workflow.id)} className="rounded-md p-2 text-[#8B949E] hover:bg-red-500/10 hover:text-red-300">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex gap-2">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-[#34363D] bg-[#202229] px-3 py-2 text-sm font-bold text-[#F7F7F8] outline-none"
                  placeholder={tab === "tag" ? "タグ名" : "ステータス名"}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (tab === "tag") onCreateTag(draft);
                    if (tab === "status") onCreateStatus(draft);
                    setDraft("");
                  }}
                  className="rounded-lg bg-[#60B964] px-4 py-2 text-sm font-bold text-[#06100D]"
                >
                  追加
                </button>
              </div>
              {renderSortableList(tab === "tag" ? tags : statuses, tab)}
            </div>
          )}
        </div>
      </div>
    </CenterModal>
  );
}

function ViewSwitcher({
  views,
  activeViewId,
  width,
  onSelectView,
  onCreateView,
  onEditView,
  onDeleteView,
  onReorderView
}) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [draggedViewIndex, setDraggedViewIndex] = useState(null);
  const compact = width < 360;
  const visibleCount = width >= 500 ? 3 : 2;
  const visibleViews = compact ? [] : views.slice(0, visibleCount);
  const hiddenViews = compact ? views : views.slice(visibleCount);
  const activeView = views.find((view) => view.id === activeViewId) || views[0];
  const canDeleteView = views.length > 1;

  if (compact) {
    return (
      <div className="relative mx-4 mb-3">
        <button
          type="button"
          onClick={() => setIsMoreOpen((current) => !current)}
          className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-[#20242A] bg-[#0B0E11] px-3 py-2.5 text-left text-sm font-bold text-[#F7F7F8] outline-none transition-colors hover:border-[#34363D] hover:bg-[#111418]"
        >
          <span className="min-w-0 truncate">{activeView?.name || "ビュー"}</span>
          <ChevronDown className={clsx("h-4 w-4 shrink-0 text-[#8B949E] transition-transform", isMoreOpen && "rotate-180")} />
        </button>

        {isMoreOpen ? (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-xl border border-[#34363D] bg-[#111418] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
            {views.map((view, index) => (
              <div
                key={view.id}
                draggable
                onDragStart={(event) => {
                  setDraggedViewIndex(index);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(index));
                }}
                onDragEnd={() => setDraggedViewIndex(null)}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const fromIndex = Number(event.dataTransfer.getData("text/plain"));
                  if (Number.isFinite(fromIndex) && fromIndex !== index) onReorderView(fromIndex, index);
                  setDraggedViewIndex(null);
                }}
                className={clsx(
                  "group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors",
                  activeViewId === view.id ? "bg-[#1F3423] text-[#78D27F]" : "text-[#D7DEE8] hover:bg-[#202229]",
                  draggedViewIndex === index && "opacity-45"
                )}
              >
                <GripVertical className="h-4 w-4 shrink-0 text-[#66717F] opacity-70 transition-opacity group-hover:opacity-100" />
                <button
                  type="button"
                  onClick={() => {
                    onSelectView(view.id);
                    setIsMoreOpen(false);
                  }}
                  className="min-w-0 flex-1 truncate text-left text-sm font-bold"
                >
                  {view.name}
                </button>
                <button type="button" onClick={() => onEditView(view)} className="rounded-md p-1.5 text-[#8B949E] hover:bg-[#25272F] hover:text-[#F7F7F8]">
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                {canDeleteView ? (
                  <button type="button" onClick={() => onDeleteView(view.id)} className="rounded-md p-1.5 text-[#8B949E] hover:bg-red-500/10 hover:text-red-300">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setIsMoreOpen(false);
                onCreateView();
              }}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#34363D] px-3 py-2 text-sm font-bold text-[#AAB4C2] transition-colors hover:border-[#60B964]/60 hover:bg-[#60B964]/10 hover:text-[#78D27F]"
            >
              <Plus className="h-4 w-4" />
              ビューを作成
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-4 mb-3">
      <div className="flex items-center gap-1 rounded-xl bg-[#111418] p-1">
        {visibleViews.map((view, index) => (
          <button
            key={view.id}
            type="button"
            draggable
            onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onReorderView(Number(event.dataTransfer.getData("text/plain")), index)}
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenu({ view, x: event.clientX, y: event.clientY });
            }}
            onClick={() => onSelectView(view.id)}
            className={clsx(
              "min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-xs font-bold transition-colors",
              activeViewId === view.id ? "bg-[#090C0F] text-[#F7F7F8]" : "text-[#8B949E] hover:text-[#F7F7F8]"
            )}
          >
            {view.name}
          </button>
        ))}
        {hiddenViews.length > 0 ? (
          <button
            type="button"
            onClick={() => setIsMoreOpen((current) => !current)}
            className={clsx("rounded-lg px-2 py-2 text-[#8B949E] hover:text-[#F7F7F8]", hiddenViews.some((view) => view.id === activeViewId) && "bg-[#090C0F] text-[#F7F7F8]")}
            title={activeView?.name}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onCreateView}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#20242A] bg-[#0B0E11] text-[#AAB4C2] transition-colors hover:border-[#60B964]/60 hover:bg-[#60B964]/10 hover:text-[#78D27F]"
          title="ビューを作成"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {isMoreOpen ? (
        <div className="absolute left-4 right-4 z-50 mt-2 rounded-xl border border-[#34363D] bg-[#111418] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
          {hiddenViews.map((view, hiddenIndex) => {
            const viewIndex = visibleCount + hiddenIndex;
            return (
            <div
              key={view.id}
              draggable
              onDragStart={(event) => {
                setDraggedViewIndex(viewIndex);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(viewIndex));
              }}
              onDragEnd={() => setDraggedViewIndex(null)}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                const fromIndex = Number(event.dataTransfer.getData("text/plain"));
                if (Number.isFinite(fromIndex) && fromIndex !== viewIndex) onReorderView(fromIndex, viewIndex);
                setDraggedViewIndex(null);
              }}
              className={clsx("group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#202229]", draggedViewIndex === viewIndex && "opacity-45")}
            >
              <GripVertical className="h-4 w-4 shrink-0 text-[#66717F] opacity-0 transition-opacity group-hover:opacity-100" />
              <button type="button" onClick={() => onSelectView(view.id)} className="min-w-0 flex-1 truncate text-left text-sm font-bold text-[#F7F7F8]">
                {view.name}
              </button>
              <button type="button" onClick={() => onEditView(view)} className="rounded-md p-1.5 text-[#8B949E] hover:text-[#F7F7F8]">
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              {canDeleteView ? (
                <button type="button" onClick={() => onDeleteView(view.id)} className="rounded-md p-1.5 text-[#8B949E] hover:text-red-300">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setIsMoreOpen(false);
              onCreateView();
            }}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#34363D] px-3 py-2 text-sm font-bold text-[#AAB4C2] transition-colors hover:border-[#60B964]/60 hover:bg-[#60B964]/10 hover:text-[#78D27F]"
          >
            <Plus className="h-4 w-4" />
            ビューを作成
          </button>
        </div>
      ) : null}

      {contextMenu
        ? createPortal(
            <div
              className="fixed z-[100] rounded-lg border border-[#34363D] bg-[#111418] p-1 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onMouseLeave={() => setContextMenu(null)}
            >
              <button type="button" onClick={() => { onEditView(contextMenu.view); setContextMenu(null); }} className="block w-full rounded-md px-3 py-2 text-left text-sm font-bold text-[#F7F7F8] hover:bg-[#202229]">
                編集
              </button>
              {canDeleteView ? (
                <button type="button" onClick={() => { onDeleteView(contextMenu.view.id); setContextMenu(null); }} className="block w-full rounded-md px-3 py-2 text-left text-sm font-bold text-red-300 hover:bg-red-500/10">
                  削除
                </button>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export default function TaskPool({
  tasks,
  views = [],
  activeViewId,
  taskSidebarWidth = 320,
  statusOptions = [],
  workflows = [],
  selectedTaskId,
  hoveredTaskId,
  onSelectView,
  onSaveView,
  onDeleteView,
  onReorderView,
  onCreateInlineTask,
  onCreateWorkflow,
  onUpdateWorkflow,
  onToggleWorkflowEnabled,
  onDeleteWorkflow,
  onDeleteTask,
  onOpenDetail,
  onJumpToScheduledTask,
  onHoverTask,
  onUnscheduleTask,
  availableTags = [],
  onCreateTag,
  onRenameTag,
  onDeleteTag,
  onReorderTag,
  onCreateStatus,
  onRenameStatus,
  onDeleteStatus,
  onReorderStatus
}) {
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [editingView, setEditingView] = useState(null);

  return (
    <>
      <div
        className={`flex h-full flex-col pt-6 transition-all ${
          isDropTarget ? "bg-[#111418] ring-2 ring-[#60B964] ring-inset shadow-[inset_0_0_0_1px_rgba(96,185,100,0.22)]" : ""
        }`}
        onDragOver={(event) => {
          const payload = readDragPayload(event);
          if (!payload?.taskId || !payload?.sourceDateKey) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setIsDropTarget(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIsDropTarget(false);
        }}
        onDrop={(event) => {
          const payload = readDragPayload(event);
          if (!payload?.taskId || !payload?.sourceDateKey) return;
          event.preventDefault();
          setIsDropTarget(false);
          onUnscheduleTask(payload.taskId);
        }}
      >
        <div className="mx-4 mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onCreateInlineTask}
            className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-[#60B964] py-3 text-sm font-bold text-[#06100D] transition-all hover:scale-[1.01] hover:bg-[#54A85C]"
          >
            <Plus className="h-4 w-4" />
            新規タスク
          </button>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-[#B4BDCA] transition-colors hover:bg-[#111418] hover:text-[#F7F7F8]"
            title="設定"
          >
            <Settings2 className="h-5 w-5" />
          </button>
        </div>

        <ViewSwitcher
          views={views}
          activeViewId={activeViewId}
          width={taskSidebarWidth}
          onSelectView={onSelectView}
          onCreateView={() => setEditingView({})}
          onEditView={setEditingView}
          onDeleteView={onDeleteView}
          onReorderView={onReorderView}
        />

        <div className="flex-1 overflow-y-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#2A3038] bg-[#0B0E11] px-4 py-6 text-center">
              <div className="text-sm font-bold text-[#B8C0CC]">表示するタスクはありません</div>
            </div>
          ) : (
            tasks.map((task) => (
              <TaskListItem
                key={task.id}
                task={task}
                isActive={selectedTaskId === task.id}
                isRelated={hoveredTaskId === task.id}
                onDelete={onDeleteTask}
                onOpenDetail={onOpenDetail}
                onJumpToScheduledTask={onJumpToScheduledTask}
                onHoverTask={onHoverTask}
              />
            ))
          )}
        </div>
      </div>

      {editingView ? (
        <ViewEditorModal
          view={editingView.id ? editingView : null}
          availableTags={availableTags}
          statusOptions={statusOptions}
          onClose={() => setEditingView(null)}
          onSave={(draft) => {
            onSaveView(draft);
            setEditingView(null);
          }}
        />
      ) : null}

      {isSettingsOpen ? (
        <SettingsModal
          workflows={workflows}
          tags={availableTags}
          statuses={statusOptions}
          onClose={() => setIsSettingsOpen(false)}
          onCreateWorkflowClick={() => {
            setIsSettingsOpen(false);
            setEditingWorkflow(null);
            setIsWorkflowModalOpen(true);
          }}
          onEditWorkflow={(workflow) => {
            setEditingWorkflow(workflow);
            setIsWorkflowModalOpen(true);
          }}
          onToggleWorkflowEnabled={onToggleWorkflowEnabled}
          onDeleteWorkflow={onDeleteWorkflow}
          onCreateTag={onCreateTag}
          onRenameTag={onRenameTag}
          onDeleteTag={onDeleteTag}
          onReorderTag={onReorderTag}
          onCreateStatus={onCreateStatus}
          onRenameStatus={onRenameStatus}
          onDeleteStatus={onDeleteStatus}
          onReorderStatus={onReorderStatus}
        />
      ) : null}

      {isWorkflowModalOpen ? (
        <TaskWorkflowModal
          workflow={editingWorkflow}
          availableTags={availableTags}
          onClose={() => {
            setIsWorkflowModalOpen(false);
            setEditingWorkflow(null);
          }}
          onSave={(workflowDraft) => {
            if (editingWorkflow) {
              onUpdateWorkflow?.(workflowDraft);
            } else {
              onCreateWorkflow?.(workflowDraft);
            }
            setIsWorkflowModalOpen(false);
            setEditingWorkflow(null);
          }}
        />
      ) : null}
    </>
  );
}
