"use client";
import { forwardRef,memo,useEffect,useImperativeHandle,useRef,useState } from "react";
export type FeedbackHandle={show:(message:string)=>void};
export const DiscoverFeedback=memo(forwardRef<FeedbackHandle>(function DiscoverFeedback(_,ref){
  const [message,setMessage]=useState<string|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useImperativeHandle(ref,()=>({show(value){if(timer.current)clearTimeout(timer.current);setMessage(value);timer.current=setTimeout(()=>setMessage(null),2600);}}),[]);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  return message?<div role="status" className="fixed left-1/2 top-20 z-50 max-w-[90vw] -translate-x-1/2 rounded-full border border-[#ffc83d]/30 bg-[#211952] px-4 py-2.5 text-xs font-bold text-[#ffe49a]">{message}</div>:null;
}));

export function PassUndoToast({record,onUndo}:{record:object|null;onUndo:()=>void}){
  const [visible,setVisible]=useState(false);
  useEffect(()=>{setVisible(!!record);if(!record)return;const timer=setTimeout(()=>setVisible(false),4000);return()=>clearTimeout(timer);},[record]);
  return visible&&record?<div role="status" className="fixed left-1/2 top-36 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-[#211952] px-4 py-2 text-xs text-white">Passed · <button type="button" onClick={onUndo} className="min-h-8 font-bold text-[#73f4df]">Undo</button></div>:null;
}
