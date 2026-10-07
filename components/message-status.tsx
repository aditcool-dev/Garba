"use client";

import { Check, CheckCheck, CircleAlert, Clock3 } from "lucide-react";
import type { Message } from "@/lib/supabase/types";

export function MessageStatus({ message, readReceipts = true, onRetry }: { message: Message; readReceipts?: boolean; onRetry?: () => void }) {
  const state = message.local_status === "failed" ? "Failed to send" : message.local_status === "sending" ? "Sending" : message.read_at && readReceipts ? "Read" : message.delivered_at || message.read_at ? "Delivered" : "Sent";
  if (state === "Failed to send") return <button type="button" onClick={onRetry} aria-label="Failed to send. Tap to retry" title="Failed to send. Tap to retry" className="flex min-h-11 items-center gap-1 rounded-lg bg-[#190b28] px-2 text-xs font-bold text-[#ff8f9e]"><CircleAlert size={14} aria-hidden="true" />Tap to retry</button>;
  const Icon = state === "Sending" ? Clock3 : state === "Sent" ? Check : CheckCheck;
  return <span role="img" aria-label={state} title={state} data-message-status={state.toLowerCase()} className={`inline-flex shrink-0 rounded px-0.5 ${state === "Read" ? "text-[#34B7F1]" : "text-[#b6bccb]"}`}><Icon size={15} strokeWidth={2.5} aria-hidden="true" /></span>;
}
