export function attachDragPreview(event, { title, duration, color }) {
  const preview = document.createElement("div");
  preview.style.position = "fixed";
  preview.style.top = "-9999px";
  preview.style.left = "-9999px";
  preview.style.padding = "10px 12px";
  preview.style.borderRadius = "14px";
  preview.style.border = `1px solid ${color || "#cbd5e1"}`;
  preview.style.borderLeft = `4px solid ${color || "#94a3b8"}`;
  preview.style.background = "rgba(255,255,255,0.96)";
  preview.style.boxShadow = "0 18px 38px rgba(15, 23, 42, 0.16)";
  preview.style.backdropFilter = "blur(8px)";
  preview.style.minWidth = "150px";
  preview.style.pointerEvents = "none";

  const titleNode = document.createElement("div");
  titleNode.textContent = title || "タスク";
  titleNode.style.fontSize = "12px";
  titleNode.style.fontWeight = "700";
  titleNode.style.color = "#0f172a";
  titleNode.style.marginBottom = "4px";

  const metaNode = document.createElement("div");
  metaNode.textContent = `${duration}h を割り当て`;
  metaNode.style.fontSize = "11px";
  metaNode.style.fontWeight = "600";
  metaNode.style.color = "#475569";

  preview.appendChild(titleNode);
  preview.appendChild(metaNode);
  document.body.appendChild(preview);
  event.dataTransfer.setDragImage(preview, 18, 18);

  return () => {
    preview.remove();
  };
}
