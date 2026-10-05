import Link from "next/link";
import { Button, Card } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <Card className="w-full max-w-md text-center">
        <div className="text-5xl">🪩</div>
        <h1 className="mt-4 text-3xl font-black">404 - Not Found</h1>
        <p className="mt-2 text-sm text-[#aab0d0]">
          The page you are looking for doesn&apos;t exist or has moved.
        </p>
        <Link href="/" className="mt-6 inline-block">
          <Button>Back to Home</Button>
        </Link>
      </Card>
    </main>
  );
}
