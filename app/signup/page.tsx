"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth-context";

export default function Signup() {
  const router = useRouter();
  const { signInWithGoogle, signInWithOtp, signUpWithPassword, demoLogin, isConfigured } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"password" | "magic">("password");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    const { error: err } = await signInWithGoogle();
    if (err) {
      setError(err);
      setLoading(false);
    }
  };

  const handlePasswordSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: err, message: msg } = await signUpWithPassword(email, password, firstName);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setMessage(msg || "Account created successfully!");
      setTimeout(() => {
        router.push("/onboarding");
      }, 1200);
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: err, message: msg } = await signInWithOtp(email);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setMessage(msg || "Magic link sent! Check your inbox. You will be redirected after verification.");
    }
  };

  const handleDemo = async () => {
    setLoading(true);
    await demoLogin("newstudent.cs24@bmsce.ac.in", "Student");
    router.push("/onboarding");
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <Card className="w-full max-w-md border-white/10 shadow-2xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-[#ffd166] hover:underline">
            ← Back to Home
          </Link>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-[#aab0d0]">
            {isConfigured ? "Supabase Live" : "Demo Mode"}
          </span>
        </div>

        <h1 className="mt-6 text-3xl font-black">Join the floor 🪩</h1>
        <p className="mt-2 text-sm text-[#aab0d0]">
          Only verified <b className="text-white">@bmsce.ac.in</b> students can create profiles and find Garba partners.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            {message}
          </div>
        )}

        <Button
          onClick={handleGoogle}
          disabled={loading}
          className="mt-6 w-full flex items-center justify-center gap-2"
        >
          <span>🌐</span>
          <span>Sign up with Google</span>
        </Button>

        {/* Sign up form toggle */}
        <div className="mt-6 flex rounded-xl bg-white/5 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => setAuthMode("password")}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              authMode === "password"
                ? "bg-[#ffd166] text-black shadow"
                : "text-[#aab0d0] hover:text-white"
            }`}
          >
            Direct Password Sign Up
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("magic")}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              authMode === "magic"
                ? "bg-[#ffd166] text-black shadow"
                : "text-[#aab0d0] hover:text-white"
            }`}
          >
            Magic Link
          </button>
        </div>

        {authMode === "password" ? (
          <form onSubmit={handlePasswordSignup} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#c5c9e8]">
                First Name
              </label>
              <input
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus:border-[#ffd166] text-white"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Adit"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#c5c9e8]">
                College Email (@bmsce.ac.in)
              </label>
              <input
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus:border-[#ffd166] text-white"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname.branch24@bmsce.ac.in"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#c5c9e8]">
                Password (min. 6 characters)
              </label>
              <input
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus:border-[#ffd166] text-white"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full text-sm font-bold bg-[#ffd166] text-black hover:bg-[#ffd166]/90"
            >
              {loading ? "Creating in Supabase..." : "Create Live Supabase Account"}
            </Button>
            <p className="text-[11px] text-[#73789e] text-center">
              Writes instantly to your Supabase Auth & public profiles table.
            </p>
          </form>
        ) : (
          <form onSubmit={handleOtp} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#c5c9e8]">
                College Email (@bmsce.ac.in)
              </label>
              <input
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus:border-[#ffd166] text-white"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname.branch24@bmsce.ac.in"
                required
              />
            </div>

            <Button
              type="submit"
              variant="secondary"
              disabled={loading}
              className="w-full text-sm font-bold"
            >
              {loading ? "Sending..." : "Send Magic Link"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs leading-5 text-[#aab0d0]">
          By continuing, you agree to our{" "}
          <Link className="text-[#ffd166] hover:underline" href="/guidelines">
            Community Guidelines
          </Link>{" "}
          and{" "}
          <Link className="text-[#ffd166] hover:underline" href="/privacy">
            Privacy Policy
          </Link>
          .
        </p>

        <p className="mt-6 text-center text-sm text-[#aab0d0]">
          Already have an account?{" "}
          <Link className="font-semibold text-[#ffd166] hover:underline" href="/login">
            Sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
