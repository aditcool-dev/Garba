import Link from "next/link";
import { AUTH_ERRORS, type AuthErrorReason } from "@/lib/auth-flow";
import { Card } from "@/components/ui";

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason: requested } = await searchParams;
  const reason: AuthErrorReason = requested && Object.prototype.hasOwnProperty.call(AUTH_ERRORS, requested) ? requested as AuthErrorReason : "callback";
  const signedIn = reason === "profile";
  return <main className="flex min-h-[100dvh] items-center justify-center px-4 py-12">
    <Card className="w-full max-w-md p-6 text-center sm:p-8">
      <p className="display-font text-xl font-bold"><span className="text-[#ffd166]">Garba</span>Mate</p>
      <h1 className="mt-6 text-2xl font-bold">{signedIn ? "You’re signed in" : reason === "network" ? "Unable to finish sign-in" : "Unable to sign you in"}</h1>
      <p role="alert" className="mt-3 text-sm leading-6 text-[#aaa8d0]">{AUTH_ERRORS[reason]}</p>
      <Link href={signedIn ? "/auth/callback" : "/login"} prefetch={false} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[#ffd166] px-6 font-bold"><span className="text-[#100a2c]">{signedIn ? "Retry profile lookup" : "Try Again"}</span></Link>
      <Link href="/" className="mt-4 block text-xs text-[#aaa8d0]">Back to Home</Link>
    </Card>
  </main>;
}
