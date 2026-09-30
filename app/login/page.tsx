"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth-context";

export default function Login() {
  const router = useRouter();
  const { signInWithGoogle, signInWithOtp, signInWithPassword } = useAuth();
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

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: err, onboardingComplete } = await signInWithPassword(email, password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      router.push(onboardingComplete ? "/discover" : "/onboarding");
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
      setMessage(msg || "Check your email for the magic link. You will be redirected after verification.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <Card className="w-full max-w-md border-white/10 shadow-2xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-[#ffd166] hover:underline">
            ← Back to Home
          </Link>
        </div>

        <h1 className="mt-6 text-3xl font-black">Welcome back 👋</h1>
        <p className="mt-2 text-sm text-[#aab0d0]">
          Sign in to view student profiles, browse matches, and chat safely.
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

        {/* Google OAuth */}
        <Button
          onClick={handleGoogle}
          disabled={loading}
          className="mt-6 w-full flex items-center justify-center gap-2"
        >
          <span>🌐</span>
          <span>Continue with Google</span>
        </Button>

        <div className="my-6 flex items-center gap-3 text-xs text-[#73789e]">
          <span className="h-px flex-1 bg-white/10" />
          OR WITH EMAIL
          <span className="h-px flex-1 bg-white/10" />
        </div>

        {/* Mode Toggle */}
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
            Password Sign In
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
          <form onSubmit={handlePasswordLogin} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#c5c9e8]">
                College Email (@bmsce.ac.in)
              </label>
              <input
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus:border-[#ffd166] text-white"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. aditya.cs23@bmsce.ac.in"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#c5c9e8]">
                Password
              </label>
              <input
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus:border-[#ffd166] text-white"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full text-sm font-bold bg-[#ffd166] text-black hover:bg-[#ffd166]/90"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
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
                placeholder="e.g. aditya.cs23@bmsce.ac.in"
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

        <p className="mt-6 text-center text-sm text-[#aab0d0]">
          New here?{" "}
          <Link className="font-semibold text-[#ffd166] hover:underline" href="/signup">
            Create your profile
          </Link>
        </p>
      </Card>
    </main>
  );
}
