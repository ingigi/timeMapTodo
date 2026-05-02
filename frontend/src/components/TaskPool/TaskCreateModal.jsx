import { useState } from "react";
import { X, Check } from "lucide-react";
import clsx from "clsx";

const COLORS = ["#0B5EAF", "#64789A", "#9A4600", "#059669", "#7C3AED", "#DB2777", "#DC2626", "#EA580C", "#2563EB"];

export default function TaskCreateModal({ onSave, onClose, allTasks }) {
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [parentId, setParentId] = useState("");

  const handleSave = () => {
    if (!title.trim()) return;

    let finalColor = color;
    if (parentId) {
      const parent = allTasks.find((task) => task.id === parentId);
      if (parent) finalColor = parent.color;
    }

    onSave({
      title: title.trim(),
      color: finalColor,
      parentId: parentId || null
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex max-h-[calc(100vh-32px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#34363D] bg-[#1C1D22] shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-2 text-[#A1A1AA] transition-colors hover:bg-[#25272F] hover:text-[#F4F4F5]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-[#34363D] px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#71717A]">Task</div>
          <h2 className="mt-1 text-xl font-semibold text-[#F4F4F5]">新しいタスク</h2>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#A1A1AA]">
              タスク名<span className="text-red-300">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-[#34363D] bg-[#15161A] px-3 py-2.5 text-sm text-[#F4F4F5] outline-none transition placeholder:text-[#71717A] focus:border-[#60B964] focus:ring-2 focus:ring-[#60B964]/25"
              placeholder="例: ホームページのデザイン"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#A1A1AA]">親タスク</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full rounded-lg border border-[#34363D] bg-[#15161A] px-3 py-2.5 text-sm text-[#F4F4F5] outline-none transition focus:border-[#60B964] focus:ring-2 focus:ring-[#60B964]/25"
            >
              <option value="">なし</option>
              {allTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#A1A1AA]">カラー</label>
            <div className="flex flex-wrap gap-2 pt-1">
              {COLORS.map((value) => (
                <button
                  key={value}
                  onClick={() => setColor(value)}
                  className={clsx("flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#34363D] transition-transform hover:scale-105", color === value && "border-[#F4F4F5]")}
                  style={{ backgroundColor: value }}
                >
                  {color === value && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#34363D] px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#A1A1AA] transition-colors hover:bg-[#25272F] hover:text-[#F4F4F5]">
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="rounded-lg bg-[#60B964] px-5 py-2.5 text-sm font-semibold text-[#06100D] transition-colors hover:bg-[#54A85C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            作成
          </button>
        </div>
      </div>
    </div>
  );
}




