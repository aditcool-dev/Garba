import type { Profile } from "./supabase/types";

/**
 * A decision must advance the rendered stack even when the server operation is
 * idempotent and the source status list is unchanged (notably Pass → Pass).
 */
export function removeDecidedProfile(stack: readonly Profile[], profileId: string): Profile[] {
  return stack.filter((profile) => profile.id !== profileId);
}
