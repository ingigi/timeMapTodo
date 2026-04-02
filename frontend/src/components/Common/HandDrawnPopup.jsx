import { X, Calendar, Tag, FileText, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function HandDrawnPopup({ task, onClose, onUpdate }) {
  const [formData, setFormData] = useState({
    title: task.title || '',
    tags: task.tags?.join(', ') || '',
    deadline: task.deadline || '',
    description: task.description || '',
    totalTime: task.totalTime || 1
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onUpdate(task.id, {
      ...formData,
      tags: formData.tags.split(',').map(t => t.trim()).filter(t => t !== ''),
      totalTime: parseFloat(formData.totalTime) || 1
    });
    onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="relative bg-white w-full max-w-md p-8 shadow-2xl transition-all"
        style={{
          borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px',
          border: '3px solid #334155',
          transform: 'rotate(-1deg)'
        }}
      >
        {/* Hand-drawn style accents */}
        <div className="absolute -top-2 -right-2 bg-white border-2 border-slate-700 p-1 rounded-full cursor-pointer hover:bg-slate-50 transition-colors" onClick={onClose}>
          <X className="w-5 h-5 text-slate-700" />
        </div>

        <div className="space-y-6 transform rotate-1">
          {/* Title */}
          <div className="border-b-2 border-slate-400 pb-1">
            <input
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full bg-transparent outline-none text-2xl font-black text-slate-800 placeholder-slate-300"
              placeholder="タスク名"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-black text-slate-400 uppercase tracking-widest block mb-2">説明</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full p-4 bg-slate-50 border-2 border-slate-200 outline-none focus:border-blue-400 transition-all text-sm font-bold text-slate-700"
              style={{ borderRadius: '25px 5px 20px 10px / 10px 20px 10px 25px' }}
              placeholder="..."
            />
          </div>

          {/* Attributes Group (Labels & Circle-like Inputs) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black text-slate-600">残り時間</label>
              <div className="w-48 h-12 rounded-full border-2 border-slate-300 flex items-center px-4 bg-white hover:border-blue-400 transition-colors">
                <input 
                  type="number"
                  name="totalTime"
                  value={formData.totalTime}
                  onChange={handleChange}
                  className="w-full bg-transparent outline-none font-black text-slate-800 text-center"
                />
                <span className="text-xs font-black text-slate-400 ml-1">h</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-black text-slate-600">期限</label>
              <div className="w-48 h-12 rounded-full border-2 border-slate-300 flex items-center px-4 bg-white hover:border-blue-400 transition-colors overflow-hidden">
                <input 
                  type="date"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleChange}
                  className="w-full bg-transparent outline-none font-black text-slate-800 text-center text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-black text-slate-600">タグ</label>
              <div className="w-48 h-12 rounded-full border-2 border-slate-300 flex items-center px-4 bg-white hover:border-blue-400 transition-colors">
                <input 
                  name="tags"
                  value={formData.tags}
                  onChange={handleChange}
                  className="w-full bg-transparent outline-none font-black text-slate-800 text-center text-xs"
                  placeholder="重要, 仕事..."
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={onClose}
              className="flex-1 py-3 border-2 border-slate-200 text-slate-500 font-black rounded-full hover:bg-slate-50 transition-all active:scale-95 text-sm uppercase"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-slate-900 text-white font-black rounded-full hover:bg-black transition-all shadow-lg active:scale-95 text-sm uppercase"
            >
              保存
            </button>
          </div>
        </div>
      </div>
      
      {/* Hand-drawn style SVG Filter for border wobble */}
      <svg className="hidden">
        <filter id="hand-drawn-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
        </filter>
      </svg>
    </div>
  );
}
