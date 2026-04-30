import { getTaskPalette } from "./taskColors";

const prepareClone = (sourceElement) => {
  const rect = sourceElement.getBoundingClientRect();
  const clone = sourceElement.cloneNode(true);

  clone.removeAttribute("id");
  clone.setAttribute("aria-hidden", "true");
  clone.style.position = "fixed";
  clone.style.top = "-9999px";
  clone.style.left = "-9999px";
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  clone.style.pointerEvents = "none";
  clone.style.transform = "none";
  clone.style.opacity = "1";
  clone.style.margin = "0";
  clone.style.zIndex = "-1";

  clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  clone.querySelectorAll("button, input, textarea, select").forEach((node) => {
    node.setAttribute("tabindex", "-1");
  });

  return { clone, rect };
};

const createFallbackPreview = ({ title, color, completed = false } = {}) => {
  const palette = getTaskPalette(color);
  const preview = document.createElement("div");
  preview.style.position = "fixed";
  preview.style.top = "-9999px";
  preview.style.left = "-9999px";
  preview.style.width = "220px";
  preview.style.minHeight = "44px";
  preview.style.padding = "10px 12px";
  preview.style.borderRadius = "12px";
  preview.style.border = `1px solid ${palette.border}`;
  preview.style.background = completed ? palette.completedSurface : palette.surface;
  preview.style.boxShadow = `0 18px 38px ${palette.shadow}`;
  preview.style.pointerEvents = "none";
  preview.style.overflow = "hidden";
  preview.style.fontFamily = "Inter, system-ui, -apple-system, sans-serif";
  preview.style.fontSize = "13px";
  preview.style.fontWeight = "700";
  preview.style.lineHeight = "18px";
  preview.style.color = completed ? palette.mutedText : palette.text;
  preview.textContent = title || "Task";
  if (completed) preview.style.textDecoration = "line-through";

  return { clone: preview, rect: { left: 0, top: 0, width: 220, height: 44 } };
};

export function attachDragPreview(event, options = {}) {
  if (options.hideNativePreview) {
    const transparentPreview = document.createElement("div");
    transparentPreview.style.position = "fixed";
    transparentPreview.style.top = "-9999px";
    transparentPreview.style.left = "-9999px";
    transparentPreview.style.width = "1px";
    transparentPreview.style.height = "1px";
    transparentPreview.style.opacity = "0";
    document.body.appendChild(transparentPreview);
    event.dataTransfer.setDragImage(transparentPreview, 0, 0);

    return () => {
      transparentPreview.remove();
    };
  }

  const sourceElement = options.sourceElement instanceof Element ? options.sourceElement : event.currentTarget;
  const { clone, rect } = sourceElement instanceof Element ? prepareClone(sourceElement) : createFallbackPreview(options);
  const offsetX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
  const offsetY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));

  document.body.appendChild(clone);
  event.dataTransfer.setDragImage(clone, offsetX, offsetY);

  return () => {
    clone.remove();
  };
}
