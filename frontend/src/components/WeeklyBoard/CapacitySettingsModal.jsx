import { useState } from 'react';
import { X } from 'lucide-react';

const DAY_NAMES = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];

export default function CapacitySettingsModal({ initialCapacities, onSave, onClose }) {
  const [capacities, setCapacities] = useState([...initialCapacities]);

  const handleChange = (idx, value) => {
    const num = parseInt(value, 10);
    const newCaps = [...capacities];
    newCaps[idx] = isNaN(num) ? 0 : Math.max(0, Math.min(24, num));
    setCapacities(newCaps);
  };

  const handleSave = () => {
    onSave(capacities);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        
        <h2 className="mb-2 text-xl font-bold text-slate-800">キャパシティ設定</h2>
        <p className="mb-6 text-sm text-slate-500">
          1日あたりのタスクに利用可能な最大時間を設定します。
        </p>

        <div className="space-y-3 mb-8">
          {DAY_NAMES.map((day, idx) => (
            <div key={day} className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">{day}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={capacities[idx]}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-center text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-500 w-8">h/d</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button 
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            キャンセル
          </button>
          <button 
            onClick={handleSave}
            className="rounded-md bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            変更を保存
          </button>
        </div>
      </div>
    </div>
  );
}
