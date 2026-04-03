const DEFAULT_COLOR = "#94a3b8";

function normalizeHex(hex) {
  if (!hex || typeof hex !== "string") return DEFAULT_COLOR;
  if (!hex.startsWith("#")) return DEFAULT_COLOR;

  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }

  return hex.length === 7 ? hex : DEFAULT_COLOR;
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex).slice(1);
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

export function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getTaskPalette(color) {
  const base = normalizeHex(color);

  return {
    base,
    surface: withAlpha(base, 0.1),
    surfaceStrong: withAlpha(base, 0.15),
    border: withAlpha(base, 0.28),
    borderStrong: withAlpha(base, 0.42),
    text: base,
    mutedText: withAlpha(base, 0.84),
    badge: withAlpha(base, 0.14),
    badgeStrong: withAlpha(base, 0.2),
    completedSurface: withAlpha(base, 0.055),
    completedBorder: withAlpha(base, 0.18),
    deadlineSurface: withAlpha(base, 0.08),
    deadlineBorder: withAlpha(base, 0.52),
    shadow: withAlpha(base, 0.14)
  };
}
