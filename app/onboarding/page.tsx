"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button, Card, Badge } from "@/components/ui";
import { BRANCHES } from "@/config/branches";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/supabase/storage";

const GARBA_STYLES = [
  "Traditional Garba",
  "Bollywood Garba",
  "Dandiya",
  "2-Taali",
  "3-Taali",
  "Fast Garba",
  "Any",
];

const AVAILABLE_INTERESTS = [
  "dance",
  "music",
  "food",
  "fashion",
  "photography",
  "coding",
  "fitness",
  "festivals",
];

const AVATAR_EMOJIS = ["🌸", "🕺", "💃", "🥻", "✨", "🥁", "⚡", "🎉"];

export default function Onboarding() {
  const router = useRouter();
  const { user, profile: existingProfile, demoLogin, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);

  // Form states
  const [firstName, setFirstName] = useState(existingProfile?.first_name || "");
  const [age, setAge] = useState<number>(existingProfile?.age || 20);
  const [branch, setBranch] = useState(existingProfile?.branch || "CSE");
  const [year, setYear] = useState<number>(existingProfile?.year || 2);
  const [bio, setBio] = useState(existingProfile?.bio || "");
  const [experience, setExperience] = useState(existingProfile?.experience || "Intermediate");
  const [selectedStyles, setSelectedStyles] = useState<string[]>(
    existingProfile?.styles || ["Traditional Garba", "Bollywood Garba"]
  );
  const [selectedNights, setSelectedNights] = useState<number[]>(
    existingProfile?.available_nights || [2, 4, 7]
  );
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    existingProfile?.interests || ["dance", "music"]
  );
  const [photo, setPhoto] = useState<string>(existingProfile?.photo_path || "🌸");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const userId = user?.id || "current-user";
    const { url, error } = await uploadAvatar(userId, file);
    if (!error && url) {
      setPhoto(url);
    } else {
      alert(error || "Upload failed");
    }
    setUploading(false);
  };

  const toggleStyle = (style: string) => {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  const toggleNight = (night: number) => {
    setSelectedNights((prev) =>
      prev.includes(night) ? prev.filter((n) => n !== night) : [...prev, night]
    );
  };

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests((prev) => prev.filter((i) => i !== interest));
    } else if (selectedInterests.length < 6) {
      setSelectedInterests((prev) => [...prev, interest]);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    let currentUserId = user?.id;

    if (!currentUserId) {
      router.push("/login");
      return;
    }

    await db.upsertProfile({
      id: currentUserId,
      first_name: firstName || "Student",
      age: Number(age) || 20,
      gender: "Prefer not to say",
      branch,
      year: Number(year) || 2,
      bio: bio || "Excited for BMSCE Navratri!",
      experience,
      styles: selectedStyles.length ? selectedStyles : ["Traditional Garba"],
      looking_for: ["Garba partner"],
      available_nights: selectedNights.length ? selectedNights : [1, 2, 3],
      interests: selectedInterests.length ? selectedInterests : ["dance"],
      partner_preference: "Everyone",
      photo_path: photo,
      onboarding_complete: true,
      is_hidden: false,
      is_suspended: false,
      is_banned: false,
    });

    await refreshProfile();
    setSaving(false);
    router.push("/discover");
  };

  return (
    <AppShell title={`Profile setup · ${step}/6`}>
      <div className="mx-auto max-w-xl">
        <div className="mb-6 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-[#f35ca8] to-[#ffd166] transition-all duration-300"
            style={{ width: `${(step / 6) * 100}%` }}
          />
        </div>

        <Card className="border-white/10 shadow-2xl p-7">
          <p className="text-xs font-bold text-[#ffd166] uppercase tracking-wider">Step {step} of 6</p>
          <h1 className="mt-2 text-3xl font-black">
            {step === 1 && "Choose your festival avatar"}
            {step === 2 && "The basics"}
            {step === 3 && "Your Garba vibe"}
            {step === 4 && "Which Navratri nights?"}
            {step === 5 && "Interests & tags"}
            {step === 6 && "Profile preview"}
          </h1>
          <p className="mt-2 text-xs text-[#aab0d0]">
            {step === 1 && "Upload your photo to Supabase Storage or select a festival emoji."}
            {step === 2 && "Verified BMSCE campus details."}
            {step === 3 && "Select your skill level and favourite dance styles."}
            {step === 4 && "Nights you plan to attend on campus."}
            {step === 5 && "Pick up to 6 interests for compatibility matching."}
            {step === 6 && "Check how other students will see your card."}
          </p>

          {/* STEP 1: Avatar */}
          {step === 1 && (
            <div className="mt-8 flex flex-col items-center gap-6">
              <div className="flex h-36 w-36 items-center justify-center rounded-full border-2 border-dashed border-[#f35ca8] bg-white/5 text-6xl overflow-hidden shadow-inner">
                {photo.startsWith("http") || photo.startsWith("data:") ? (
                  <img src={photo} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  photo
                )}
              </div>

              <div>
                <label className="cursor-pointer rounded-full bg-[#292d58] hover:bg-[#343a6d] px-5 py-2.5 text-xs font-bold text-white transition inline-block">
                  {uploading ? "Uploading..." : "📷 Upload Custom Photo"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="text-center">
                <p className="text-xs text-[#aab0d0] mb-3">Or choose a festival avatar:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {AVATAR_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setPhoto(emoji)}
                      className={`h-11 w-11 rounded-2xl text-2xl transition border ${
                        photo === emoji
                          ? "border-[#ffd166] bg-[#ffd166]/20 scale-110"
                          : "border-white/10 bg-white/5 hover:border-white/30"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Basics */}
          {step === 2 && (
            <div className="mt-7 grid gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#c5c9e8] mb-1">First Name</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-xl bg-white/5 p-3 text-white border border-white/10 outline-none focus:border-[#ffd166]"
                  placeholder="e.g. Aditya"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#c5c9e8] mb-1">Age (18+)</label>
                  <input
                    type="number"
                    min={18}
                    max={30}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full rounded-xl bg-white/5 p-3 text-white border border-white/10 outline-none focus:border-[#ffd166]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#c5c9e8] mb-1">Year</label>
                  <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full rounded-xl bg-white/5 p-3 text-white border border-white/10 outline-none focus:border-[#ffd166]"
                  >
                    <option value={1}>1st year</option>
                    <option value={2}>2nd year</option>
                    <option value={3}>3rd year</option>
                    <option value={4}>4th year</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c5c9e8] mb-1">Branch</label>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full rounded-xl bg-white/5 p-3 text-white border border-white/10 outline-none focus:border-[#ffd166]"
                >
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c5c9e8] mb-1">Bio (max 200 chars)</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={200}
                  rows={3}
                  className="w-full rounded-xl bg-white/5 p-3 text-white border border-white/10 outline-none focus:border-[#ffd166]"
                  placeholder="Share your Garba energy, favorite songs, or who you want to meet!"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Garba Vibe */}
          {step === 3 && (
            <div className="mt-7 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-[#c5c9e8] mb-2">Dance Experience</label>
                <div className="grid grid-cols-2 gap-2">
                  {["Beginner", "Intermediate", "Advanced", "Just for Fun 😂"].map((item) => (
                    <button
                      key={item}
                      onClick={() => setExperience(item)}
                      className={`rounded-xl border p-3.5 text-left text-xs font-semibold transition ${
                        experience === item
                          ? "border-[#ffd166] bg-[#ffd166]/15 text-[#ffd166]"
                          : "border-white/10 bg-white/5 text-[#c5c9e8] hover:border-white/30"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#c5c9e8] mb-2">Favourite Styles</label>
                <div className="flex flex-wrap gap-2">
                  {GARBA_STYLES.map((style) => (
                    <button
                      key={style}
                      onClick={() => toggleStyle(style)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition border ${
                        selectedStyles.includes(style)
                          ? "border-[#f35ca8] bg-[#f35ca8]/20 text-[#ffb5dc]"
                          : "border-white/10 bg-white/5 text-[#aab0d0] hover:border-white/30"
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Nights */}
          {step === 4 && (
            <div className="mt-7">
              <label className="block text-xs font-semibold text-[#c5c9e8] mb-3">
                Select the nights you plan to dance at BMSCE:
              </label>
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => toggleNight(n)}
                    className={`rounded-2xl border p-4 text-center transition ${
                      selectedNights.includes(n)
                        ? "border-[#ffd166] bg-[#ffd166]/20 text-[#ffd166] font-bold shadow-lg"
                        : "border-white/10 bg-white/5 text-[#c5c9e8] hover:border-white/30"
                    }`}
                  >
                    <span className="block text-base">Day {n}</span>
                    <span className="text-[10px] text-[#aab0d0]">
                      {n === 1 || n === 9 ? "Grand Night" : "Regular"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: Interests */}
          {step === 5 && (
            <div className="mt-7 space-y-4">
              <label className="block text-xs font-semibold text-[#c5c9e8]">
                Select up to 6 interests for better algorithm compatibility:
              </label>
              <div className="flex flex-wrap gap-2.5">
                {AVAILABLE_INTERESTS.map((interest) => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition border ${
                      selectedInterests.includes(interest)
                        ? "border-[#ff8b4d] bg-[#ff8b4d]/20 text-[#ffd166]"
                        : "border-white/10 bg-white/5 text-[#aab0d0] hover:border-white/30"
                    }`}
                  >
                    #{interest}
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-2xl bg-white/5 p-4 text-xs text-[#aab0d0] leading-5 border border-white/5">
                🛡️ <b>College Safety Commitment:</b> You confirm you are 18+, a current BMSCE student, and agree to meet only in safe public festival grounds with friends.
              </div>
            </div>
          )}

          {/* STEP 6: Preview */}
          {step === 6 && (
            <div className="mt-7 rounded-2xl bg-white/5 p-5 border border-white/10 text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-5xl overflow-hidden border border-white/20">
                {photo.startsWith("http") || photo.startsWith("data:") ? (
                  <img src={photo} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  photo
                )}
              </div>
              <h2 className="mt-3 text-2xl font-bold text-white">
                {firstName || "Student"}, {age}
              </h2>
              <p className="text-xs text-[#ffd166] mt-0.5">
                {branch} · Year {year} · {experience}
              </p>
              <p className="mt-3 text-sm text-[#c5c9e8] italic">&quot;{bio || "Ready for Garba!"}&quot;</p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {selectedNights.map((n) => (
                  <Badge key={n} className="bg-[#f35ca8]/20 text-[#ffb1d8]">
                    Day {n}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-8 flex justify-between gap-3">
            <Button
              variant="ghost"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              Back
            </Button>
            {step < 6 ? (
              <Button onClick={() => setStep((s) => Math.min(6, s + 1))}>
                Continue
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={saving}>
                {saving ? "Saving Profile..." : "Start Discovering"}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
