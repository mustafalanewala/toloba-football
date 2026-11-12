import { Logo } from "./Logo";

export function SiteHeader({
  title,
  compact,
  wide,
  children,
}: {
  title: string;
  compact?: boolean;
  wide?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className="bg-toloba text-white">
      <div className={`mx-auto flex w-full items-center ${wide ? "max-w-[1440px] lg:px-8" : "max-w-6xl"} justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4`}>
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Logo className="size-12 sm:size-16" />
          <div className="min-w-0">
            <h1 className="line-clamp-2 text-balance font-display text-2xl leading-tight font-semibold sm:text-4xl">
              {title}
            </h1>
            <p className={`mt-1 truncate text-sm text-white/75 ${compact ? "hidden sm:block" : ""}`}>Toloba ul Kulliyaat il Mumenoon, Dohad</p>
          </div>
        </div>
        {children}
      </div>
    </header>
  );
}
