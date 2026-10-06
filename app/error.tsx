"use client";

import { useEffect, useState } from "react";
import { errorReference } from "@/lib/error-reference";
import { Button, Card } from "@/components/ui";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reference = errorReference(error);
  const [debug, setDebug] = useState(process.env.NODE_ENV === "development");
  useEffect(() => {
    const route = location.pathname;
    console.error("[GarbaMate error]", { reference, message: error.message, stack: error.stack, digest: error.digest, route });
    setDebug(process.env.NODE_ENV === "development" || new URLSearchParams(location.search).get("debug") === "1");
  }, [error, reference]);

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <Card className="w-full max-w-md text-center">
        <div className="text-5xl">⚠️</div>
        <h1 className="mt-4 text-3xl font-black">Something went wrong</h1>
        <p className="mt-2 text-sm text-[#aab0d0]">
          An unexpected error occurred. Please try again.
        </p>
        <p className="mt-3 text-xs text-[#aaa8d0]">Error reference: <code>{reference}</code></p>
        {debug && <pre className="mt-3 whitespace-pre-wrap break-words text-left text-xs">{error.message}</pre>}
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
