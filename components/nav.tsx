"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";

export function Nav() {
  const path = usePathname() || "";
  const { user } = useAuth();
  const [interestCount, setInterestCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setInterestCount(0);
      return;
    }

    // Load initial count
    db.getIncomingInterests(user.id).then((list) => {
      setInterestCount(list.length);
    });

    // Real-time listener
    const unsub = db.subscribeToInterests(user.id, () => {
      db.getIncomingInterests(user.id).then((list) => {
        setInterestCount(list.length);
      });
    });

    return () => {
      unsub();
    };
  }, [user, path]);

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
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-[#090b24]/95 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:sticky md:top-0 md:flex md:justify-center md:border-0 md:bg-transparent">
      <div className="flex max-w-3xl flex-1 justify-around md:gap-8">
        {visibleLinks.map((item) => {
          const isActive = path.startsWith(`/${item.href.split("/")[1]}`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 rounded-xl text-xs transition ${
                isActive ? "text-[#ffd166] font-bold" : "text-[#aab0d0] hover:text-white"
              }`}
            >
              <span className="relative text-lg">
                {item.icon}
                {item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-black text-black shadow-md animate-pulse">
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
