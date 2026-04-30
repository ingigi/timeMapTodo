const VIEWPORT_PADDING = 12;
const POPOVER_GAP = 8;

export const getAnchoredPopoverPlacement = (anchor, { width = 320, height = 320, align = "start" } = {}) => {
  const actualWidth = Math.min(width, window.innerWidth - VIEWPORT_PADDING * 2);

  if (!anchor) {
    return {
      top: VIEWPORT_PADDING,
      left: VIEWPORT_PADDING,
      width: actualWidth,
      maxHeight: Math.min(height, window.innerHeight - VIEWPORT_PADDING * 2)
    };
  }

  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - POPOVER_GAP - VIEWPORT_PADDING;
  const spaceAbove = rect.top - POPOVER_GAP - VIEWPORT_PADDING;
  const openUp = spaceBelow < height && spaceAbove > spaceBelow;
  const availableHeight = Math.max(openUp ? spaceAbove : spaceBelow, 180);
  const maxHeight = Math.min(height, availableHeight);
  const rawLeft = align === "end" ? rect.right - actualWidth : rect.left;
  const left = Math.min(Math.max(VIEWPORT_PADDING, rawLeft), window.innerWidth - actualWidth - VIEWPORT_PADDING);
  const top = openUp
    ? Math.max(VIEWPORT_PADDING, rect.top - POPOVER_GAP - maxHeight)
    : Math.min(window.innerHeight - VIEWPORT_PADDING - maxHeight, rect.bottom + POPOVER_GAP);

  return { top, left, width: actualWidth, maxHeight };
};

export const getSidePopoverPlacement = (
  anchor,
  sideElement,
  { width = 400, height = 300, minSideWidth = 300, sideGap = 12 } = {}
) => {
  const anchorRect = anchor?.getBoundingClientRect();
  const sideRect = sideElement?.getBoundingClientRect();
  const sideLeft = (sideRect?.right ?? anchorRect?.right ?? VIEWPORT_PADDING) + sideGap;
  const sideWidth = window.innerWidth - sideLeft - VIEWPORT_PADDING;
  const useSide = sideWidth >= minSideWidth;
  const actualWidth = useSide ? Math.min(width, sideWidth) : Math.min(width, window.innerWidth - VIEWPORT_PADDING * 2);
  const left = useSide ? sideLeft : Math.max(VIEWPORT_PADDING, window.innerWidth - actualWidth - VIEWPORT_PADDING);
  const rawTop = anchorRect?.top ?? VIEWPORT_PADDING;
  const availableHeight = Math.max(window.innerHeight - rawTop - VIEWPORT_PADDING, 180);
  const maxHeight = Math.min(height, availableHeight);
  const top = Math.min(Math.max(VIEWPORT_PADDING, rawTop), window.innerHeight - maxHeight - VIEWPORT_PADDING);

  return { top, left, width: actualWidth, maxHeight };
};
