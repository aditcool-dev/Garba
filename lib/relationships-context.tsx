"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./supabase/auth-context";
import { db } from "./supabase/client";
import { clearPairCache, MATCH_INACTIVE, RELATIONSHIPS_CHANGED } from "./relationship-events";
import type { Match } from "./supabase/types";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui";

type State = { matches: Match[]; loading: boolean; revision: number; notice: string | null; error: string | null; refetch: () => Promise<void>; unmatch: (match: Match) => Promise<void>; askUnmatch: (match: Match,name: string) => void };
const Context = createContext<State | null>(null);

export function RelationshipsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection,setSelection]=useState<{match:Match;name:string}|null>(null);
  const [confirmError,setConfirmError]=useState<string|null>(null);
  const [confirmBusy,setConfirmBusy]=useState(false);
  const confirmLock=useRef(false);
  const pending = useRef(new Map<string, Promise<void>>());
  const suppressed = useRef(new Set<string>());
  const request = useRef(0);
  const snapshot = useRef("");
  const refetch = useCallback(async () => {
    const ticket = ++request.current;
    if (!user) { setMatches([]); setLoading(false); return; }
    try {
      const [rows, blocked] = await Promise.all([db.getMatches(user.id), db.getBlockedUserIds(user.id)]);
      if (ticket !== request.current) return;
      const active=rows.filter((match) => match.status === "active" && !pending.current.has(match.id) && !blocked.has(match.user_a === user.id ? match.user_b : match.user_a));
      const signature=`${user.id}:${active.map(match=>`${match.id}:${match.chat_started_at}`).sort().join(",")}`;
      if(snapshot.current!==signature){snapshot.current=signature;setRevision(value=>value+1);}
      setMatches(active);
      setError(null);
    } catch (error) { console.error("[relationships] refresh", error); if (ticket === request.current) setError("Couldn’t update your matches. Please retry."); }
    finally { if (ticket === request.current) setLoading(false); }
  }, [user]);

  useEffect(() => {
    setMatches([]); setLoading(true); suppressed.current.clear();
    void refetch();
    if (!user) return;
    const changed = (match?: Match) => {
      if (match?.status === "unmatched") {
        suppressed.current.add(match.id);
        setMatches((rows) => rows.filter((row) => row.id !== match.id));
        clearPairCache(match.user_a, match.user_b);
        setNotice("This match is no longer active");
        window.dispatchEvent(new CustomEvent(MATCH_INACTIVE,{detail:match.id}));
      } else if (match?.status === "active") suppressed.current.delete(match.id);
      setRevision((value) => value + 1);
      void refetch();
    };
    const local = (event: Event) => changed((event as CustomEvent<Match>).detail);
    window.addEventListener(RELATIONSHIPS_CHANGED, local);
    const unsubscribe = db.subscribeToMatches(user.id, changed);
    const interests = db.subscribeToInterests(user.id, () => changed());
    const focus = () => { void refetch(); setRevision((value) => value + 1); };
    window.addEventListener("focus", focus);
    // A block can hide a row from Realtime's RLS check before its update reaches
    // the other participant. Poll authoritative state while the tab is visible.
    const timer=setInterval(()=>{if(document.visibilityState==="visible")void refetch();},5000);
    return () => { ++request.current; clearInterval(timer); unsubscribe(); interests(); window.removeEventListener("focus", focus); window.removeEventListener(RELATIONSHIPS_CHANGED, local); };
  }, [user, refetch]);

  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 4000); return () => clearTimeout(timer); }, [notice]);

  const unmatch = useCallback((match: Match): Promise<void> => {
    if (!user) return Promise.reject(new Error("Sign in required"));
    const previous = pending.current.get(match.id);
    if (previous) return previous;
    suppressed.current.add(match.id);
    setMatches((rows) => rows.filter((row) => row.id !== match.id));
    const operation = (async () => {
      try { await db.unmatchMatch(user.id, match); setRevision((value) => value + 1); await refetch(); }
      catch (error) { suppressed.current.delete(match.id); setMatches((rows) => rows.some((row) => row.id === match.id) ? rows : [...rows, match]); throw error; }
      finally { pending.current.delete(match.id); }
    })();
    pending.current.set(match.id, operation);
    return operation;
  }, [user, refetch]);

  const askUnmatch=useCallback((match:Match,name:string)=>{setSelection({match,name});setConfirmError(null);},[]);
  const confirm=async()=>{if(!selection||confirmLock.current)return;confirmLock.current=true;setConfirmBusy(true);try{await unmatch(selection.match);setSelection(null);}catch{setConfirmError("Couldn’t unmatch. Please try again.");}finally{confirmLock.current=false;setConfirmBusy(false);}};
  const value = useMemo(() => ({ matches, loading, revision, notice, error, refetch, unmatch,askUnmatch }), [matches, loading, revision, notice, error, refetch, unmatch,askUnmatch]);
  return <Context.Provider value={value}>{children}{notice && <div role="status" className="fixed left-1/2 top-20 z-[80] max-w-[90vw] -translate-x-1/2 rounded-2xl bg-[#211952] px-4 py-3 text-sm text-white">{notice}</div>}
    <BottomSheet open={!!selection} onClose={()=>{if(!confirmBusy)setSelection(null);}} title={`Unmatch ${selection?.name || "this dancer"}?`} description="Your chat will be removed for both of you. You can find each other in Discover again.">
      {confirmError&&<p role="alert" className="mb-3 text-sm text-rose-200">{confirmError}</p>}
      <div className="flex gap-3"><Button variant="secondary" disabled={confirmBusy} className="flex-1 border-rose-400/40 bg-rose-700 text-white hover:bg-rose-600" onClick={()=>void confirm()}>{confirmBusy?"Unmatching…":"Unmatch"}</Button><Button disabled={confirmBusy} variant="secondary" className="flex-1" onClick={()=>setSelection(null)}>Cancel</Button></div>
    </BottomSheet>
  </Context.Provider>;
}

export function useRelationships() { const context = useContext(Context); if (!context) throw new Error("RelationshipsProvider required"); return context; }
