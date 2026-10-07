"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AvatarFallback, Button, Card } from "@/components/ui";
import { MatchActions } from "@/components/match-actions";
import { useAuth } from "@/lib/supabase/auth-context";
import { useRelationships } from "@/lib/relationships-context";
import { useChatSummaries } from "@/lib/chat-summaries";
import { MessageStatus } from "@/components/message-status";

export default function ChatsListPage() {
  const { user, profile } = useAuth();
  const { matches, loading } = useRelationships();
  const summaries = useChatSummaries(matches, user?.id);
  if (!user) return <AppShell title="Chats"><Card className="mx-auto max-w-lg py-10 text-center"><h1 className="text-2xl font-bold">Keep the rhythm going</h1><p className="mt-3 text-sm text-[#cbc9e8]">Sign in with your BMSCE account to open your private conversations.</p><Link href="/login" className="mt-5 inline-block"><Button>Sign in to chat</Button></Link></Card></AppShell>;
  const ordered = [...matches].sort((a, b) => (summaries[b.id]?.lastMessage?.created_at || b.created_at).localeCompare(summaries[a.id]?.lastMessage?.created_at || a.created_at));
  return <AppShell title="Chats"><div className="mx-auto max-w-2xl space-y-5">
    <div><h1 className="text-3xl font-bold text-white">Chats</h1><p className="mt-1.5 text-xs leading-5 text-[#aaa8d0]">Say hello, pick a night, and keep plans public.</p></div>
    {loading ? <Card className="py-12 text-center text-sm">Loading conversations…</Card> : ordered.length ? <section aria-label="Your conversations" className="space-y-3">{ordered.map((match) => {
      const partner = match.partner, name = partner?.first_name || "Garba partner", summary = summaries[match.id];
      const lastTime = summary?.lastMessage?.created_at;
      return <article key={match.id} data-chat-row className="flex min-w-0 items-center gap-2 rounded-[22px] border border-white/10 bg-[#16123a] p-3">
        <Link href={`/chat/${match.id}`} aria-label={`Chat with ${name}`} className="flex min-w-0 flex-1 items-center gap-3">
          <AvatarFallback src={partner?.photo_path} name={name} fallback={partner?.photo_path || "🌸"} size="md" className="h-11 w-11" />
          <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold text-white" title={name}>{name}</h2><div className="mt-1 flex min-w-0 items-center gap-1">{summary?.lastMessage?.sender_id === user.id && <MessageStatus message={summary.lastMessage} readReceipts={profile?.read_receipts_enabled !== false} />}<p className="truncate text-xs text-[#aaa8d0]">{summary?.lastMessage?.body || "Say hello 👋"}</p></div></div>
          <div className="flex shrink-0 flex-col items-end gap-2">{lastTime && <time dateTime={lastTime} className="text-[9px] text-[#aaa8d0]">{new Date(lastTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>}{!!summary?.unread && <span aria-label={`${summary.unread} unread messages`} className="rounded-full bg-[#ffd166] px-1.5 py-0.5 text-[10px] font-bold text-[#100a2c]">{summary.unread > 99 ? "99+" : summary.unread}</span>}</div>
        </Link>
        <MatchActions match={match} name={name} profileId={partner?.id || (match.user_a === user.id ? match.user_b : match.user_a)} />
      </article>;
    })}</section> : <Card className="py-12 text-center"><h2 className="text-xl font-bold text-white">No active chats yet</h2><p className="mt-3 text-sm text-[#aaa8d0]">Match with someone first, then say hello here.</p><Link href="/discover" className="mt-5 inline-block"><Button>Explore the floor</Button></Link></Card>}
  </div></AppShell>;
}
