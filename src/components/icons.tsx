type IconProps = { className?: string };

export function FootballIcon({ className = "size-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="m12 7.5 4.3 3.1-1.6 5h-5.4l-1.6-5L12 7.5Z" fill="currentColor" />
      <path d="M12 7.5V2.6M16.3 10.6l4.5-1.5M14.7 15.6l2.8 3.9M9.3 15.6l-2.8 3.9M7.7 10.6 3.2 9.1" />
    </svg>
  );
}

export function TrophyIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V17h3v3H8v-3h3v-2.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm0 4H6v1a2 2 0 0 0 1.2 1.8A5 5 0 0 1 7 8.5V7Zm10 0v1.5c0 .5 0 .9-.2 1.3A2 2 0 0 0 18 8V7h-1Z" />
    </svg>
  );
}

export function LiveDot({ className = "" }: IconProps) {
  return (
    <span className={`relative inline-flex size-2.5 ${className}`}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-500 opacity-75" />
      <span className="relative inline-flex size-2.5 rounded-full bg-rose-500" />
    </span>
  );
}
