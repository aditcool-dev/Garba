"use client";

import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { animate, motion, useReducedMotion, useTransform, type MotionValue } from "framer-motion";
import { DiscoverProfileCard, type DiscoverProfileCardProps } from "./discover-profile-card";
import { cn } from "@/lib/utils";

export type SwipeDecision = "like" | "pass" | "vibe";
export type SwipeHandle = { flyOff: (direction: SwipeDecision) => void; isBusy: () => boolean };
export const SWIPE_POWER = 120;
export const LOOKAHEAD = .2;
export function decideSwipe(x: number, vx: number, y = 0, vy = 0): SwipeDecision | null {
  const horizontal = x + vx * LOOKAHEAD, vertical = y + vy * LOOKAHEAD;
  if (vertical < -SWIPE_POWER && Math.abs(vertical) > Math.abs(horizontal)) return "vibe";
  if (horizontal > SWIPE_POWER) return "like";
  if (horizontal < -SWIPE_POWER) return "pass";
  return null;
}
export function swipeHaptic() { if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(10); }

type Props = DiscoverProfileCardProps & {
  depth: number; progress: MotionValue<number>; returning?: boolean; disabled?: boolean;
  canDecide: (direction: SwipeDecision, person: DiscoverProfileCardProps["person"]) => boolean;
  onDecide: (direction: SwipeDecision, person: DiscoverProfileCardProps["person"]) => void;
};

