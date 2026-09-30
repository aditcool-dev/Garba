"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/supabase/client";
import type { IncomingInterest, Profile } from "@/lib/supabase/types";

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

export function NotificationTab({ userId }: { userId: string }) {
  const router = useRouter();
  const [interests, setInterests] = useState<IncomingInterest[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [bannerAlert, setBannerAlert] = useState<{
    senderName: string;
    senderPhoto?: string | null;
    fromUser: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const bannerTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load interests and subscribe
  useEffect(() => {
    if (!userId) return;

    const loadInterests = async () => {
      try {
        const list = await db.getIncomingInterests(userId);
        setInterests(list);
      } catch (err) {
        console.warn("Failed to load interests:", err);
      }
    };

    loadInterests();

    const unsub = db.subscribeToInterests(userId, async (data) => {
      const fresh = await db.getIncomingInterests(userId);
      setInterests(fresh);

      // Extract sender details from payload or fresh list
      const sender = (data as any)?.sender_profile || fresh.find((i) => i.from_user === data.from_user)?.sender_profile;
      const senderName = sender?.first_name || "A dancer";
      const senderPhoto = sender?.photo_path || null;

      // Show the subtle upside tab near profile
      setBannerAlert({
        senderName,
        senderPhoto,
        fromUser: data.from_user,
      });

      // Auto open the notification dropdown slightly for a preview
      setIsOpen(true);

      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = setTimeout(() => {
        setBannerAlert(null);
      }, 7000);
    });

    return () => {
      unsub();
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [userId]);

  // Click outside listener to close
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
    const res = await db.likeProfile(userId, interest.from_user, "interested");
    const fresh = await db.getIncomingInterests(userId);
    setInterests(fresh);
    setBannerAlert(null);
    setIsOpen(false);
    if (res.matchId) {
      router.push(`/chat/${res.matchId}`);
    } else {
      router.push("/matches");
    }
  };

  const count = interests.length;

  return (
    <div ref={containerRef} className="relative">
      {/* Upside Tab Trigger Button (Right next to profile) */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setBannerAlert(null);
        }}
        title="Notifications & Interests"
        className={`relative flex items-center justify-center h-8 w-8 rounded-full border transition active:scale-95 ${
          isOpen || count > 0
            ? "bg-[#ffd166]/15 border-[#ffd166]/50 text-[#ffd166]"
            : "bg-white/5 border-white/10 text-[#aab0d0] hover:text-white hover:bg-white/10"
        }`}
      >
        <span className="text-sm select-none">🔔</span>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-1 text-[9px] font-black text-black shadow-md ring-2 ring-[#0c0e29] animate-pulse">
            {count}
          </span>
        )}
      </button>

      {/* Slightly opened upside tab / dropdown card */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-[#12163b]/95 border border-white/15 p-4 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-base">✨</span>
              <span className="font-extrabold text-sm text-white">Notifications</span>
              {count > 0 && (
                <span className="rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.2 text-[10px] font-black">
                  {count} new
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-xs text-[#aab0d0] hover:text-white hover:bg-white/10 transition"
            >
              ✕
            </button>
          </div>

          {/* Real-time alert highlight inside tab */}
          {bannerAlert && (
            <div className="mt-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-rose-500/20 border border-amber-400/40 p-2.5 flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-base overflow-hidden border border-white/20">
                  {isImageSrc(bannerAlert.senderPhoto) ? (
                    <img src={bannerAlert.senderPhoto!} alt="Sender" className="h-full w-full object-cover" />
                  ) : (
                    bannerAlert.senderPhoto || "💃"
                  )}
                </div>
                <p className="text-xs text-amber-200 font-semibold truncate">
                  <span className="font-black text-white">{bannerAlert.senderName}</span> just showed interest!
                </p>
              </div>
              <span className="text-[10px] text-amber-300 font-bold shrink-0 bg-amber-400/20 px-2 py-0.5 rounded-md">
                Just now
              </span>
            </div>
          )}

          {/* List of Incoming Interests */}
          <div className="mt-3 max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {count > 0 ? (
              interests.map((item) => {
                const sender = item.sender_profile;
                const name = sender?.first_name || "BMSCE Dancer";
                const photo = sender?.photo_path || "🌸";
                const branch = sender?.branch ? `${sender.branch} · Year ${sender.year || 2}` : "BMSCE Student";

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/5 p-2.5 transition"
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
                        <p className="text-xs font-black text-white truncate">{name}</p>
                        <p className="text-[10px] text-[#aab0d0] truncate">{branch}</p>
                        <p className="text-[9px] text-amber-300/80 font-medium">⚡ Interested in you</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
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
              })
            ) : (
              <div className="py-6 text-center text-[#73789e]">
                <div className="text-2xl mb-1">🎉</div>
                <p className="text-xs font-medium text-[#aab0d0]">No new notifications</p>
                <p className="text-[10px] text-[#73789e] mt-1">
                  When other dancers show interest in you, they will appear right here.
                </p>
              </div>
            )}
          </div>

          {/* Footer View All Link */}
          {count > 0 && (
            <div className="mt-3 pt-2.5 border-t border-white/10 text-center">
              <Link
                href="/matches?tab=interests"
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-[#ffd166] hover:underline inline-flex items-center gap-1"
              >
                View all in Interested tab →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
