"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth-context";

export default function Login() {
  const router = useRouter();
  const { signInWithGoogle, signInWithOtp, verifyOtp, signInWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [authMode, setAuthMode] = useState<"otp" | "password">("otp");
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

  const handleSendOtp = async (e: React.FormEvent) => {
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
      setOtpSent(true);
      setMessage(msg || `6-digit verification code sent to ${email.trim()}!`);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !otpCode.trim()) return;
    setLoading(true);
    setError(null);

    const { error: err, onboardingComplete } = await verifyOtp(email.trim(), otpCode.trim());
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      router.push(onboardingComplete ? "/discover" : "/onboarding");
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
          OR VERIFY WITH COLLEGE EMAIL
          <span className="h-px flex-1 bg-white/10" />
        </div>

        {/* Mode Toggle */}
        <div className="mt-4 flex rounded-xl bg-white/5 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => {
              setAuthMode("otp");
              setError(null);
              setMessage(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              authMode === "otp"
                ? "bg-[#ffd166] text-black shadow"
                : "text-[#aab0d0] hover:text-white"
            }`}
          >
            ✉️ College Email Link / Code
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode("password");
              setError(null);
              setMessage(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              authMode === "password"
                ? "bg-[#ffd166] text-black shadow"
                : "text-[#aab0d0] hover:text-white"
            }`}
          >
            🔑 Password
          </button>
        </div>

        {/* 6-Digit Code Mode (OTP) */}
        {authMode === "otp" ? (
          !otpSent ? (
            <form onSubmit={handleSendOtp} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#c5c9e8]">
                  Official College Email (@bmsce.ac.in)
                </label>
                <input
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus:border-[#ffd166] text-white"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. yourname.cs24@bmsce.ac.in"
                  required
                />
                <p className="mt-1.5 text-[11px] text-[#73789e]">
                  We will send a 6-digit code to this inbox to verify ownership.
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full text-sm font-bold bg-[#ffd166] text-black hover:bg-[#ffd166]/90"
              >
                {loading ? "Sending Code..." : "Send 6-Digit Verification Code →"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mt-5 space-y-4">
              <div className="rounded-xl border border-[#ffd166]/30 bg-[#ffd166]/10 p-3.5 text-xs text-[#ffd166]">
                <p className="font-bold flex items-center gap-1.5 mb-1">
                  <span>📬</span> Verification email sent to {email}
                </p>
                <p className="text-[#e2e4f0] leading-relaxed">
                  You can <b>click the "Sign in" link in your email</b> to log in directly! Or, if your email includes a 6-digit code, enter it below:
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-[#c5c9e8]">
                    Enter 6-Digit Code (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode("");
                    }}
                    className="text-[11px] text-[#ffd166] hover:underline"
                  >
                    Change email
                  </button>
                </div>
                <input
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 p-3.5 text-center text-2xl font-mono font-black tracking-[0.3em] outline-none focus:border-[#ffd166] text-white"
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="w-full text-sm font-bold bg-[#ffd166] text-black hover:bg-[#ffd166]/90"
              >
                {loading ? "Verifying..." : "Verify Code & Sign In 🪩"}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="text-xs text-[#aab0d0] hover:text-[#ffd166] transition underline"
                >
                  Resend 6-digit code
                </button>
              </div>
            </form>
          )
        ) : (
          /* Password Mode */
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
                placeholder="e.g. yourname.cs23@bmsce.ac.in"
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
              {loading ? "Signing in..." : "Sign In with Password"}
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
