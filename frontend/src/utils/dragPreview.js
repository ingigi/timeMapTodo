const createTransparentDragImage = () => {
  const transparentPreview = document.createElement("div");
  transparentPreview.style.position = "fixed";
  transparentPreview.style.top = "-9999px";
  transparentPreview.style.left = "-9999px";
  transparentPreview.style.width = "1px";
  transparentPreview.style.height = "1px";
  transparentPreview.style.opacity = "0";
  document.body.appendChild(transparentPreview);
  return transparentPreview;
};

export function attachDragPreview(event) {
  const transparentPreview = createTransparentDragImage();

  event.dataTransfer.setDragImage(transparentPreview, 0, 0);

  return () => {
    transparentPreview.remove();
  };
}
