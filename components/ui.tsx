"use client";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "touch-target inline-flex items-center justify-center gap-2 rounded-full border border-transparent px-5 py-3 text-sm font-bold tracking-[-0.01em] transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd166] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0820] disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "signature-gradient text-white shadow-[0_10px_26px_rgba(232,69,155,0.2)] hover:shadow-[0_14px_32px_rgba(255,122,69,0.28)]",
        variant === "secondary" && "border-white/12 bg-[#150f3a]/90 text-white shadow-[0_8px_22px_rgba(0,0,0,0.16)] hover:border-[#ffd166]/35 hover:bg-[#211952]",
        variant === "ghost" && "text-[#ffd166] hover:bg-white/10 hover:text-white",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("garba-card p-5", className)} {...props} />;
}

export function Badge({ children, className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border border-white/10 bg-[#211952] px-3 py-1 text-xs font-semibold text-[#e5e5ff]",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function VerifiedBadge({ children = "BMSCE verified", className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold text-[#73f4df]", className)} {...props}>
      <span className="verified-mark" aria-hidden="true">✓</span>
      {children}
    </span>
  );
}

export { AvatarFallback } from "./avatar-fallback";
export { BottomSheet } from "./bottom-sheet";
export { NightStrip } from "./night-strip";
export { ProfileCard, ProfileCardActions, ProfileCardBody, ProfileCardHeader } from "./profile-card";
export { ScoreRing } from "./score-ring";
