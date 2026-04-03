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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-6 text-xl font-bold text-slate-800">新しいタスク</h2>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              タスク名 <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="例: ホームページのデザイン"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">親タスク</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            <label className="mb-1 block text-xs font-semibold text-slate-600">カラー</label>
            <div className="flex flex-wrap gap-2 pt-1">
              {COLORS.map((value) => (
                <button
                  key={value}
                  onClick={() => setColor(value)}
                  className={clsx("flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110", color === value && "ring-2 ring-blue-500 ring-offset-2")}
                  style={{ backgroundColor: value }}
                >
                  {color === value && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100">
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="rounded-md bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            作成
          </button>
        </div>
      </div>
    </div>
  );
}
