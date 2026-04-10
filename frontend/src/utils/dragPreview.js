import { getTaskPalette } from "./taskColors";

export function attachDragPreview(event, { title, color, completed = false } = {}) {
  const palette = getTaskPalette(color);
  const preview = document.createElement("div");
  preview.style.position = "fixed";
  preview.style.top = "-9999px";
  preview.style.left = "-9999px";
  preview.style.width = "176px";
  preview.style.minHeight = "132px";
  preview.style.padding = "12px";
  preview.style.display = "flex";
  preview.style.flexDirection = "column";
  preview.style.justifyContent = "space-between";
  preview.style.borderRadius = "18px";
  preview.style.border = `1px solid ${palette.border}`;
  preview.style.background = palette.surfaceStrong;
  preview.style.boxShadow = `0 8px 20px ${palette.shadow}`;
  preview.style.pointerEvents = "none";
  preview.style.overflow = "hidden";
  preview.style.fontFamily = "Inter, system-ui, -apple-system, sans-serif";

  const topRow = document.createElement("div");
  topRow.style.display = "flex";
  topRow.style.alignItems = "flex-start";
  topRow.style.justifyContent = "space-between";
  topRow.style.gap = "12px";

  const titleNode = document.createElement("div");
  titleNode.textContent = title || "Task";
  titleNode.style.fontSize = "14px";
  titleNode.style.lineHeight = "22px";
  titleNode.style.fontWeight = "600";
  titleNode.style.color = "#0f172a";
  titleNode.style.wordBreak = "break-word";
  titleNode.style.flex = "1";

  const close = document.createElement("div");
  close.style.display = "inline-flex";
  close.style.alignItems = "center";
  close.style.justifyContent = "center";
  close.style.width = "22px";
  close.style.height = "22px";
  close.style.borderRadius = "9999px";
  close.style.color = "#94a3b8";
  close.style.flex = "0 0 auto";
  close.textContent = "×";

  topRow.appendChild(titleNode);
  topRow.appendChild(close);

  const footer = document.createElement("div");
  footer.style.display = "flex";
  footer.style.alignItems = "center";
  footer.style.justifyContent = "space-between";
  footer.style.gap = "12px";

  const colorBar = document.createElement("div");
  colorBar.style.height = "6px";
  colorBar.style.width = "52px";
  colorBar.style.borderRadius = "999px";
  colorBar.style.background = palette.base;

  const button = document.createElement("div");
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.gap = "4px";
  button.style.borderRadius = "9999px";
  button.style.border = `1px solid ${completed ? palette.completedBorder : "rgb(226 232 240)"}`;
  button.style.background = completed ? "white" : "rgba(255,255,255,0.8)";
  button.style.color = completed ? palette.text : "#334155";
  button.style.padding = "4px 10px";
  button.style.fontSize = "10px";
  button.style.fontWeight = "600";
  button.style.lineHeight = "1";
  button.style.whiteSpace = "nowrap";
  button.textContent = completed ? "↺ 戻す" : "✓ 完了";

  footer.appendChild(colorBar);
  footer.appendChild(button);

  preview.appendChild(topRow);
  preview.appendChild(footer);
  document.body.appendChild(preview);
  event.dataTransfer.setDragImage(preview, 22, 18);

  return () => {
    preview.remove();
  };
}
