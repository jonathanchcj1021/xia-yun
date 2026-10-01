export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect
        x="4"
        y="7"
        width="24"
        height="18"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M4 13h24" stroke="currentColor" strokeWidth="2" />
      <path d="M10 7v6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
