import { useId } from "react";
import { cn } from "@/lib/utils";

export type ScoreRingProps = {
  score: number;
  label?: string;
  size?: number | "sm" | "md" | "lg";
  className?: string;
};

const scoreSizes = {
  sm: 56,
  md: 72,
  lg: 96,
} as const;

export function ScoreRing({ score, label = "Garba match", size = "md", className }: ScoreRingProps) {
  const rawScore = Number.isFinite(score) ? score : 0;
  const value = Math.round(Math.min(100, Math.max(0, rawScore)));
  const dimension = typeof size === "number" && Number.isFinite(size) ? Math.max(40, size) : scoreSizes[typeof size === "number" ? "md" : size];
  const strokeWidth = dimension < 64 ? 5 : 6;
  const radius = (dimension - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gradientId = `score-ring-${useId().replace(/:/g, "")}`;
  const ariaLabel = `${value}% ${label}`;

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: dimension, height: dimension }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg viewBox={`0 0 ${dimension} ${dimension}`} className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f35ca8" />
            <stop offset="55%" stopColor="#ff8b4d" />
            <stop offset="100%" stopColor="#ffd166" />
          </linearGradient>
        </defs>
        <circle cx={dimension / 2} cy={dimension / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} />
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (value / 100) * circumference}
          style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
        />
      </svg>
      <span className={cn("display-font absolute inset-0 flex items-center justify-center font-bold text-white", dimension <= 40 ? "text-[10px]" : "text-sm sm:text-base")}>
        {value}%
      </span>
    </div>
  );
}
