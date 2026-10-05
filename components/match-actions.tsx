"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "./bottom-sheet";
import { Button } from "./ui";
import { useRelationships } from "@/lib/relationships-context";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";
import type { Match } from "@/lib/supabase/types";

export function MatchActions({ match, name, profileId, visible = false }: { match?: Match; name: string; profileId: string; visible?: boolean }) {
  const { unmatch, askUnmatch } = useRelationships();
  const { user } = useAuth();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  return <>
    <div className="relative flex items-center gap-2">
      {visible && match && <button type="button" className="min-h-10 rounded-full border border-white/15 px-3 text-xs text-rose-200" onClick={() => askUnmatch(match,name)}>Unmatch</button>}
      <button type="button" aria-label={`Actions for ${name}`} aria-expanded={menu} className="touch-target rounded-full border border-white/15 px-3 text-lg" onClick={() => setMenu((value) => !value)}>⋯</button>
      {menu && <div className="absolute right-0 top-full z-40 min-w-40 rounded-xl border border-white/15 bg-[#211952] p-2 shadow-lg">
        {match && <button type="button" className="block min-h-11 w-full px-3 text-left text-sm text-rose-200" onClick={() => { setMenu(false); askUnmatch(match,name); }}>Unmatch</button>}
        <button type="button" className="block min-h-11 w-full px-3 text-left text-sm" onClick={() => { setMenu(false); setReport(true); }}>Report</button>
        <button type="button" className="block min-h-11 w-full px-3 text-left text-sm" onClick={async () => { if (!user || lock.current) return; lock.current=true; try { await db.blockUser(user.id,profileId); if(match) await unmatch(match); setMenu(false); router.refresh(); } catch { setError("Couldn’t block. Please try again."); } finally { lock.current=false; } }}>Block</button>
      </div>}
    </div>
    {error && <p role="alert" className="text-xs text-rose-200">{error}</p>}
    <BottomSheet open={report} onClose={() => setReport(false)} title={`Report ${name}`} description="Your report is reviewed confidentially.">
      <form onSubmit={async (event) => { event.preventDefault(); if(!user) return; const data=new FormData(event.currentTarget); await db.createReport({reporter_id:user.id,reported_user_id:profileId,reason:"other",description:String(data.get("description")||"")}); setReport(false); }}>
        <label className="text-sm">What happened?<textarea name="description" maxLength={1000} className="mt-2 w-full rounded-xl bg-[#211952] p-3" /></label>
        <Button type="submit" className="mt-3 w-full">Submit report</Button>
      </form>
    </BottomSheet>
  </>;
}
