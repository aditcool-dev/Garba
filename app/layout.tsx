import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/supabase/auth-context";
import { RelationshipsProvider } from "@/lib/relationships-context";
import { AuthGate } from "@/components/auth-gate";

export const metadata: Metadata = {
  title: "GarbaMate — Find your Garba partner",
  description: "A safe BMSCE campus partner finder for Navratri.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark bg-[#0a0820] text-[#f8f7ff]">
      <body className="min-h-screen bg-[#0a0820] text-[#f8f7ff] antialiased">
        <AuthProvider><AuthGate><RelationshipsProvider>{children}</RelationshipsProvider></AuthGate></AuthProvider>
      </body>
    </html>
  );
}
