"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-context";
const links = [["⌂", "Discover", "/discover"], ["♥", "Matches", "/matches"], ["☵", "Chats", "/chat/demo"], ["●", "Profile", "/profile/me"]];
export function Nav() { const path = usePathname() || ""; const { user } = useAuth(); const visibleLinks = user ? links : [["⌂", "Discover", "/discover"], ["→", "Sign in", "/login"]]; return <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-[#090b24]/95 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:sticky md:top-0 md:flex md:justify-center md:border-0 md:bg-transparent"><div className="flex max-w-3xl flex-1 justify-around md:gap-8">{visibleLinks.map(([icon, label, href]) => <Link key={href} href={href} className={`flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 rounded-xl text-xs transition ${path.startsWith(`/${href.split("/")[1]}`) ? "text-[#ffd166]" : "text-[#aab0d0]"}`}><span className="text-lg">{icon}</span>{label}</Link>)}</div></nav>; }

