"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";
import type { Message, Profile } from "@/lib/supabase/types";

export default function ChatPage() {
  const params = useParams();
  const matchId = (params?.id as string) || "demo-ananya-1";
  const { user, profile: myProfile, demoLogin, isConfigured } = useAuth();

  const [partner, setPartner] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      // Find partner profile
      const profiles = await db.getProfiles();
      const p = profiles.find((item) => matchId.includes(item.id) || item.id === matchId) || profiles[0];
      setPartner(p);

      const msgs = await db.getMessages(matchId);
      setMessages(msgs);
    }

    loadData();

    // Setup Supabase Realtime subscription
    const unsubscribe = db.subscribeToMessages(matchId, (newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    });

    return () => {
      unsubscribe();
    };
  }, [matchId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user || sending) return;

    setSending(true);
    const content = text.trim();
    setText("");

    const newMsg = await db.sendMessage(matchId, user.id, content);
    setMessages((prev) => {
      if (prev.some((m) => m.id === newMsg.id)) return prev;
      return [...prev, newMsg];
    });

    // In demo mode or if chatting with demo user, simulate friendly partner reply after 1.5s
    if (partner && (partner.is_demo || !isConfigured)) {
      setTimeout(async () => {
        const replies = [
          "Super excited for Day 4 too! What colour outfit are you planning to wear?",
          "Yes! The music beats are going to be insane this year. Have you got your passes yet?",
          "Sounds amazing! Let's definitely catch up near the food stall circle before the main rounds begin.",
          "Haha same! I'm still perfecting the 3-taali turn, you'll have to guide me!",
        ];
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        const replyMsg = await db.sendMessage(matchId, partner.id, randomReply);
        setMessages((prev) => [...prev, replyMsg]);
      }, 1400);
    }

    setSending(false);
  };

  // Login Gate
  if (!user) {
    return (
      <AppShell title="Chat Protected">
        <div className="mx-auto max-w-lg pt-6">
          <Card className="border-[#ffd166]/30 bg-gradient-to-b from-[#1b1f48] to-[#111432] p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#ffd166]/10 text-4xl border border-[#ffd166]/20">
              💬
            </div>
            <h1 className="mt-5 text-3xl font-black">Login to Open Chat</h1>
            <p className="mt-3 text-sm leading-6 text-[#c5c9e8]">
              All conversations are end-to-end protected and only accessible to verified match participants.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link href="/login" className="w-full">
                <Button className="w-full">Sign in to Start Chatting</Button>
              </Link>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  const partnerName = partner?.first_name || "Match Partner";
  const partnerPhoto = partner?.photo_path || "🌸";

  return (
    <AppShell title={`Chat · ${partnerName}`}>
      <div className="mx-auto flex max-w-2xl flex-col">
        {/* Chat Header */}
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#33234c] text-2xl border border-white/10 overflow-hidden">
              {partnerPhoto.startsWith("http") || partnerPhoto.startsWith("data:") ? (
                <img src={partnerPhoto} alt={partnerName} className="h-full w-full object-cover" />
              ) : (
                partnerPhoto
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-lg text-white">{partnerName}</h1>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Online
                </span>
              </div>
              <p className="text-xs text-[#aab0d0]">
                {partner?.branch || "BMSCE"} · Matched for Navratri
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {partner && (
              <Link
                href={`/profile/${partner.id}`}
                className="rounded-full bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#ffd166] border border-white/10"
              >
                View Profile
              </Link>
            )}
          </div>
        </div>

        {/* Safety banner */}
        <div className="mb-4 rounded-2xl border border-[#ffd166]/20 bg-[#ffd166]/10 p-3.5 text-xs leading-5 text-[#ffe9a3] flex items-center gap-2.5">
          <span className="text-lg">🛡️</span>
          <span>
            <b>Campus Safety First:</b> Meet at official BMSCE festival venues, in public, with friends. Never share passwords, bank OTPs, or private contact details.
          </span>
        </div>

        {/* Messages container */}
        <div className="min-h-[48vh] max-h-[55vh] overflow-y-auto space-y-3 rounded-2xl bg-black/20 p-4 border border-white/5">
          {messages.length === 0 ? (
            <div className="py-12 text-center text-[#aab0d0] text-sm">
              <p className="text-2xl mb-2">👋</p>
              <p>Say hello to break the ice and coordinate your Navratri nights!</p>
            </div>
          ) : (
            messages.map((message) => {
              const isMe = message.sender_id === user.id || message.sender_id === "current-user";
              const time = new Date(message.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={message.id}
                  className={`max-w-[78%] rounded-2xl px-4 py-2.5 shadow-md ${
                    isMe
                      ? "ml-auto bg-gradient-to-r from-[#f35ca8] to-[#ff8b4d] text-white rounded-br-sm"
                      : "bg-[#292d58] text-[#f8f7ff] rounded-bl-sm border border-white/5"
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.body}</p>
                  <div
                    className={`mt-1 text-[10px] flex items-center justify-end gap-1 ${
                      isMe ? "text-white/80" : "text-[#aab0d0]"
                    }`}
                  >
                    <span>{time}</span>
                    {isMe && <span>✓✓</span>}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Starters */}
        <div className="my-3 flex flex-wrap gap-2">
          {[
            "Which Navratri nights are you going?",
            "Garba or Dandiya first?",
            "Traditional outfit or Bollywood beats?",
            "Let's practice the 3-taali steps!",
          ].map((starter) => (
            <button
              key={starter}
              onClick={() => setText(starter)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#c5c9e8] hover:border-[#ffd166] hover:text-white transition"
            >
              {starter}
            </button>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            aria-label="Message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            className="min-h-11 flex-1 rounded-full border border-white/10 bg-white/5 px-5 text-sm text-white outline-none focus:border-[#ffd166] placeholder:text-[#73789e]"
            placeholder={`Message ${partnerName}...`}
          />
          <Button type="submit" disabled={!text.trim() || sending} className="px-6">
            {sending ? "..." : "Send"}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
