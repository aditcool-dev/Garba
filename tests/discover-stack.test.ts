import { describe, expect, it } from "vitest";
import { removeDecidedProfile } from "../lib/discover-stack";
import type { Profile } from "../lib/supabase/types";

const profile = (id: string) => ({ id, first_name: id, age: 20, gender: "Woman", branch: "CSE", year: 2, bio: "", experience: "Beginner", styles: [], looking_for: [], available_nights: [], interests: [], partner_preference: "Everyone", photo_path: "🌸", is_hidden: false, is_suspended: false, is_banned: false, onboarding_complete: true, is_demo: false, created_at: "", updated_at: "" }) as Profile;

describe("discover stack decisions", () => {
  it("advances a Passed stack when Pass is an idempotent server no-op", () => {
    const stack = [profile("passed-1"), profile("passed-2"), profile("passed-3")];
    expect(removeDecidedProfile(stack, "passed-1").map((item) => item.id)).toEqual(["passed-2", "passed-3"]);
  });
});
