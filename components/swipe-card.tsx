"use client";

import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { animate, motion, useDragControls, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue, type PanInfo } from "framer-motion";
import { DiscoverProfileCard, type DiscoverProfileCardProps } from "./discover-profile-card";

export type SwipeDecision = "like" | "pass" | "vibe";
export type SwipeHandle = { flyOff: (direction: SwipeDecision) => void; isBusy: () => boolean };
export const SWIPE_POWER = 120;
export const LOOKAHEAD = 0.2;

export function decideSwipe(offsetX: number, velocityX: number, offsetY = 0, velocityY = 0): SwipeDecision | null {
  const horizontal = offsetX + velocityX * LOOKAHEAD;
  const vertical = offsetY + velocityY * LOOKAHEAD;
  if (vertical < -SWIPE_POWER && Math.abs(vertical) > Math.abs(horizontal)) return "vibe";
  if (horizontal > SWIPE_POWER) return "like";
  if (horizontal < -SWIPE_POWER) return "pass";
  return null;
}

export function swipeHaptic() {
  if (typeof navigator.vibrate === "function") navigator.vibrate(10);
}

type Props = DiscoverProfileCardProps & {
  depth: number;
  progress: MotionValue<number>;
  returning?: boolean;
  canDecide: (direction: SwipeDecision, person: DiscoverProfileCardProps["person"]) => boolean;
  onDecide: (direction: SwipeDecision, person: DiscoverProfileCardProps["person"]) => void;
};

