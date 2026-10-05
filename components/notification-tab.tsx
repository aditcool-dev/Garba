"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/supabase/client";
import type { IncomingInterest, NotificationItem } from "@/lib/supabase/types";
import { useRelationships } from "@/lib/relationships-context";

function isImageSrc(src?: string | null): boolean {
  if (!src) return false;
  const s = src.trim();
  return (
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("data:") ||
    s.startsWith("/") ||
    s.startsWith("blob:")
  );
}
function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type BannerState = {
  type: "interest" | "match" | "message";
  senderName: string;
  senderPhoto?: string | null;
  fromUser: string;
  matchId?: string;
  messageBody?: string;
};

export function NotificationTab({ userId }: { userId: string }) {
  const { revision } = useRelationships();
  const router = useRouter();
  const [interests, setInterests] = useState<IncomingInterest[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "interests" | "matches" | "messages">("all");
  const [isOpen, setIsOpen] = useState(false);
  const [bannerAlert, setBannerAlert] = useState<BannerState | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const bannerTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showBanner = (alert: BannerState) => {
    setBannerAlert(alert);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      setBannerAlert(null);
    }, 7000);
  };

  // Load interests, notifications, and subscribe
  useEffect(() => {
    if (!userId) return;

    const loadData = async () => {
      try {
        const [incomingList, notifList] = await Promise.all([
          db.getIncomingInterests(userId),
          db.getUserNotifications(userId),
        ]);
        setInterests(incomingList);
        setNotifications(notifList);
      } catch (err) {
        console.warn("Failed to load notifications:", err);
      }
    };

    loadData();

    // 1. Subscribe to interests
    const unsubInterests = db.subscribeToInterests(userId, async (data) => {
      const freshInterests = await db.getIncomingInterests(userId);
      setInterests(freshInterests);

      if (data?.type === "dismissed") {
        if (bannerAlert && (bannerAlert.fromUser === (data as any).target_user || bannerAlert.fromUser === data.from_user)) {
          setBannerAlert(null);
        }
        return;
      }

      if (data?.type === "match_created") {
        const freshNotifs = await db.getUserNotifications(userId);
        setNotifications(freshNotifs);
        const otherId = (data as any).user_a === userId ? (data as any).user_b : (data as any).user_a;
        const partner = await db.getProfileById(otherId);
        showBanner({
          type: "match",
          senderName: partner?.first_name || "A dancer",
          senderPhoto: partner?.photo_path,
          fromUser: otherId,
          matchId: (data as any).matchId,
        });
        return;
      }

      if (data?.from_user) {
        const sender = (data as any)?.sender_profile || freshInterests.find((i) => i.from_user === data.from_user)?.sender_profile;
        const senderName = sender?.first_name || "A dancer";
        const senderPhoto = sender?.photo_path || null;

        showBanner({
          type: "interest",
          senderName,
          senderPhoto,
          fromUser: data.from_user,
        });
      }
    });

    // 2. Subscribe to general notifications (matches, messages, interests)
    const unsubNotifs = db.subscribeToNotifications(userId, async (notif) => {
      const fresh = await db.getUserNotifications(userId);
      setNotifications(fresh);

      if (notif.type === "match") {
        showBanner({
          type: "match",
          senderName: notif.sender_name || "A dancer",
          senderPhoto: notif.sender_photo,
          fromUser: notif.sender_id || "",
          matchId: notif.match_id,
        });
      } else if (notif.type === "message") {
        showBanner({
          type: "message",
          senderName: notif.sender_name || "Match",
          senderPhoto: notif.sender_photo,
          fromUser: notif.sender_id || "",
          matchId: notif.match_id,
          messageBody: notif.body,
        });
      } else if (notif.type === "interest") {
        const freshInterests = await db.getIncomingInterests(userId);
        setInterests(freshInterests);
        showBanner({
          type: "interest",
          senderName: notif.sender_name || "A dancer",
          senderPhoto: notif.sender_photo,
          fromUser: notif.sender_id || "",
        });
      }
    });

    // 3. Subscribe to matches
    const unsubMatches = db.subscribeToMatches(userId, async (match) => {
      if (match?.status === "active") {
        const freshNotifs = await db.getUserNotifications(userId);
        setNotifications(freshNotifs);
      }
    });

    return () => {
      unsubInterests();
      unsubNotifs();
      unsubMatches();
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [userId, revision]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMatchBack = async (interest: IncomingInterest) => {
    setInterests((prev) => prev.filter((i) => i.from_user !== interest.from_user));
    setBannerAlert(null);
    setIsOpen(false);

    const res = await db.likeProfile(userId, interest.from_user, "interested", true);
    if (res.matchId) {
      router.push(`/chat/${res.matchId}`);
    } else {
      router.push("/matches");
    }
  };

  const handlePass = async (interest: IncomingInterest) => {
    setInterests((prev) => prev.filter((i) => i.from_user !== interest.from_user));
    if (bannerAlert?.fromUser === interest.from_user) {
      setBannerAlert(null);
    }
    await db.passProfile(userId, interest.from_user);
  };

  const handleOpenNotification = async (item: NotificationItem) => {
    await db.markNotificationRead(userId, item.id);
    setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    setIsOpen(false);

    if (item.match_id) {
      router.push(`/chat/${item.match_id}`);
    } else if (item.type === "interest") {
      router.push("/matches?tab=interests");
    }
  };

  const handleClearAll = async () => {
    await db.clearAllNotifications(userId);
    setNotifications([]);
  };

  // Counts
  const unreadNotifsCount = notifications.filter((n) => !n.read).length;
  const totalCount = interests.length + unreadNotifsCount;
  const matchNotifs = notifications.filter((n) => n.type === "match");
  const messageNotifs = notifications.filter((n) => n.type === "message");

  return (
    <div ref={containerRef} className="relative">
      {/* Upside Tab Trigger Button (Right next to profile) */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setBannerAlert(null);
        }}
        title="Notifications & Alerts"
        className={`relative flex items-center justify-center h-8 w-8 rounded-full border transition active:scale-95 ${
          isOpen || totalCount > 0
            ? "bg-[#ffd166]/15 border-[#ffd166]/50 text-[#ffd166]"
            : "bg-white/5 border-white/10 text-[#aab0d0] hover:text-white hover:bg-white/10"
        }`}
      >
        <span className="text-sm select-none">🔔</span>
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-1 text-[9px] font-black text-black shadow-md ring-2 ring-[#0c0e29] animate-pulse">
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}
      </button>

      {/* Floating subtle upside preview notification banner */}
      {bannerAlert && (
        <div className="fixed top-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:top-4 z-50 max-w-sm w-auto mx-auto sm:mx-0 rounded-2xl bg-[#141842]/95 border border-[#ffd166]/50 p-2.5 shadow-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-base overflow-hidden border border-white/20">
                {isImageSrc(bannerAlert.senderPhoto) ? (
                  <img src={bannerAlert.senderPhoto!} alt="Sender" className="h-full w-full object-cover" />
                ) : (
                  bannerAlert.senderPhoto || (bannerAlert.type === "match" ? "🎉" : bannerAlert.type === "message" ? "💬" : "💃")
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-white truncate">
                  {bannerAlert.senderName}
                </p>
                <p className="text-[10px] text-[#ffd166] font-medium truncate">
                  {bannerAlert.type === "match"
                    ? "🎉 Garba Match! You matched!"
                    : bannerAlert.type === "message"
                    ? `💬 ${bannerAlert.messageBody || "Sent you a message"}`
                    : "⚡ Showed interest in you!"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {bannerAlert.type === "interest" ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const item = interests.find((i) => i.from_user === bannerAlert.fromUser) || {
                        id: `interest-${bannerAlert.fromUser}`,
                        from_user: bannerAlert.fromUser,
                        to_user: userId,
                        kind: "interested" as const,
                        created_at: new Date().toISOString(),
                      };
                      handlePass(item);
                    }}
                    className="rounded-lg bg-white/10 hover:bg-white/20 px-2 py-1 text-[10px] font-bold text-[#c5c9e8] transition"
                    title="Pass"
                  >
                    ✕ Pass
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const item = interests.find((i) => i.from_user === bannerAlert.fromUser) || {
                        id: `interest-${bannerAlert.fromUser}`,
                        from_user: bannerAlert.fromUser,
                        to_user: userId,
                        kind: "interested" as const,
                        created_at: new Date().toISOString(),
                      };
                      handleMatchBack(item);
                    }}
                    className="rounded-lg bg-[#ffd166] text-black font-black px-2.5 py-1 text-[10px] hover:bg-[#ffd166]/90 transition shadow-sm"
                  >
                    ❤️ Match
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setBannerAlert(null);
                    if (bannerAlert.matchId) {
                      router.push(`/chat/${bannerAlert.matchId}`);
                    } else {
                      router.push("/matches");
                    }
                  }}
                  className="rounded-lg bg-[#2dd4bf] text-black font-black px-2.5 py-1 text-[10px] hover:bg-[#2dd4bf]/90 transition shadow-sm"
                >
                  {bannerAlert.type === "match" ? "💬 Chat now" : "💬 Reply"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Responsive Upside Dropdown Panel (Clean on Mobile & Desktop) */}
      {isOpen && (
        <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 max-w-sm sm:max-w-none mx-auto sm:mx-0 rounded-2xl bg-[#12163b]/98 border border-white/15 p-4 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-base">✨</span>
              <span className="font-extrabold text-sm text-white">Notifications</span>
              {totalCount > 0 && (
                <span className="rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.2 text-[10px] font-black">
                  {totalCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[10px] text-[#aab0d0] hover:text-white transition"
                  title="Clear notification history"
                >
                  Clear history
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-xs text-[#aab0d0] hover:text-white hover:bg-white/10 transition"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 mt-2.5 pb-2 border-b border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                activeTab === "all"
                  ? "bg-[#ffd166] text-black"
                  : "bg-white/5 text-[#aab0d0] hover:text-white"
              }`}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("interests")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                activeTab === "interests"
                  ? "bg-[#ffd166] text-black"
                  : "bg-white/5 text-[#aab0d0] hover:text-white"
              }`}
            >
              <span>⚡</span> Interests ({interests.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("matches")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                activeTab === "matches"
                  ? "bg-[#ffd166] text-black"
                  : "bg-white/5 text-[#aab0d0] hover:text-white"
              }`}
            >
              <span>🎉</span> Matches ({matchNotifs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("messages")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                activeTab === "messages"
                  ? "bg-[#ffd166] text-black"
                  : "bg-white/5 text-[#aab0d0] hover:text-white"
              }`}
            >
              <span>💬</span> Messages ({messageNotifs.length})
            </button>
          </div>

          {/* List of Notifications */}
          <div className="mt-3 max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {/* 1. Pending Incoming Interests (shown under 'all' or 'interests') */}
            {(activeTab === "all" || activeTab === "interests") &&
              interests.map((item) => {
                const sender = item.sender_profile;
                const name = sender?.first_name || "BMSCE Dancer";
                const photo = sender?.photo_path || "🌸";
                const branch = sender?.branch ? `${sender.branch} · Year ${sender.year || 2}` : "BMSCE Student";

                return (
                  <div
                    key={`interest-${item.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-amber-500/[0.08] to-transparent hover:bg-white/[0.07] border border-amber-400/20 p-2.5 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg overflow-hidden border border-white/10">
                        {isImageSrc(photo) ? (
                          <img src={photo} alt={name} className="h-full w-full object-cover" />
                        ) : (
                          photo
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-black text-white truncate">{name}</p>
                          <span className="rounded bg-amber-400/20 text-amber-300 text-[8px] font-black px-1">NEW</span>
                        </div>
                        <p className="text-[10px] text-[#aab0d0] truncate">{branch}</p>
                        <p className="text-[9px] text-amber-300/90 font-semibold">⚡ Showed interest in you</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePass(item)}
                        className="rounded-lg bg-white/10 hover:bg-white/20 px-2 py-1 text-[11px] font-bold text-[#aab0d0] hover:text-white transition"
                        title="Pass / Dismiss"
                      >
                        ✕ Pass
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMatchBack(item)}
                        className="rounded-lg bg-[#ffd166] hover:bg-[#ffd166]/90 px-2.5 py-1 text-[11px] font-black text-black transition shadow-sm"
                        title="Match Back"
                      >
                        ❤️ Match
                      </button>
                    </div>
                  </div>
                );
              })}

            {/* 2. Matches & Message Notifications */}
            {notifications
              .filter((n) => {
                if (activeTab === "interests") return false;
                if (activeTab === "matches") return n.type === "match";
                if (activeTab === "messages") return n.type === "message";
                return true; // "all"
              })
              .map((notif) => {
                const isMatch = notif.type === "match";
                const isMsg = notif.type === "message";

                return (
                  <div
                    key={`notif-${notif.id}`}
                    onClick={() => handleOpenNotification(notif)}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-2.5 transition cursor-pointer ${
                      notif.read
                        ? "bg-white/[0.03] border-white/5 hover:bg-white/[0.06]"
                        : isMatch
                        ? "bg-emerald-500/[0.08] border-emerald-400/30 hover:bg-emerald-500/[0.12]"
                        : "bg-fuchsia-500/[0.08] border-fuchsia-400/30 hover:bg-fuchsia-500/[0.12]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg overflow-hidden border border-white/10">
                        {isImageSrc(notif.sender_photo) ? (
                          <img src={notif.sender_photo!} alt={notif.sender_name || "Sender"} className="h-full w-full object-cover" />
                        ) : (
                          notif.sender_photo || (isMatch ? "🎉" : isMsg ? "💬" : "⚡")
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-black text-white truncate">
                            {notif.title}
                          </p>
                          {!notif.read && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#2dd4bf] animate-ping" />
                          )}
                        </div>
                        <p className="text-[10px] text-[#c5c9e8] truncate">
                          {notif.body}
                        </p>
                        <p className="text-[9px] text-[#73789e]">
                          {timeAgo(notif.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isMatch ? (
                        <button
                          type="button"
                          className="rounded-lg bg-[#2dd4bf] hover:bg-[#2dd4bf]/90 text-black px-2.5 py-1 text-[10px] font-black transition"
                        >
                          💬 Chat
                        </button>
                      ) : isMsg ? (
                        <button
                          type="button"
                          className="rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 text-white px-2.5 py-1 text-[10px] font-black transition"
                        >
                          💬 Reply
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}

            {/* Empty State */}
            {interests.length === 0 &&
              notifications.filter((n) => {
                if (activeTab === "interests") return false;
                if (activeTab === "matches") return n.type === "match";
                if (activeTab === "messages") return n.type === "message";
                return true;
              }).length === 0 && (
                <div className="py-7 text-center text-[#73789e]">
                  <div className="text-2xl mb-1">🪩</div>
                  <p className="text-xs font-medium text-[#aab0d0]">No notifications yet</p>
                  <p className="text-[10px] text-[#73789e] mt-1 max-w-[15rem] mx-auto leading-4">
                    When someone shows interest, matches with you, or sends a message, it will appear right here.
                  </p>
                </div>
              )}
          </div>

          {/* Footer View All Link */}
          {interests.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-white/10 text-center">
              <Link
                href="/matches?tab=interests"
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-[#ffd166] hover:underline inline-flex items-center gap-1"
              >
                View all interested dancers →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
