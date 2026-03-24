import { useState } from 'react';
import { X, Check } from 'lucide-react';
import clsx from 'clsx';

const COLORS = ['#0B5EAF', '#64789A', '#9A4600', '#059669', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#2563EB'];

export default function TaskCreateModal({ onSave, onClose, allTasks }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [totalTime, setTotalTime] = useState(1);
  const [parentId, setParentId] = useState('');

  const handleSave = () => {
    if (!title.trim()) return;
    
    let finalColor = color;
    if (parentId) {
      const parent = allTasks.find(p => p.id === parentId);
      if (parent) finalColor = parent.color;
    }

    onSave({
      title: title.trim(),
      category: category.trim(),
      color: finalColor,
      totalTime: totalTime, 
      parentId: parentId || null
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        
        <h2 className="mb-6 text-xl font-bold text-slate-800">新規タスクの作成</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">タスク名 <span className="text-red-500">*</span></label>
            <input 
              autoFocus
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="例: ホームページのデザイン"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">親タスク（任意）</label>
              <select 
                value={parentId}
                onChange={e => setParentId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">なし（最上位階層）</option>
                {allTasks.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">予定時間（時間）</label>
              <input 
                type="number" 
                min="0.5"
                step="0.5"
                value={totalTime}
                onChange={e => setTotalTime(parseFloat(e.target.value) || 0)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">カテゴリ / 部門</label>
              <input 
                type="text" 
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="例: エンジニアリング"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">テーマカラー</label>
              <div className="flex flex-wrap gap-2 pt-1">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={clsx(
                      "w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110",
                      color === c ? "ring-2 ring-offset-2 ring-blue-500" : ""
                    )}
                    style={{ backgroundColor: c }}
                  >
                    {color === c && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button 
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            キャンセル
          </button>
          <button 
            onClick={handleSave}
            disabled={!title.trim()}
            className="rounded-md bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            タスクを作成
          </button>
        </div>
      </div>
    </div>
  );
}
