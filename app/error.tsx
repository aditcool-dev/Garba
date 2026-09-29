"use client";

import { useEffect } from "react";
import { Button, Card } from "@/components/ui";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <Card className="w-full max-w-md text-center">
        <div className="text-5xl">⚠️</div>
        <h1 className="mt-4 text-3xl font-black">Something went wrong</h1>
        <p className="mt-2 text-sm text-[#aab0d0]">
          An unexpected error occurred. Please try again.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="secondary" onClick={() => (window.location.href = "/")}>
            Back to Home
          </Button>
        </div>
      </Card>
    </main>
  );
}
