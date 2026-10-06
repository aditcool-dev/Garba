import { errorReference } from "./lib/error-reference";

export function onRequestError(error: Error & { digest?: string }, request: { path: string; method: string }) {
  console.error("[GarbaMate server error]", {
    reference: errorReference(error), message: error.message, stack: error.stack,
    digest: error.digest, route: request.path.split("?")[0], method: request.method,
  });
}
