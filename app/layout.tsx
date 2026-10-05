import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/supabase/auth-context";
import { RelationshipsProvider } from "@/lib/relationships-context";

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
        <AuthProvider><RelationshipsProvider>{children}</RelationshipsProvider></AuthProvider>
      </body>
    </html>
  );
}

