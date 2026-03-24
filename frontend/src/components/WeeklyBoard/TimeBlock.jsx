import clsx from "clsx";

export default function TimeBlock({
  isAssigned,
  isPaintingPreview,
  taskColor,
  taskTitle,
  onMouseDown,
  onMouseEnter,
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onDragStart={(e) => e.preventDefault()}
      className={clsx(
        "h-16 w-full border border-slate-200 select-none transition-all",
        !isAssigned && !isPaintingPreview && "bg-white hover:bg-slate-50",
        isAssigned && "text-white font-medium text-xs p-2 text-left truncate flex items-center justify-start",
        isPaintingPreview && "border-2 border-dashed bg-opacity-20 flex items-center justify-center"
      )}
      style={{
        backgroundColor: isAssigned ? taskColor : isPaintingPreview ? taskColor : undefined,
        borderColor: (isAssigned || isPaintingPreview) ? taskColor : undefined,
      }}
    >
      {isAssigned && taskTitle}
      {isPaintingPreview && (
        <span className="text-xs font-bold" style={{ color: taskColor }}>
          PAINTING
        </span>
      )}
    </div>
  );
}
