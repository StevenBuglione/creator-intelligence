// Original 20px stroke icons drawn for this project. Decorative by default.
const paths: Record<string, React.ReactNode> = {
  overview: (
    <>
      <path d="M3.5 3.5h5v6h-5zM11.5 3.5h5v3.5h-5zM11.5 10h5v6.5h-5zM3.5 12.5h5v4h-5z" />
    </>
  ),
  channel: (
    <>
      <path d="M3 15.5V9.5M7.5 15.5V5M12 15.5v-4M16.5 15.5V7.5" />
      <path d="M2.5 17.5h15" />
    </>
  ),
  research: (
    <>
      <circle cx="8.5" cy="8.5" r="5" />
      <path d="m12.25 12.25 4.5 4.5" />
    </>
  ),
  channels: (
    <>
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
      <path d="m8.5 7.75 4 2.25-4 2.25z" />
    </>
  ),
  idea: (
    <>
      <path d="M7.25 14.5h5.5M8 17h4" />
      <path d="M10 2.75a5 5 0 0 0-3 9c.6.45.85 1 .85 1.75h4.3c0-.75.25-1.3.85-1.75a5 5 0 0 0-3-9Z" />
    </>
  ),
  blueprint: (
    <>
      <path d="M4.5 2.5h7.5l3.5 3.5v11.5h-11z" />
      <path d="M11.5 2.5v4h4M7.5 10.5h5M7.5 13.5h5" />
    </>
  ),
  settings: (
    <>
      <path d="M3 5.5h8M14.5 5.5H17M3 14.5h2.5M9 14.5h8" />
      <circle cx="12.75" cy="5.5" r="1.75" />
      <circle cx="7.25" cy="14.5" r="1.75" />
    </>
  ),
  refresh: (
    <>
      <path d="M16 9.5A6 6 0 1 1 14.25 5" />
      <path d="M15 2.5v3.25h-3.25" />
    </>
  ),
  external: (
    <>
      <path d="M8.5 4.5H4.5v11h11v-4" />
      <path d="M11.5 3.5h5v5M16.5 3.5 9 11" />
    </>
  ),
  download: (
    <>
      <path d="M10 3v9.5M6 8.75l4 4 4-4" />
      <path d="M3.5 14v2.5h13V14" />
    </>
  ),
  arrow: <path d="M4 10h11.5M11 5.5l4.5 4.5-4.5 4.5" />,
  check: <path d="m4.5 10.5 3.5 3.5 7.5-8" />,
  alert: (
    <>
      <path d="M10 3 2.5 16.5h15z" />
      <path d="M10 8v3.75M10 14.1v.15" />
    </>
  ),
  info: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 9v4.75M10 6.4v.15" />
    </>
  ),
  close: <path d="m5 5 10 10M15 5 5 15" />,
  lock: (
    <>
      <rect x="4" y="9" width="12" height="8.5" rx="1.5" />
      <path d="M6.75 9V6.5a3.25 3.25 0 0 1 6.5 0V9" />
    </>
  ),
  plus: <path d="M10 4v12M4 10h12" />,
  edit: (
    <>
      <path d="m12.5 4 3.5 3.5L7.5 16H4v-3.5z" />
      <path d="m10.5 6 3.5 3.5" />
    </>
  ),
  trash: (
    <>
      <path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.75 11h7.5l.75-11" />
    </>
  ),
  copy: (
    <>
      <rect x="7" y="7" width="9.5" height="9.5" rx="1.5" />
      <path d="M13 7V4.5A1 1 0 0 0 12 3.5H4.5a1 1 0 0 0-1 1V12a1 1 0 0 0 1 1H7" />
    </>
  ),
  link: (
    <>
      <path d="M8.5 11.5a3 3 0 0 0 4.25 0l2.5-2.5a3 3 0 0 0-4.25-4.25L10 5.75" />
      <path d="M11.5 8.5a3 3 0 0 0-4.25 0l-2.5 2.5a3 3 0 0 0 4.25 4.25l1-1" />
    </>
  ),
  spark: (
    <path d="M10 2.5v4M10 13.5v4M2.5 10h4M13.5 10h4M5 5l2.25 2.25M12.75 12.75 15 15M15 5l-2.25 2.25M7.25 12.75 5 15" />
  ),
  shield: (
    <>
      <path d="M10 2.5 3.5 5v5c0 3.75 2.75 6.5 6.5 7.5 3.75-1 6.5-3.75 6.5-7.5V5z" />
      <path d="m7.25 10 2 2 3.75-4" />
    </>
  ),
  database: (
    <>
      <ellipse cx="10" cy="5" rx="6" ry="2.25" />
      <path d="M4 5v10c0 1.25 2.7 2.25 6 2.25s6-1 6-2.25V5M4 10c0 1.25 2.7 2.25 6 2.25s6-1 6-2.25" />
    </>
  ),
  exit: (
    <>
      <path d="M8 3.5H4.5v13H8" />
      <path d="M8.5 10h8M13.5 6.5 17 10l-3.5 3.5" />
    </>
  ),
};

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 18,
  label,
}: {
  name: IconName | string;
  size?: number;
  label?: string;
}) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
