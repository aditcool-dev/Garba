import { FESTIVAL_DAYS } from "@/config/festival";
import { cn } from "@/lib/utils";

type NightValue = string | number;

export type NightStripProps = {
  /** Nights marked as available/selected. Values may be `1` or `Day 1`. */
  nights?: readonly NightValue[];
  /** Nights with an overlap or other secondary highlight. */
  highlightedNights?: readonly NightValue[];
  activeNight?: NightValue | null;
  options?: readonly NightValue[];
  label?: string;
  showLabel?: boolean;
  compact?: boolean;
  onNightClick?: (night: string) => void;
  className?: string;
};

function normaliseNight(value: NightValue): string {
  return String(value).toLowerCase().replace(/^day\s*/, "").trim();
}

function nightLabel(value: NightValue): string {
  const normalised = normaliseNight(value);
  return `D${normalised}`;
}

export function NightStrip({
  nights = [],
  highlightedNights = [],
  activeNight,
  options = FESTIVAL_DAYS,
  label = "Festival nights",
  showLabel = true,
  compact = false,
  onNightClick,
  className,
}: NightStripProps) {
  const selected = new Set(nights.map(normaliseNight));
  const highlighted = new Set(highlightedNights.map(normaliseNight));
  const active = activeNight === null || activeNight === undefined ? null : normaliseNight(activeNight);

  return (
    <div className={cn("min-w-0", className)}>
      {showLabel && <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">{label}</p>}
      <div className="grid min-w-0 grid-cols-9 gap-1" role={onNightClick ? undefined : "list"}>
        {options.map((night) => {
          const value = String(night);
          const key = normaliseNight(night);
          const isSelected = selected.has(key);
          const isHighlighted = highlighted.has(key);
          const isActive = active === key;
          const itemClass = cn(
            "inline-flex min-h-9 min-w-0 flex-col items-center justify-center rounded-lg border px-0 text-[10px] font-bold transition",
            isSelected
              ? "border-[#ff8b4d]/60 bg-[#ff8b4d]/15 text-[#ffdca0]"
              : "border-white/10 bg-white/[0.045] text-[#aaa8d0]",
            isHighlighted && "ring-1 ring-[#2dd4bf]/70 ring-offset-1 ring-offset-[#0a0820]",
            isActive && "border-[#ffd166] bg-[#ffd166]/15 text-[#ffd166]",
            compact && "min-h-8 text-[9px]",
            onNightClick && "hover:-translate-y-0.5 hover:border-[#ffd166]/60",
          );
          const content = (
            <>
              <span>{nightLabel(night)}</span>
              {isSelected && <span className="mt-0.5 text-[9px] text-[#ffb66e]" aria-hidden="true">●</span>}
            </>
          );

          return onNightClick ? (
            <button
              key={value}
              type="button"
              className={itemClass}
              aria-label={`${value}${isSelected ? ", available" : ""}`}
              aria-pressed={isSelected}
              onClick={() => onNightClick(value)}
            >
              {content}
            </button>
          ) : (
            <span key={value} className={itemClass} role="listitem" aria-label={`${value}${isSelected ? ", available" : ""}`}>
              {content}
            </span>
          );
        })}
      </div>
    </div>
  );
}
