import { getTaskPalette } from "./taskColors";

export function attachDragPreview(event, { title, color }) {
  const palette = getTaskPalette(color);
  const preview = document.createElement("div");
  preview.style.position = "fixed";
  preview.style.top = "-9999px";
  preview.style.left = "-9999px";
  preview.style.width = "168px";
  preview.style.minHeight = "132px";
  preview.style.padding = "12px";
  preview.style.display = "flex";
  preview.style.flexDirection = "column";
  preview.style.justifyContent = "space-between";
  preview.style.borderRadius = "16px";
  preview.style.border = `1px solid ${palette.border}`;
  preview.style.background = palette.surface;
  preview.style.boxShadow = `0 8px 20px ${palette.shadow}`;
  preview.style.pointerEvents = "none";

  const titleNode = document.createElement("div");
  titleNode.textContent = title || "Task";
  titleNode.style.fontSize = "14px";
  titleNode.style.lineHeight = "22px";
  titleNode.style.fontWeight = "600";
  titleNode.style.color = "#0f172a";
  titleNode.style.wordBreak = "break-word";

  const footer = document.createElement("div");
  footer.style.marginTop = "16px";
  footer.style.display = "flex";
  footer.style.justifyContent = "space-between";
  footer.style.alignItems = "center";

  const colorBar = document.createElement("div");
  colorBar.style.height = "6px";
  colorBar.style.width = "48px";
  colorBar.style.borderRadius = "999px";
  colorBar.style.background = palette.base;

  footer.appendChild(colorBar);
  preview.appendChild(titleNode);
  preview.appendChild(footer);
  document.body.appendChild(preview);
  event.dataTransfer.setDragImage(preview, 22, 18);

  return () => {
    preview.remove();
  };
}
