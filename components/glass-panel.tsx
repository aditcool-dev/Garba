"use client";

import { cn } from "@/lib/utils";
import { useEffect } from "react";

export function GlassPanel({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    if ((nav.deviceMemory !== undefined && nav.deviceMemory <= 4) || (navigator.hardwareConcurrency || 8) <= 4) document.documentElement.dataset.lowEnd = "true";
    return () => { delete document.documentElement.dataset.lowEnd; };
  }, []);
  return <div className={cn("glass-panel relative overflow-hidden", className)} {...props}>{children}</div>;
}
