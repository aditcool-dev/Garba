"use client";

import { useEffect, useRef } from "react";

/** Explicit diagnostics opt-in, including production so measurements match a phone build. */
export function FpsMeter() {
  const label = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("debug") !== "fps") return;
    let raf = 0, previous = performance.now(), start = previous, frames = 0, dropped = 0;
    const samples: number[] = [];
    const tick = (now: number) => {
      const delta = now - previous;
      previous = now;
      if (document.visibilityState === "visible") {
        frames++;
        dropped += Math.max(0, Math.round(delta / (1000 / 60)) - 1);
        if (document.documentElement.dataset.dragging === "true") samples.push(delta);
      }
      if (now - start >= 500) {
        const fps = Math.round(frames * 1000 / (now - start));
        if (label.current) {
          label.current.hidden = false;
          label.current.textContent = `${fps} fps · ${dropped} dropped`;
          label.current.dataset.fps = String(fps);
          label.current.dataset.dragFps = samples.length ? String(Math.round(1000 * samples.length / samples.reduce((a, b) => a + b, 0))) : "";
          label.current.dataset.dropped = String(dropped);
        }
        frames = 0; start = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <output ref={label} hidden data-fps-meter className="pointer-events-none fixed right-2 top-2 z-[100] rounded bg-black px-2 py-1 font-mono text-[10px] text-white" aria-label="Frame rate diagnostics" />;
}
