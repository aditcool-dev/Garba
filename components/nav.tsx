"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useRelationships } from "@/lib/relationships-context";

export function Nav() {
  const path = usePathname() || "";
  const { user } = useAuth();
  const { revision } = useRelationships();
  const [interestCount, setInterestCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setInterestCount(0);
      return;
    }

    // Load initial count
    db.getIncomingInterests(user.id).then((list) => {
      setInterestCount(list.length);
    }).catch(error => console.warn("[nav] interests", error));

    // Real-time listener
    const unsub = db.subscribeToInterests(user.id, () => {
      db.getIncomingInterests(user.id).then((list) => {
        setInterestCount(list.length);
      }).catch(error => console.warn("[nav] interests", error));
    });

    return () => {
      unsub();
    };
  }, [user, path,revision]);

  const links = [
    { icon: "⌂", label: "Discover", href: "/discover", badge: 0 },
    { icon: "♥", label: "Matches", href: "/matches", badge: interestCount },
    { icon: "💬", label: "Chats", href: "/chat", badge: 0 },
    { icon: "●", label: "Profile", href: "/profile/me", badge: 0 },
  ];

  const visibleLinks = user
    ? links
    : [
        { icon: "⌂", label: "Discover", href: "/discover", badge: 0 },
        { icon: "→", label: "Sign in", href: "/login", badge: 0 },
      ];

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0820]/95 px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-14px_40px_rgba(0,0,0,0.25)] backdrop-blur-2xl md:inset-y-0 md:left-0 md:right-auto md:flex md:w-20 md:flex-col md:border-b-0 md:border-l-0 md:border-r md:border-t-0 md:px-2 md:py-5 md:shadow-[12px_0_40px_rgba(0,0,0,0.16)]"
    >
      <div className="mx-auto flex w-full max-w-lg flex-1 items-center justify-around gap-1 md:mx-0 md:flex-col md:justify-center md:gap-3">
        {visibleLinks.map((item) => {
          const isActive =
            path === item.href ||
            path.startsWith(`${item.href}/`) ||
            (item.href === "/profile/me" && path.startsWith("/profile/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              aria-label={`${item.label}${item.badge > 0 ? `, ${item.badge} incoming interests` : ""}`}
              title={item.label}
              className={cn(
                "group relative flex min-h-12 min-w-12 max-w-[6rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-xs transition duration-200 md:w-full md:max-w-none md:flex-none md:gap-1 md:px-0 md:py-2 md:text-[10px]",
                isActive ? "bg-white/[0.08] font-bold text-[#ffd166]" : "text-[#aaa8d0] hover:bg-white/[0.05] hover:text-white",
              )}
            >
              <span
                className={cn(
                  "relative text-xl leading-none transition-transform group-hover:-translate-y-0.5 md:text-lg",
                  isActive && "drop-shadow-[0_0_10px_rgba(255,209,102,0.45)]",
                )}
                aria-hidden="true"
              >
                {item.icon}
                {item.badge > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ffd166] px-1 text-[9px] font-black text-[#100a2c] shadow-md animate-pulse">
                    {item.badge}
                  </span>
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
