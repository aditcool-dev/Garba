"use client";
import ErrorPage from "./error";
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body className="bg-[#0a0820] text-white"><ErrorPage {...props} /></body></html>;
}