export const SwipeCard = memo(forwardRef<SwipeHandle, Props>(function SwipeCard({ depth, progress, returning, disabled, canDecide, onDecide, ...card }, ref) {
  const reduced = useReducedMotion();
  const element = useRef<HTMLDivElement>(null);
  const like = useRef<HTMLDivElement>(null), pass = useRef<HTMLDivElement>(null), vibe = useRef<HTMLDivElement>(null);
  const busy = useRef(false), moved = useRef(false), threshold = useRef(false), frame = useRef(0);
  const current = useRef({ x: 0, y: 0 });
  const animation = useRef<Animation | null>(null);
  const gesture = useRef<{ id: number; x: number; y: number; lastX: number; lastY: number; time: number; vx: number; vy: number; axis: "x" | "y" | null; vertical: boolean } | null>(null);
  const top = depth === 0;
  const scale = useTransform(progress, [0,1], [1-depth*.06,1-Math.max(0,depth-1)*.06]);
  const stackY = useTransform(progress, [0,1], [depth*10,Math.max(0,depth-1)*10]);
  const transform = useCallback((x: number, y: number) => `translate3d(${x}px, ${y}px, 0) rotate(${reduced ? 0 : Math.max(-12,Math.min(12,x/260*12))}deg)`, [reduced]);
  const markDragging = (active: boolean) => {
    document.documentElement.dataset.dragging = String(active);
    if (!active) window.dispatchEvent(new Event("garbamate:swipe-settled"));
  };
  const paint = useCallback(() => {
    frame.current=0;
    const {x,y}=current.current;
    if (element.current) element.current.style.transform=transform(x,y);
    progress.set(Math.min(1,Math.max(Math.abs(x),Math.max(0,-y))/SWIPE_POWER));
    if (!reduced) {
      if(like.current) like.current.style.opacity=String(Math.max(0,Math.min(1,(x-20)/100)));
      if(pass.current) pass.current.style.opacity=String(Math.max(0,Math.min(1,(-x-20)/100)));
      if(vibe.current) vibe.current.style.opacity=String(Math.max(0,Math.min(1,(-y-20)/100)));
    }
    const crossed=Math.max(Math.abs(x),-y)>=SWIPE_POWER;
    if(crossed&&!threshold.current) swipeHaptic();
    threshold.current=crossed;
  }, [progress,reduced,transform]);

  const run = useCallback((targetX: number,targetY: number,fade: boolean,duration: number,complete: () => void) => {
    const node=element.current;
    if(!node) return;
    cancelAnimationFrame(frame.current); frame.current=0;
    animation.current?.cancel();
    const start=transform(current.current.x,current.current.y), end=transform(targetX,targetY);
    const flight=node.animate(fade ? [{opacity:1},{opacity:0}] : [{transform:start},{transform:end}], {duration,easing:duration===220?"cubic-bezier(.42,0,1,1)":"cubic-bezier(.16,1,.3,1)",fill:"forwards"});
    animation.current=flight;
    flight.onfinish=()=>{ node.style.transform=end; node.style.opacity=fade?"0":"1"; current.current={x:targetX,y:targetY}; flight.cancel(); animation.current=null; complete(); };
  },[transform]);
  const springBack=useCallback(()=>{
    busy.current=true;
    run(0,0,false,reduced?100:260,()=>{busy.current=false;progress.set(0); if(like.current)like.current.style.opacity="0";if(pass.current)pass.current.style.opacity="0";if(vibe.current)vibe.current.style.opacity="0";markDragging(false);});
    void animate(progress,0,{duration:.26});
  },[run,progress,reduced]);
  const flyOff=useCallback((direction: SwipeDecision)=>{
    if(!top||disabled||busy.current) return;
    if(!canDecide(direction,card.person)){springBack();return;}
    busy.current=true;moved.current=true;
    gesture.current=null;
    if(frame.current) paint();
    markDragging(true);
    const finish=()=>{markDragging(false);onDecide(direction,card.person);};
    const launch=()=>{
      const tx=direction==="vibe"?current.current.x:(direction==="like"?1:-1)*(window.innerWidth+200);
      const ty=direction==="vibe"?-(window.innerHeight+200):current.current.y;
      void animate(progress,1,{duration:.22});
      run(tx,ty,!!reduced,reduced?120:220,finish);
    };
    if(direction==="vibe"&&!reduced&&vibe.current){
      vibe.current.style.opacity="1";
      const burst=vibe.current.animate([{opacity:1,transform:"scale(.9)"},{opacity:0,transform:"scale(1.15)"}],{duration:140});
      burst.onfinish=launch;
    }else launch();
  },[top,disabled,canDecide,card.person,onDecide,paint,progress,run,reduced,springBack]);
  useImperativeHandle(ref,()=>({flyOff,isBusy:()=>busy.current||!!gesture.current}),[flyOff]);
  useLayoutEffect(()=>{
    if(!top)return;
    progress.set(0);busy.current=false;
    if(returning){busy.current=true;current.current={x:reduced?0:-(window.innerWidth+200),y:0};if(element.current)element.current.style.transform=transform(current.current.x,0);run(0,0,false,260,()=>{busy.current=false;progress.set(0);});}
  },[top,returning,progress,reduced,transform,run]);
  useEffect(()=>()=>{cancelAnimationFrame(frame.current);animation.current?.cancel();if(top)markDragging(false);},[top]);

  const endGesture=(event: React.PointerEvent<HTMLDivElement>,cancel=false)=>{
    const g=gesture.current;if(!g||event.pointerId!==g.id)return;
    gesture.current=null;
    if(element.current?.hasPointerCapture(g.id))element.current.releasePointerCapture(g.id);
    if(frame.current){cancelAnimationFrame(frame.current);paint();}
    if(cancel){springBack();return;}
    const stale=performance.now()-g.time>100;
    const decision=decideSwipe(current.current.x,stale?0:g.vx,current.current.y,stale?0:g.vy);
    if(decision)flyOff(decision);else springBack();
  };
  return <motion.div className="absolute inset-0" style={{zIndex:3-depth,scale:top?1:scale,y:top?0:stackY,pointerEvents:top?"auto":"none"}} aria-hidden={!top} inert={!top}>
    <div ref={element} data-swipe-card={card.person.id} data-top-card={top?"true":"false"} className="swipe-card absolute inset-0 rounded-[28px]" style={{transform:"translate3d(0,0,0)",willChange:top?"transform":undefined,touchAction:"pan-y"}}
      onPointerDown={(event)=>{
        if(!top||disabled||busy.current||event.button!==0)return;
        animation.current?.cancel();moved.current=false;threshold.current=false;
        const vertical=event.target instanceof HTMLElement&&!!event.target.closest("[data-vibe-grip]");
        gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,time:performance.now(),vx:0,vy:0,axis:null,vertical};
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event)=>{
        const g=gesture.current;if(!g||event.pointerId!==g.id)return;
        const dx=event.clientX-g.x,dy=event.clientY-g.y;
        if(!g.axis&&Math.max(Math.abs(dx),Math.abs(dy))>6){
          if(Math.abs(dy)>Math.abs(dx)&&event.pointerType==="touch"&&!g.vertical){gesture.current=null;return;}
          g.axis=Math.abs(dx)>=Math.abs(dy)?"x":"y";moved.current=true;markDragging(true);
        }
        if(!g.axis)return;
        const now=performance.now(),dt=Math.max(8,now-g.time)/1000;
        g.vx=(event.clientX-g.lastX)/dt;g.vy=(event.clientY-g.lastY)/dt;g.lastX=event.clientX;g.lastY=event.clientY;g.time=now;
        current.current={x:g.axis==="x"?dx:0,y:g.axis==="y"?dy:0};
        if(!frame.current)frame.current=requestAnimationFrame(paint);
      }} onPointerUp={(event)=>endGesture(event)} onPointerCancel={(event)=>endGesture(event,true)}
      onClickCapture={(event)=>{if(moved.current||busy.current){event.preventDefault();event.stopPropagation();}}}>
      <DiscoverProfileCard {...card} priority={top} className={cn("h-full",card.className)} />
      {top&&!reduced&&<>
        <div ref={like} style={{opacity:0}} className="swipe-edge pointer-events-none absolute inset-0 rounded-[28px] border-[#2de2c4]"><span className="absolute left-4 top-24 -rotate-12 rounded-lg border-2 border-[#2de2c4] bg-[#071c22] px-3 py-1 text-xl font-black text-[#73f4df]">LIKE</span></div>
        <div ref={pass} style={{opacity:0}} className="swipe-edge pointer-events-none absolute inset-0 rounded-[28px] border-[#b46e82]"><span className="absolute right-4 top-24 rotate-12 rounded-lg border-2 border-[#b46e82] bg-[#221820] px-3 py-1 text-xl font-black text-[#dbafbd]">PASS</span></div>
        <div ref={vibe} style={{opacity:0}} className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[28px] border-2 border-[#ffc83d] text-4xl text-[#ffc83d]">✦ ⭐ ✦</div>
      </>}
      {top&&<div data-vibe-grip aria-label="Drag up for Garba Vibe" style={{touchAction:"none"}} className="absolute inset-x-[35%] top-2 flex h-10 justify-center pt-1"><span className="h-1 w-10 rounded-full bg-white/40" /></div>}
    </div>
  </motion.div>;
}));
