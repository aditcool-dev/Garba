"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const links = [["⌂", "Discover", "/discover"], ["♥", "Matches", "/matches"], ["☵", "Chats", "/chat/demo"], ["●", "Profile", "/profile/me"]];
export function Nav() { const path = usePathname(); return <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-[#090b24]/95 px-3 py-2 backdrop-blur md:sticky md:top-0 md:flex md:justify-center md:border-0 md:bg-transparent"><div className="flex max-w-3xl flex-1 justify-around md:gap-8">{links.map(([icon, label, href]) => <Link key={href} href={href} className={`flex min-h-11 flex-col items-center justify-center text-xs ${path.startsWith(href.split("/")[1] ? `/${href.split("/")[1]}` : href) ? "text-[#ffd166]" : "text-[#aab0d0]"}`}><span className="text-lg">{icon}</span>{label}</Link>)}</div></nav>; }
