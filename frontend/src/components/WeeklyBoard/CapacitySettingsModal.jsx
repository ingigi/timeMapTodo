import { useState } from 'react';
import { X } from 'lucide-react';

const DAY_NAMES = ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"];

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative flex max-h-[calc(100vh-32px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#34363D] bg-[#1C1D22] shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-2 text-[#A1A1AA] transition-colors hover:bg-[#25272F] hover:text-[#F4F4F5]"
        >
          <X className="h-5 w-5" />
        </button>
        
        <div className="border-b border-[#34363D] px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#71717A]">Capacity</div>
          <h2 className="mt-1 text-xl font-semibold text-[#F4F4F5]">キャパシティ設定</h2>
          <p className="mt-2 text-sm text-[#A1A1AA]">1日あたりのタスクに利用可能な最大時間を設定します。</p>
        </div>

        <div className="space-y-3 px-6 py-5">
          {DAY_NAMES.map((day, idx) => (
            <div key={day} className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#F4F4F5]">{day}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={capacities[idx]}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  className="w-16 rounded-lg border border-[#34363D] bg-[#15161A] px-2 py-1.5 text-center text-sm font-semibold text-[#F4F4F5] outline-none transition focus:border-[#60B964] focus:ring-2 focus:ring-[#60B964]/25"
                />
                <span className="w-8 text-sm font-medium text-[#A1A1AA]">h/d</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[#34363D] px-6 py-4">
          <button 
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#A1A1AA] transition-colors hover:bg-[#25272F] hover:text-[#F4F4F5]"
          >
            キャンセル
          </button>
          <button 
            onClick={handleSave}
            className="rounded-lg bg-[#60B964] px-5 py-2.5 text-sm font-semibold text-[#06100D] transition-colors hover:bg-[#54A85C]"
          >
            変更を保存
          </button>
        </div>
      </div>
    </div>
  );
}