export const SwipeCard = memo(forwardRef<SwipeHandle, Props>(function SwipeCard({ depth, progress, returning, canDecide, onDecide, ...card }, ref) {
  const reduced = useReducedMotion();
  const dragControls = useDragControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const opacity = useMotionValue(1);
  const burst = useMotionValue(0);
  const rotate = useTransform(x, [-260, 0, 260], [-12, 0, 12]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const passOpacity = useTransform(x, [-120, -20], [1, 0]);
  const vibeOpacity = useTransform(y, [-120, -20], [1, 0]);
  const scale = useTransform(progress, [0, 1], [1 - depth * .06, 1 - Math.max(0, depth - 1) * .06]);
  const stackY = useTransform(progress, [0, 1], [depth * 10, Math.max(0, depth - 1) * 10]);
  const burstScale = useTransform(burst, [0, 1], [.85, 1.25]);
  const burstOpacity = useTransform(burst, [0, .25, 1], [0, 1, 0]);
  const busy = useRef(false);
  const dragged = useRef(false);
  const crossed = useRef(false);
  const controls = useRef<Array<{ stop: () => void }>>([]);
  const touch = useRef<{ x: number; y: number; time: number; scroll: number } | null>(null);
  const top = depth === 0;

  const updateProgress = () => {
    if (!top) return;
    const distance = Math.max(Math.abs(x.get()), Math.max(0, -y.get()));
    progress.set(Math.min(1, distance / SWIPE_POWER));
    if (distance >= SWIPE_POWER && !crossed.current && !busy.current) swipeHaptic();
    crossed.current = distance >= SWIPE_POWER;
  };
  useMotionValueEvent(x, "change", updateProgress);
  useMotionValueEvent(y, "change", updateProgress);

  const springBack = useCallback(() => {
    controls.current.push(animate(x, 0, { type: "spring", stiffness: 420, damping: 32 }), animate(y, 0, { type: "spring", stiffness: 420, damping: 32 }));
  }, [x, y]);

  const flyOff = useCallback((direction: SwipeDecision) => {
    if (!top || busy.current) return;
    if (!canDecide(direction, card.person)) { springBack(); return; }
    controls.current.forEach((control) => control.stop());
    controls.current = [];
    busy.current = true;
    dragged.current = true;
    const complete = () => onDecide(direction, card.person);
    if (reduced) {
      controls.current.push(animate(opacity, 0, { duration: .12, onComplete: complete }));
      return;
    }
    const launch = () => {
      const axis = direction === "vibe" ? y : x;
      const target = direction === "vibe" ? -(window.innerHeight + 200) : (direction === "like" ? 1 : -1) * (window.innerWidth + 200);
      controls.current.push(animate(axis, target, { duration: .22, ease: "easeIn", onComplete: complete }));
    };
    if (direction === "vibe") controls.current.push(animate(burst, 1, { duration: .16, onComplete: launch }));
    else launch();
  }, [top, canDecide, card.person, springBack, onDecide, reduced, opacity, x, y, burst]);

  useImperativeHandle(ref, () => ({ flyOff, isBusy: () => busy.current }), [flyOff]);

  useLayoutEffect(() => {
    if (!top) return;
    progress.set(0);
    if (returning) {
      if (!reduced) x.set(-(window.innerWidth + 200));
      else opacity.set(0);
      busy.current = true;
      const control = reduced ? animate(opacity, 1, { duration: .12, onComplete: () => { busy.current = false; } }) : animate(x, 0, { duration: .26, ease: "easeOut", onComplete: () => { busy.current = false; } });
      controls.current.push(control);
    }
  }, [top, returning, reduced, progress, x, opacity]);

  useEffect(() => () => { controls.current.forEach((control) => control.stop()); }, []);

  const release = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (busy.current) return;
    const direction = decideSwipe(info.offset.x, info.velocity.x, info.offset.y, info.velocity.y);
    if (direction) flyOff(direction);
    else springBack();
  };

  return (
    <motion.div
      data-swipe-card={card.person.id}
      data-top-card={top ? "true" : "false"}
      aria-hidden={!top}
      inert={!top}
      className="swipe-card absolute inset-0 origin-center cursor-grab active:cursor-grabbing"
      style={{ x: top ? x : 0, y: top ? y : stackY, rotate: top && !reduced ? rotate : 0, scale, opacity, zIndex: 3 - depth, touchAction: "pan-y", willChange: top ? "transform" : undefined, pointerEvents: top ? "auto" : "none" }}
      drag={top}
      dragControls={dragControls}
      dragListener={false}
      dragDirectionLock
      dragMomentum={false}
      dragElastic={.9}
      onDragStart={() => { dragged.current = true; controls.current.forEach((control) => control.stop()); controls.current = []; }}
      onDragEnd={release}
      onPointerDown={(event) => { if (top && !busy.current) { dragged.current = false; dragControls.start(event); } }}
      onClickCapture={(event) => { if (dragged.current || busy.current) { event.stopPropagation(); event.preventDefault(); } }}
      onTouchStart={(event) => { const point = event.touches[0]; touch.current = { x: point.clientX, y: point.clientY, time: performance.now(), scroll: window.scrollY }; }}
      onTouchEnd={(event) => {
        const start = touch.current;
        touch.current = null;
        if (!start || dragged.current || window.scrollY !== start.scroll) return;
        const point = event.changedTouches[0];
        const dx = point.clientX - start.x;
        const dy = point.clientY - start.y;
        const elapsed = Math.max(.05, (performance.now() - start.time) / 1000);
        // Native pan-y owns vertical scrolling. A flick at the scroll boundary can still Vibe.
        if (dy < -40 && elapsed < .5 && decideSwipe(dx, dx / elapsed, dy, dy / elapsed) === "vibe") flyOff("vibe");
      }}
    >
      <DiscoverProfileCard {...card} priority={top} className="h-full" />
      {top && !reduced && <>
        <motion.div aria-hidden="true" style={{ opacity: likeOpacity }} className="pointer-events-none absolute inset-0 rounded-[28px] shadow-[inset_0_0_35px_rgba(45,226,196,.5)]" />
        <motion.div aria-hidden="true" style={{ opacity: passOpacity }} className="pointer-events-none absolute inset-0 rounded-[28px] shadow-[inset_0_0_35px_rgba(180,110,130,.45)]" />
        <motion.div style={{ opacity: likeOpacity }} className="pointer-events-none absolute left-5 top-24 -rotate-12 rounded-xl border-2 border-[#2de2c4] bg-[#071c22]/90 px-3 py-1 text-xl font-black text-[#73f4df]">LIKE</motion.div>
        <motion.div style={{ opacity: passOpacity }} className="pointer-events-none absolute right-5 top-24 rotate-12 rounded-xl border-2 border-[#b46e82] bg-[#221820]/90 px-3 py-1 text-xl font-black text-[#dbafbd]">PASS</motion.div>
        <motion.div style={{ opacity: vibeOpacity }} className="pointer-events-none absolute inset-x-0 top-24 text-center text-3xl">⭐</motion.div>
        <motion.div aria-hidden="true" style={{ opacity: burstOpacity, scale: burstScale }} className="pointer-events-none absolute inset-0 flex items-center justify-center gap-8 rounded-[28px] border-2 border-[#ffc83d] text-5xl text-[#ffc83d]"><span>✦</span><span>⭐</span><span>✦</span></motion.div>
      </>}
      {top && <div aria-label="Drag up for Garba Vibe" title="Drag up for Garba Vibe" style={{ touchAction: "none" }} className="absolute inset-x-[35%] top-2 flex h-10 cursor-ns-resize items-start justify-center pt-1"><span className="h-1 w-10 rounded-full bg-white/40" /></div>}
    </motion.div>
  );
}));
