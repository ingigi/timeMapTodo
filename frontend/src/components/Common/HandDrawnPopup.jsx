import { Check, ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

function Field({ label, children, align = "center" }) {
  const alignClass = align === "start" ? "md:items-start" : "md:items-center";
  return (
    <div className={`grid gap-3 md:grid-cols-[84px_1fr] ${alignClass}`}>
      <label className="pt-1 text-sm font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

export default function HandDrawnPopup({ task, availableTags = [], onCreateTag, onDeleteTag, onClose, onUpdate }) {
  const popupRef = useRef(null);
  const tagMenuRef = useRef(null);
  const tagTriggerRef = useRef(null);
  const newTagInputRef = useRef(null);
  const [tagMenuDirection, setTagMenuDirection] = useState("down");
  const [formData, setFormData] = useState({
    title: task.title || "",
    selectedTags: task.tags || [],
    deadline: task.deadline || "",
    description: task.description || ""
  });
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [editingNewTag, setEditingNewTag] = useState(false);
  const [newTagDraft, setNewTagDraft] = useState("");

  const selectedTagSet = useMemo(() => new Set(formData.selectedTags), [formData.selectedTags]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleTag = (tag) => {
    setFormData((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tag) ? prev.selectedTags.filter((item) => item !== tag) : [...prev.selectedTags, tag]
    }));
  };

  const commitNewTag = () => {
    const trimmed = newTagDraft.trim();
    if (!trimmed) {
      setEditingNewTag(false);
      setNewTagDraft("");
      return;
    }

    onCreateTag(trimmed);
    setFormData((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(trimmed) ? prev.selectedTags : [...prev.selectedTags, trimmed]
    }));
    setEditingNewTag(false);
    setNewTagDraft("");
    setIsTagMenuOpen(true);
  };

  const handleRemoveTagOption = (tag) => {
    onDeleteTag(tag);
    setFormData((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.filter((item) => item !== tag)
    }));
  };

  const handleSave = () => {
    onUpdate(task.id, {
      title: formData.title.trim(),
      deadline: formData.deadline,
      description: formData.description,
      tags: formData.selectedTags
    });
    onClose();
  };

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        if (editingNewTag) {
          setEditingNewTag(false);
          setNewTagDraft("");
          return;
        }
        if (isTagMenuOpen) {
          setIsTagMenuOpen(false);
          return;
        }
        onClose();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [editingNewTag, isTagMenuOpen, onClose]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const target = event.target;

      if (
        isTagMenuOpen &&
        tagMenuRef.current &&
        !tagMenuRef.current.contains(target) &&
        tagTriggerRef.current &&
        !tagTriggerRef.current.contains(target)
      ) {
        setIsTagMenuOpen(false);
        setEditingNewTag(false);
        setNewTagDraft("");
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isTagMenuOpen]);

  useEffect(() => {
    if (editingNewTag && newTagInputRef.current) {
      newTagInputRef.current.focus();
      newTagInputRef.current.select();
    }
  }, [editingNewTag]);

  useLayoutEffect(() => {
    if (!isTagMenuOpen || !tagTriggerRef.current) return;

    const rect = tagTriggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setTagMenuDirection(spaceBelow < 320 && spaceAbove > spaceBelow ? "up" : "down");
  }, [isTagMenuOpen, editingNewTag, availableTags.length, formData.selectedTags.length]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={popupRef}
        className="flex max-h-[calc(100vh-32px)] w-full max-w-[620px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Task Details</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">タスクの詳細</div>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-5">
            <div>
              <input
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-2xl font-semibold text-slate-900 outline-none transition-colors placeholder:text-slate-300 focus:border-slate-400"
                placeholder="タスク名"
              />
            </div>

            <Field label="説明" align="start">
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                placeholder="背景やメモを入力"
              />
            </Field>

            <Field label="期限">
              <input
                type="date"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
              />
            </Field>

            <Field label="タグ" align="start">
              <div className="relative">
                <button
                  ref={tagTriggerRef}
                  type="button"
                  onClick={() => {
                    setIsTagMenuOpen((prev) => !prev);
                    setEditingNewTag(false);
                    setNewTagDraft("");
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-slate-300"
                >
                  <div className="flex min-w-0 flex-wrap gap-2">
                    {formData.selectedTags.length > 0 ? (
                      formData.selectedTags.map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">タグを選択</span>
                    )}
                  </div>
                  <ChevronDown className={clsx("h-4 w-4 shrink-0 text-slate-400 transition-transform", isTagMenuOpen && "rotate-180")} />
                </button>

                {isTagMenuOpen && (
                  <div
                    ref={tagMenuRef}
                    className={clsx(
                      "absolute left-0 right-0 z-20 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.12)]",
                      tagMenuDirection === "up" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"
                    )}
                  >
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Available Tags</div>

                    <div className="mb-3 max-h-40 space-y-1 overflow-y-auto pr-1">
                      {availableTags.length > 0 ? (
                        availableTags.map((tag) => {
                          const checked = selectedTagSet.has(tag);
                          return (
                            <div
                              key={tag}
                              className={clsx(
                                "flex items-center gap-2 rounded-xl px-3 py-2 transition-colors",
                                checked ? "bg-slate-100" : "hover:bg-slate-50"
                              )}
                            >
                              <button type="button" onClick={() => toggleTag(tag)} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left text-sm">
                                <span className="truncate text-slate-700">{tag}</span>
                                <span
                                  className={clsx(
                                    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                                    checked ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-transparent"
                                  )}
                                >
                                  <Check className="h-3 w-3" />
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveTagOption(tag)}
                                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                title="タグを削除"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">まだタグがありません</div>
                      )}

                      {editingNewTag && (
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                          <Pencil className="h-4 w-4 text-slate-400" />
                          <input
                            ref={newTagInputRef}
                            value={newTagDraft}
                            onChange={(event) => setNewTagDraft(event.target.value)}
                            onBlur={commitNewTag}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitNewTag();
                              }
                            }}
                            className="flex-1 bg-transparent text-sm text-slate-800 outline-none"
                            placeholder="新しいタグ名"
                          />
                        </div>
                      )}
                    </div>

                    {!editingNewTag && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNewTag(true);
                          setNewTagDraft("新しいタグ");
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900"
                      >
                        <Plus className="h-4 w-4" />
                        新しいタグを作成
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
