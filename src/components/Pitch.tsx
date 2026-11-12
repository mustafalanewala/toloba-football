/** Pitch markings (boundary, halfway line, centre circle, penalty boxes) over the mown stripes of the parent. */
export function PitchLines({ className = "border-white/85" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 *:absolute *:border-inherit ${className}`}>
      <div className="inset-3 rounded-[2px] border-2 sm:inset-5" />
      <div className="inset-y-3 left-1/2 w-0 -translate-x-1/2 border-l-2 sm:inset-y-5" />
      <div className="top-1/2 left-1/2 aspect-square h-[34%] -translate-1/2 rounded-full border-2" />
      <div className="top-1/2 left-3 h-[48%] w-[13%] -translate-y-1/2 border-2 border-l-0 sm:left-5" />
      <div className="top-1/2 right-3 h-[48%] w-[13%] -translate-y-1/2 border-2 border-r-0 sm:right-5" />
    </div>
  );
}
