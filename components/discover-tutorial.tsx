"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion } from "framer-motion";
import { BottomSheet } from "./bottom-sheet";
import { DiscoverProfileCard } from "./discover-profile-card";
import { SwipeCard, type SwipeHandle, type SwipeDecision } from "./swipe-card";
import { Button, NightStrip, ScoreRing } from "./ui";
import { TUTORIAL_COPY as copy, TUTORIAL_PROFILE } from "@/config/discover-tutorial";

export type TutorialCloseReason = "finish" | "skip" | "error";
type Props = { onClose: (reason: TutorialCloseReason) => void };
const DEMO_NIGHTS = [1,2,4,7,9];
const allowPractice = () => true;

class TutorialBoundary extends Component<Props & { children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onClose("error"); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function DiscoverTutorial(props: Props) { return <TutorialBoundary {...props}><Tutorial {...props} /></TutorialBoundary>; }

function Tutorial({ onClose }: Props) {
  const [step,setStep]=useState(0),[practice,setPractice]=useState(false),[reset,setReset]=useState(0),[details,setDetails]=useState(false);
  const reduced=useReducedMotion();
  const handle=useRef<SwipeHandle>(null),closing=useRef(false);
  const progress=useMotionValue(0);
  const person=useMemo(()=>({...TUTORIAL_PROFILE,id:`tutorial-demo-${reset}`}),[reset]);
  const finish=useCallback((reason: TutorialCloseReason)=>{if(closing.current)return;closing.current=true;onClose(reason);},[onClose]);
  const go=useCallback((value:number)=>{setStep(Math.max(0,Math.min(8,value)));setPractice(false);setDetails(false);setReset((value)=>value+1);},[]);
  const next=useCallback(()=>{if(step===8)finish("finish");else go(step+1);},[step,finish,go]);
  const completePractice=useCallback(()=>{setReset((value)=>value+1);progress.set(0);},[progress]);
  useEffect(()=>{
    document.documentElement.dataset.tutorial="true";
    return ()=>{delete document.documentElement.dataset.tutorial;};
  },[]);
  useEffect(()=>{
    const keys=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();event.stopImmediatePropagation();finish("skip");}
      if(event.key==="Enter"&&event.target instanceof HTMLButtonElement)return;
      if(event.key==="ArrowRight"||event.key==="Enter"){event.preventDefault();event.stopImmediatePropagation();next();}
      if(event.key==="ArrowLeft"){event.preventDefault();event.stopImmediatePropagation();go(step-1);}
      if(event.key==="ArrowUp"&&practice){event.preventDefault();handle.current?.flyOff("vibe");}
    };
    document.addEventListener("keydown",keys,true);
    return ()=>document.removeEventListener("keydown",keys,true);
  },[finish,next,go,step,practice]);
  const swipeStart=useRef<number|null>(null);
  const direction: SwipeDecision=step===2?"pass":step===3?"vibe":"like";
  return <BottomSheet open stickyHeader onClose={()=>finish("skip")} closeLabel={copy.skip} title={copy.stepsContent[step].title} description={copy.stepsContent[step].text} className="max-w-[480px]" >
    <div data-tutorial-step={step+1} style={{touchAction:"pan-y"}} onPointerDown={(event)=>{swipeStart.current=null;if(!(event.target instanceof HTMLElement)||event.target.closest("[data-swipe-card],button"))return;swipeStart.current=event.clientX;}} onPointerCancel={()=>{swipeStart.current=null;}} onPointerUp={(event)=>{if(swipeStart.current===null)return;const dx=event.clientX-swipeStart.current;swipeStart.current=null;if(dx<-60)next();if(dx>60)go(step-1);}}>
      <p className="mb-3 text-center text-[11px] font-bold text-[#ffd166]">{copy.demo} · {copy.progress(step+1)}</p>
      {step>=1&&step<=4 ? <>
        <div className="relative mx-auto h-[min(48dvh,360px)] min-h-[310px] w-full max-w-[300px]">
          {practice&&step<=3 ? <SwipeCard key={person.id} ref={handle} depth={0} progress={progress} person={person} className="tutorial-profile" myNights={DEMO_NIGHTS} score={72} canDecide={allowPractice} onDecide={completePractice} /> : <motion.div className="absolute inset-0" animate={reduced?{opacity:1}:step===1?{x:[0,45,0],rotate:[0,5,0]}:step===2?{x:[0,-45,0],rotate:[0,-5,0]}:step===3?{y:[0,-35,0]}:{scale:details?1.02:1}} transition={{duration:2,repeat:step<=3&&!reduced?Infinity:0}}>
            <DiscoverProfileCard person={person} score={72} myNights={DEMO_NIGHTS} className="h-full tutorial-profile" onOpenDetails={()=>setDetails((value)=>!value)} />
            {step<=3&&<div className={`pointer-events-none absolute left-5 top-24 rounded-lg border-2 bg-[#16123a] px-3 py-2 font-bold ${step===2?"border-rose-300 text-rose-200":"border-teal-300 text-teal-200"}`}>{step===1?"LIKE":step===2?"PASS":"✦ ⭐ ✦"} <span aria-hidden="true">☝</span></div>}
            {step===4&&details&&<div className="absolute inset-x-2 bottom-2 rounded-xl bg-[#211952] p-4 text-sm text-white">{copy.details}<p className="mt-2 text-xs">{person.bio}</p></div>}
          </motion.div>}
        </div>
        {step<=3&&<div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Button variant="secondary" className="min-h-10 px-4 text-xs" onClick={()=>setPractice(true)}>{copy.try}</Button>
          {practice&&<><button type="button" aria-label={copy.pass} className="touch-target rounded-full bg-[#211952] px-4" onClick={()=>handle.current?.flyOff("pass")}>✕</button><button type="button" aria-label={copy.vibe} className="touch-target rounded-full bg-[#211952] px-4" onClick={()=>handle.current?.flyOff("vibe")}>⭐</button><button type="button" aria-label={copy.like} className="touch-target rounded-full bg-[#211952] px-4" onClick={()=>handle.current?.flyOff("like")}>♥</button></>}
          <span className="hidden text-[11px] text-white/80 md:block">{copy.shortcuts}</span>
        </div>}
      </> : step===5 ? <div className="rounded-2xl bg-[#211952] p-6"><div className="flex justify-center"><ScoreRing score={72} size="lg" /></div><NightStrip nights={DEMO_NIGHTS} highlightedNights={DEMO_NIGHTS} className="mt-5" /></div> : step===6 ? <motion.div className="rounded-2xl bg-[#211952] py-12 text-center" animate={!reduced?{scale:[.98,1,.98]}:{}} transition={{duration:2,repeat:Infinity}}><div className="flex justify-center gap-8 text-5xl"><span>♥</span><span>♥</span></div><p className="mt-4 text-xl font-bold text-[#ffd166]">{copy.match}</p><p className="mt-2 text-sm">{copy.hello}</p></motion.div> : step===7 ? <div className="rounded-2xl border border-white/15 bg-[#211952] p-5">{copy.menu.map((label)=><p key={label} className="py-3 text-sm text-white">{label}</p>)}</div> : <div className="rounded-2xl bg-[#211952] px-5 py-12 text-center"><div className="text-5xl">{step===8?"🛡️":"🪩"}</div><p className="mt-5 text-sm font-semibold text-white">{step===8?copy.safety:copy.stepsContent[0].title}</p></div>}
      <div aria-label={copy.steps} className="my-4 flex justify-center">{copy.stepsContent.map((_,index)=><button key={index} type="button" aria-label={copy.goTo(index+1)} aria-current={index===step?"step":undefined} onClick={()=>go(index)} className="flex h-9 w-7 items-center justify-center"><span className={`h-2.5 w-2.5 rounded-full ${index===step?"bg-[#ffd166]":"bg-white/30"}`} /></button>)}</div>
      <div className="flex gap-3"><Button variant="secondary" className="flex-1" disabled={step===0} onClick={()=>go(step-1)}>{copy.back}</Button><Button variant="secondary" className="flex-1 bg-[#ffd166] text-[#100a2c] hover:bg-[#ffe49a]" onClick={next}>{step===8?copy.start:copy.next}</Button></div>
      <p className="mt-3 text-center text-[11px] text-white/80">{practice?copy.practice:copy.instructions}</p>
    </div>
  </BottomSheet>;
}
