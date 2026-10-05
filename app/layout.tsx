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
    <html lang="en">
      <body>
        <AuthProvider><RelationshipsProvider>{children}</RelationshipsProvider></AuthProvider>
      </body>
    </html>
  );
}

