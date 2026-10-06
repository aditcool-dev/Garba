import type { Profile } from "@/lib/supabase/types";

export const TUTORIAL_COPY = {
  skip: "Skip tutorial", next: "Next", back: "Back", start: "Start discovering", try: "Try it", practice: "Practice card — no decisions are sent", like: "Interested", pass: "Pass", vibe: "Garba Vibe", steps: "Tutorial steps", demo: "Practice only", shortcuts: "Keyboard: ← → ↑", instructions: "Use arrows or Enter to continue. Esc skips.",
  stepsContent: [
    { title: "Welcome to the floor 🪩", text: "Welcome to GarbaMate 🪩. Find your Garba partner in 4 quick moves." },
    { title: "Interested →", text: "Swipe right (or tap ❤️) if you'd like to dance together." },
    { title: "← Pass", text: "Swipe left (or tap ✕) to skip. No one is told." },
    { title: "Garba Vibe ⭐", text: "Really want to dance with someone? Send a Garba Vibe (limited per day)." },
    { title: "A little more about them", text: "Tap a card to see their nights, styles and bio." },
    { title: "Find your overlap", text: "Gold nights overlap with yours. The score is just for fun." },
    { title: "Match & chat", text: "When you both pick each other, it's a Garba Match. Say hello in Chats." },
    { title: "Your choice, always", text: "Change your mind? Unmatch, report or block anytime from a profile or chat." },
    { title: "Keep it public and kind", text: "Meet first at the official event, with friends, in public." },
  ],
  menu: ["Unmatch", "Report", "Block"], details: "Nights · Styles · Bio", safety: "Official event · Friends · Public", match: "It's a Garba Match!", hello: "Say hello in Chats", finger: "Drag the demo card or tap a practice button", detailsHint: "Tap to preview details", progress: (step: number) => `Step ${step} of 9`, goTo: (step: number) => `Go to step ${step}`,
};

export const TUTORIAL_PROFILE: Profile = {
  id: "tutorial-practice-only", first_name: "Practice Dancer", age: 20, gender: "Prefer not to say", branch: "BMSCE", year: 2,
  bio: "Practice only. No likes, passes, matches or quotas change.", experience: "Beginner", styles: ["Dandiya", "Traditional Garba"], looking_for: ["Garba partner"], available_nights: [1,2,4,7,9], interests: ["dance"], partner_preference: "Everyone", photo_path: null, is_hidden: false, is_suspended: false, is_banned: false, onboarding_complete: true, is_demo: true, created_at: "2026-01-01", updated_at: "2026-01-01",
};
