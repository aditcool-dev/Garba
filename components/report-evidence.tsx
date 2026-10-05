"use client";
import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/supabase/types";
export function ReportEvidence({ reportId }: { reportId: string }) {
  const [rows,setRows]=useState<Message[]|null>(null),[error,setError]=useState<string|null>(null);
  return <div className="mt-3"><button type="button" className="min-h-9 text-xs font-bold text-[#ffd166]" onClick={async()=>{const client=getSupabaseClient();if(!client)return;const {data,error}=await client.rpc("report_chat_evidence",{p_report_id:reportId});if(error)setError("Evidence unavailable");else{setRows(data||[]);setError(null);}}}>Review retained chat evidence</button>{error&&<p role="alert" className="text-xs text-rose-200">{error}</p>}{rows&&<div className="max-h-64 overflow-y-auto rounded-xl bg-black/20 p-3">{rows.length?rows.map((row)=><p key={row.id} className="mb-2 text-xs text-white"><time>{new Date(row.created_at).toLocaleString()}</time> · {row.body}</p>):<p className="text-xs">No chat evidence for this report.</p>}</div>}</div>;
}
