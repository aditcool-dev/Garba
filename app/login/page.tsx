"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth-context";

function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export default function Login() {
  const router = useRouter();
  const { signInWithGoogle, signInWithOtp, signInWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [authMode, setAuthMode] = useState<"link" | "password">("link");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tapCount, setTapCount] = useState(0);

  const handleAdminTap = () => {
    const next = tapCount + 1;
    if (next >= 5) {
      setTapCount(0);
      router.push("/admin");
    } else {
      setTapCount(next);
      setTimeout(() => setTapCount(0), 2500);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    const { error: err } = await signInWithGoogle();
    if (err) {
      setError(err);
      setGoogleLoading(false);
    }
  };

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: err, message: msg } = await signInWithOtp(email.trim());
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setLinkSent(true);
      setMessage(msg || `Sign-in link sent to ${email.trim()}!`);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: err } = await signInWithPassword(email, password);
    setLoading(false);
    if (err) {
      setError(err);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* Background ambient decorative glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-amber-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-rose-500/10 blur-[120px]" />

      <Card className="relative z-10 w-full max-w-md border-white/10 bg-[#101428]/95 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="group flex items-center gap-1.5 text-xs font-semibold text-[#ffd166] transition hover:text-white"
          >
            <span className="transition-transform group-hover:-translate-x-0.5">←</span>
            <span>Back to Home</span>
          </Link>
          <span
            onClick={handleAdminTap}
            className="text-[11px] font-bold text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full cursor-pointer select-none active:scale-95 transition"
            title="BMSCE Garba Night"
          >
            BMSCE Garba Night 🪩
          </span>
        </div>

        {/* Heading Section */}
        <div className="mt-6 text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Welcome back 👋
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-[#aab0d0] leading-relaxed">
            Sign in to connect with BMSCE Garba partners, view outfits, and hit the dance circles together.
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            {error}
          </div>
        )}

        {message && !linkSent && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            {message}
          </div>
        )}

        {/* EYE-CATCHING GOOGLE SIGN IN BUTTON */}
        <div className="mt-6">
          <button
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            type="button"
            className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-amber-400 via-[#ffd166] to-amber-300 p-[2px] shadow-lg shadow-amber-500/15 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/25 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            <div className="flex items-center justify-between rounded-[14px] bg-[#ffffff] px-4 py-3.5 text-slate-900 transition-colors group-hover:bg-amber-50/70">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm border border-slate-200">
                  <GoogleIcon className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-black tracking-tight text-slate-900">
                      Continue with Google
                    </span>
                    <span className="inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-800 border border-amber-300/80">
                      (Easy & Recommended)
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-600">
                    1-Click instant sign-in with @bmsce.ac.in
                  </p>
                </div>
              </div>
              <span className="text-base font-black text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-amber-600">
                →
              </span>
            </div>
          </button>
        </div>

        {/* Crisp Divider */}
        <div className="my-6 flex items-center gap-3 text-[11px] font-bold tracking-wider text-[#73789e]">
          <span className="h-px flex-1 bg-white/10" />
          OR WITH COLLEGE EMAIL
          <span className="h-px flex-1 bg-white/10" />
        </div>

        {/* Mode Toggle Tabs */}
        <div className="flex rounded-xl bg-white/5 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => {
              setAuthMode("link");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              authMode === "link"
                ? "bg-[#ffd166] text-black shadow-md font-black"
                : "text-[#aab0d0] hover:text-white"
            }`}
          >
            ✉️ Email Magic Link
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode("password");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              authMode === "password"
                ? "bg-[#ffd166] text-black shadow-md font-black"
                : "text-[#aab0d0] hover:text-white"
            }`}
          >
            🔑 Password
          </button>
        </div>

        {/* Content based on tab */}
        {authMode === "link" ? (
          !linkSent ? (
            /* Email Link Request Form */
            <form onSubmit={handleSendLink} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#c5c9e8]">
                  BMSCE College Email
                </label>
                <div className="relative mt-1.5">
                  <input
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-3 pr-24 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#ffd166] focus:bg-white/[0.08]"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="aditya.cs24@bmsce.ac.in"
                    required
                  />
                  <span className="pointer-events-none absolute right-3 top-3 select-none text-[11px] font-bold text-[#ffd166]/70">
                    @bmsce.ac.in
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-[#73789e]">
                  We will email you a secure sign-in link. No passwords to remember!
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full text-sm font-bold bg-[#ffd166] text-black hover:bg-[#ffd166]/90 py-3 shadow-md"
              >
                {loading ? "Sending Link..." : "Send Secure Sign-In Link →"}
              </Button>
            </form>
          ) : (
            /* Link Sent State */
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
                <div className="text-4xl mb-2">📬</div>
                <h3 className="text-base font-bold text-white">Check Your Inbox</h3>
                <p className="mt-1.5 text-xs text-[#c5c9e8] leading-relaxed">
                  We sent a sign-in link to:
                </p>
                <p className="mt-1 font-semibold text-white text-sm bg-black/30 py-1 px-3 rounded-lg inline-block border border-white/10 font-mono">
                  {email}
                </p>
                <p className="mt-3 text-xs text-[#aab0d0] leading-relaxed">
                  Click the <b>"Sign in"</b> button in that email. Once you click it, this page will automatically log you in!
                </p>
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-2 text-xs text-[#ffd166]">
                  <span className="h-2 w-2 rounded-full bg-[#ffd166] animate-pulse" />
                  <span>Waiting for email link verification...</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 pt-1 text-center">
                <button
                  type="button"
                  onClick={handleSendLink}
                  disabled={loading}
                  className="text-xs text-[#ffd166] hover:underline font-semibold"
                >
                  Didn't receive the email? Resend link
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLinkSent(false);
                    setError(null);
                  }}
                  className="text-xs text-[#73789e] hover:text-white"
                >
                  Use a different email address
                </button>
              </div>
            </div>
          )
        ) : (
          /* Password Form */
          <form onSubmit={handlePasswordLogin} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#c5c9e8]">
                BMSCE College Email
              </label>
              <input
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none transition focus:border-[#ffd166] text-white placeholder-white/30"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aditya.cs24@bmsce.ac.in"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#c5c9e8]">
                Password
              </label>
              <input
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none transition focus:border-[#ffd166] text-white placeholder-white/30"
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
              className="w-full text-sm font-bold bg-[#ffd166] text-black hover:bg-[#ffd166]/90 py-3 shadow-md"
            >
              {loading ? "Signing in..." : "Sign In with Password"}
            </Button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-6 pt-5 border-t border-white/10 text-center">
          <p className="text-xs text-[#aab0d0]">
            Don't have an account yet?{" "}
            <Link className="font-bold text-[#ffd166] hover:underline" href="/signup">
              Create your profile →
            </Link>
          </p>
          <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-[#73789e]">
            <span className="flex items-center gap-1">🔒 Verified BMSCE Only</span>
            <span>·</span>
            <span className="flex items-center gap-1">🛡️ Safe Student Campus</span>
          </div>
        </div>
      </Card>
    </main>
  );
}
