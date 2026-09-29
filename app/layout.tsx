import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "GarbaMate — Find your Garba partner", description: "A safe BMSCE campus partner finder for Navratri." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
