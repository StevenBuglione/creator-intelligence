/** Project mark: an open bracket around a single observation point. */
export function Mark({ small = false }: { small?: boolean }) {
  const size = small ? 24 : 32;
  return (
    <svg
      className="mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="7" className="mark-bg" />
      <path
        d="M21 9.5a8.5 8.5 0 1 0 0 13"
        fill="none"
        className="mark-arc"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="22.4" cy="16" r="2.6" className="mark-dot" />
    </svg>
  );
}
