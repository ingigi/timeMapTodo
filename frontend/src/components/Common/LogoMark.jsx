import { useId } from "react";

export default function LogoMark({ className = "h-8 w-8", title = "TimeMapTodo" }) {
  const shadowId = `timemap-hourglass-shadow-${useId().replace(/:/g, "")}`;

  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label={title}>
      <defs>
        <filter id={shadowId} x="4" y="4" width="56" height="56" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0F172A" floodOpacity=".14" />
        </filter>
      </defs>
      <rect x="5" y="5" width="54" height="54" rx="15" fill="#F8FAFC" filter={`url(#${shadowId})`} />
      <path
        d="M20 12h24M22 16c0 8 4 12 10 16-6 4-10 8-10 16M42 16c0 8-4 12-10 16 6 4 10 8 10 16M20 52h24"
        fill="none"
        stroke="#1F2937"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <path d="M25 20c4 3 10 3 14 0-1 5-4 8-7 10-3-2-6-5-7-10Z" fill="#6ED39B" />
      <rect x="21" y="40" width="9" height="9" rx="2" fill="#4FB7A8" />
      <rect x="31" y="34" width="9" height="15" rx="2" fill="#5B8DEF" />
      <rect x="41" y="39" width="8" height="10" rx="2" fill="#D9A441" />
    </svg>
  );
}
