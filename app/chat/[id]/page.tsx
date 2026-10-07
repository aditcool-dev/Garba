"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AvatarFallback, Button, Card, VerifiedBadge } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";
import type { Message, Profile } from "@/lib/supabase/types";
import { useRelationships } from "@/lib/relationships-context";
import { MatchActions } from "@/components/match-actions";
import { MessageStatus } from "@/components/message-status";
import { mergeMessage } from "@/lib/message-receipts";

const CONVERSATION_STARTERS = [
  "Which Navratri nights are you going?",
  "Garba or Dandiya first?",
  "Traditional outfit or Bollywood beats?",
  "Let's practice the 3-taali steps!",
];

export default function ChatPage() {
  const params = useParams();
  const matchId = (params?.id as string) || "";
  const { user, profile } = useAuth();
  const { matches, loading: matchesLoading, refetch: refetchMatches } = useRelationships();
  const activeMatch=matches.find((match)=>match.id===matchId||match.user_a===matchId||match.user_b===matchId);

  const [partner, setPartner] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>(matchId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageViewport = useRef<HTMLDivElement>(null);
  const sendLocks = useRef(new Set<string>());
  const chatGeneration = useRef("");
  chatGeneration.current = `${activeMatch?.id || ""}:${activeMatch?.chat_started_at || ""}`;

  useEffect(() => {
    let cancelled=false;
    setMessages([]);setText("");
    if(matchesLoading){setLoading(true);return;}
    if(!activeMatch||!user){setNotFound(true);setPartner(null);setLoading(false);return;}
    setNotFound(false);setLoading(true);setPartner(activeMatch.partner||null);setActiveChatId(activeMatch.id);
    const generation=activeMatch.chat_started_at||activeMatch.created_at;
    void db.getMessages(activeMatch.id).then((rows)=>{if(!cancelled){setMessages(rows.filter((message)=>message.created_at>=generation));setLoading(false);}}).catch(()=>{if(!cancelled){setNotFound(true);setLoading(false);}});
    const unsubscribe=db.subscribeToMessages(activeMatch.id,(message)=>{if(!cancelled&&message.chat_started_at===generation&&message.created_at>=generation){setMessages((rows)=>{const old=rows.find(row=>row.id===message.id), merged=mergeMessage(old,message);if(old&&JSON.stringify(old)===JSON.stringify(merged))return rows;return old?rows.map(row=>row.id===message.id?merged:row):[...rows,message];});}});
    return ()=>{cancelled=true;unsubscribe();};
  }, [matchId,user,matchesLoading,activeMatch?.id,activeMatch?.chat_started_at]);

  const lastMessageId = messages[messages.length - 1]?.id;
  const failedCount = messages.filter(message => message.local_status === "failed").length;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastMessageId, failedCount]);

  useEffect(() => {
    const viewport = messageViewport.current;
    if (!viewport || !activeMatch || !user || loading || notFound) return;
    let busy = false;
    let disposed = false;
    const acknowledged = new Set<string>();
    const readVisible = () => {
      if (disposed || busy || document.visibilityState !== "visible") return;
      const bounds = viewport.getBoundingClientRect();
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Primary navigation"]')?.getBoundingClientRect();
      const viewportBottom = nav && nav.width > window.innerWidth / 2 ? Math.min(window.innerHeight, nav.top) : window.innerHeight;
      const ids = Array.from(viewport.querySelectorAll<HTMLElement>("[data-incoming-message]")).filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > Math.max(0, bounds.top) && rect.top < Math.min(viewportBottom, bounds.bottom) && !acknowledged.has(element.dataset.incomingMessage!);
      }).map(element => element.dataset.incomingMessage!);
      if (!ids.length) return;
      busy = true;
      void db.markChatRead(activeMatch.id, ids).then(() => { ids.forEach(id => acknowledged.add(id)); busy = false; readVisible(); }).catch(error => { busy = false; console.warn("[chat] read status", error); });
    };
    const observer = new IntersectionObserver(readVisible, { root: null, threshold: 0.1 });
    viewport.querySelectorAll("[data-incoming-message]").forEach(element => observer.observe(element));
    viewport.addEventListener("scroll", readVisible); window.addEventListener("scroll", readVisible); document.addEventListener("visibilitychange", readVisible);
    readVisible();
    return () => { disposed = true; observer.disconnect(); viewport.removeEventListener("scroll", readVisible); window.removeEventListener("scroll", readVisible); document.removeEventListener("visibilitychange", readVisible); };
  }, [messages, activeMatch?.id, activeMatch?.chat_started_at, user?.id, profile?.read_receipts_enabled, loading, notFound]);

  const send = async (message: Message) => {
    if (!user || !activeMatch || sendLocks.current.has(message.id)) return;
    const token = chatGeneration.current;
    sendLocks.current.add(message.id); setSending(true);
    setMessages(rows => rows.map(row => row.id === message.id ? { ...row, local_status: "sending" } : row));
    try {
      const saved = await db.sendMessage(activeMatch.id, user.id, message.body, message.chat_started_at, message.id);
      if (chatGeneration.current !== token) return;
      setMessages(rows => rows.some(row => row.id === saved.id) ? rows.map(row => row.id === saved.id ? mergeMessage(row,saved) : row) : [...rows, saved]);
    } catch {
      if (chatGeneration.current === token) setMessages(rows => rows.map(row => row.id === message.id ? { ...row, local_status: "failed" } : row));
      await refetchMatches();
    } finally { sendLocks.current.delete(message.id); setSending(sendLocks.current.size > 0); }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user || !partner || sending || !activeMatch) return;

    const content = text.trim();
    setText("");
    const pending: Message = { id: crypto.randomUUID(), match_id: activeMatch.id, sender_id: user.id, body: content, created_at: new Date().toISOString(), chat_started_at: activeMatch.chat_started_at || activeMatch.created_at, read_at: null, delivered_at: null, local_status: "sending" };
    setMessages(rows => [...rows, pending]);
    await send(pending);
  };

  if (!user) {
    return (
      <AppShell title="Chat protected">
        <div className="mx-auto max-w-lg pt-3 sm:pt-8">
          <Card className="overflow-hidden border-[#ffd166]/25 p-0">
            <div className="bg-gradient-to-br from-[#2b215b] to-[#171039] p-7 text-center sm:p-9">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-[#ffd166]/20 bg-[#ffd166]/10 text-3xl">💬</div>
              <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffd166]">Verified match only</p>
              <h1 className="display-font mt-2 text-2xl font-bold text-white sm:text-3xl">Login to open chat</h1>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#cbc9e8]">Conversations are private and only unlock for verified match participants.</p>
              <Link href="/login" className="mt-7 inline-block w-full sm:w-auto"><Button className="w-full sm:w-auto">Sign in to start chatting <span aria-hidden="true">→</span></Button></Link>
            </div>
            <div className="border-t border-white/10 px-5 py-3 text-center text-[11px] text-[#aaa8d0]">Your contact details stay yours.</div>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return <AppShell title="Chat"><div className="py-20 text-center text-[#aaa8d0]"><div className="mb-3 text-4xl animate-spin" aria-hidden="true">🪩</div><p className="text-sm">Connecting to your secure room…</p></div></AppShell>;
  }

  if (!activeMatch || notFound || !partner || partner.id === user.id) {
    return (
      <AppShell title="Chat">
        <div className="mx-auto max-w-lg pt-8 text-center sm:pt-12">
          <Card className="border-white/10 py-9">
            <div className="text-5xl" aria-hidden="true">🤝</div>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffd166]">Chat locked</p>
            <h1 className="display-font mt-2 text-2xl font-bold text-white">This chat is no longer available</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#aaa8d0]">Chat unlocks only after both dancers choose interested. Find your next connection on Discover.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2"><Link href="/matches"><Button>View matches</Button></Link><Link href="/discover"><Button variant="secondary">Find partners</Button></Link></div>
          </Card>
        </div>
      </AppShell>
    );
  }

  const partnerName = partner.first_name || "Match partner";
  const visibleMessages=messages.filter((message)=>message.created_at>=(activeMatch.chat_started_at||activeMatch.created_at));

  return (
    <AppShell title={`Chat · ${partnerName}`}>
      <div className="mx-auto flex max-w-2xl flex-col pb-6">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Link href="/chat" aria-label="Back to chats" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg text-[#cbc9e8] transition hover:bg-white/10">←</Link>
            <AvatarFallback src={partner.photo_path} name={partnerName} fallback={partner.photo_path || "🌸"} size="md" className="hidden sm:inline-flex" />
            <div className="min-w-0 flex-1"><h1 className="text-sm font-bold leading-5 text-white [overflow-wrap:anywhere] sm:text-lg">{partnerName}</h1><p className="mt-1 text-[10px] text-[#aaa8d0]">{partner.branch || "BMSCE"} · Matched {partner.is_verified ? "· ✓ Verified" : ""}</p></div>
          </div>
          <Link href={`/profile/${partner.id}`} className="hidden min-h-10 shrink-0 items-center rounded-full border border-white/10 px-3 py-2 text-[11px] font-bold text-[#ffd166] transition hover:bg-white/5 sm:inline-flex">View profile</Link>
          <MatchActions match={activeMatch} name={partnerName} profileId={partner.id} />
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#ffd166]/20 bg-[#ffd166]/10 px-4 py-3.5">
          <span className="text-lg" aria-hidden="true">🛡️</span>
          <div className="text-[11px] leading-5 text-[#ffe9a3]"><p className="font-bold text-[#ffd166]">Campus safety first</p><p>Meet at official BMSCE festival venues, in public, with friends. Never share passwords, bank OTPs, or money.</p></div>
        </div>

        <div ref={messageViewport} className="min-h-[45vh] max-h-[58vh] overflow-y-auto rounded-[26px] border border-white/10 bg-[#0d0929]/60 p-4 shadow-inner sm:p-5" aria-live="polite">
          {visibleMessages.length === 0 ? (
            <div className="flex min-h-[34vh] flex-col items-center justify-center px-4 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[#f35ca8]/10 text-2xl" aria-hidden="true">👋</div><p className="mt-4 max-w-xs text-sm leading-6 text-[#cbc9e8]">Say hello to {partnerName} and make a plan for the floor.</p><p className="mt-1 text-[11px] text-[#aaa8d0]">Start with a chip below or write your own.</p></div>
          ) : (
            <div>
              {visibleMessages.map((message, index) => {
                const isMe = message.sender_id === user.id || message.sender_id === "current-user";
                const previous = visibleMessages[index - 1];
                const grouped = previous?.sender_id === message.sender_id && new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() < 5 * 60 * 1000;
                const time = new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={message.id} data-message-id={message.id} {...(!isMe ? { "data-incoming-message": message.id } : {})} className={`flex ${isMe ? "justify-end" : "justify-start"} ${index ? grouped ? "mt-1" : "mt-3" : ""}`}>
                    <div className={`max-w-[84%] rounded-[22px] px-4 py-3 shadow-lg sm:max-w-[72%] ${isMe ? "rounded-br-md bg-gradient-to-br from-[#55214b] to-[#573027] text-white" : "rounded-bl-md border border-white/10 bg-[#211952] text-[#f8f7ff]"}`}>
                      <p className="text-sm leading-6 [overflow-wrap:anywhere]">{message.body}</p>
                      <div className={`mt-1.5 flex items-center justify-end gap-1.5 text-[10px] ${isMe ? "text-[#b6bccb]" : "text-[#aaa8d0]"}`}><span>{time}</span>{isMe && <MessageStatus message={message} readReceipts={profile?.read_receipts_enabled !== false} onRetry={() => void send(message)} />}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="my-3 flex flex-wrap gap-2" aria-label="Conversation starters">
          {CONVERSATION_STARTERS.map((starter) => <button key={starter} type="button" onClick={() => setText(starter)} className="min-h-11 max-w-full rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 text-left text-xs font-semibold text-[#cbc9e8] transition hover:border-[#ffd166]/50 hover:bg-[#ffd166]/10 hover:text-[#ffdca0]">{starter}</button>)}
        </div>

        <form onSubmit={handleSend} className="flex items-end gap-2 rounded-[24px] border border-white/10 bg-white/[0.045] p-2 pl-4 shadow-xl">
          <input aria-label="Message" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} className="min-h-11 min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-[#73789e]" placeholder="Write a message…" />
          <Button type="submit" disabled={!text.trim() || sending} className="min-h-11 min-w-11 px-4" aria-label="Send message">{sending ? "…" : <><span className="hidden sm:inline">Send</span><span className="sm:hidden" aria-hidden="true">↑</span></>}</Button>
        </form>
        <p className="mt-2 text-center text-[10px] text-[#73789e]">Keep it kind and keep meetup plans public. <Link href={`/profile/${partner.id}`} className="text-[#aaa8d0] underline decoration-white/20 underline-offset-2">Report a concern</Link></p>
      </div>
    </AppShell>
  );
}
