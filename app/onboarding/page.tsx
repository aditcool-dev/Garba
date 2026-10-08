"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { BRANCHES } from "@/config/branches";
import { useAuth } from "@/lib/supabase/auth-context";
import { db, getSupabaseClient } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/supabase/storage";
import { isEligibleAccount, validateAge } from "@/lib/auth-flow";

function isImageSrc(src?: string | null): boolean {
  if (!src) return false;
  const value = src.trim();
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:") || value.startsWith("/") || value.startsWith("blob:");
}

const TOTAL_STEPS = 10;

const GARBA_STYLES = ["Traditional Garba", "Bollywood Garba", "Dandiya", "2-Taali", "3-Taali", "Fast Garba", "Any"];
const AVAILABLE_INTERESTS = ["dance", "music", "food", "fashion", "photography", "coding", "fitness", "festivals"];
const AVATAR_EMOJIS = ["🌸", "🕺", "💃", "🥻", "✨", "🥁", "⚡", "🎉"];

type AuthIdentity = { id?: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown>; identities?: Array<{ provider?: string | null }> };

function reliableIdentityName(account: AuthIdentity | null): string | null {
  const isGoogle = account?.app_metadata?.provider === "google" || account?.identities?.some((identity) => identity.provider === "google");
  if (!account || !isGoogle) return null;
  for (const key of ["full_name", "name", "first_name"]) {
    const value = account.user_metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 40);
  }
  return null;
}

const STEP_TITLES = [
  "Choose your festival avatar",
  "What should we call you?",
  "How old are you?",
  "Which branch are you in?",
  "Which year are you in?",
  "What's your dance comfort level?",
  "Which styles feel like you?",
  "What else are you into?",
  "Add a short intro",
  "Your floor preview",
];

const STEP_DESCRIPTIONS = [
  "A photo or festival emoji makes your card easy to spot.",
  "Use a first name or nickname you're comfortable sharing.",
  "GarbaMate is for verified students aged 18 and over.",
  "Your campus context helps us make better suggestions.",
  "This stays on your private student profile.",
  "There's no wrong answer — just find your rhythm.",
  "Pick as many as you want; your choices shape your matches.",
  "Choose up to six tags that make starting a conversation easy.",
  "One or two lines about your Garba energy is plenty.",
  "Review your card before you step onto the floor.",
];

export default function Onboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditing = searchParams.get("edit") === "1";
  const { user, profile: existingProfile, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);

  const [firstName, setFirstName] = useState(existingProfile?.first_name || "");
  // A scaffold profile's database age is not the student's answer; retain a
  // completed profile's age when this form is opened for editing.
  const [age, setAge] = useState(existingProfile?.onboarding_complete ? String(existingProfile.age) : "");
  const [branch, setBranch] = useState(existingProfile?.branch || "CSE");
  const [year, setYear] = useState<number>(existingProfile?.year || 2);
  const [bio, setBio] = useState(existingProfile?.bio || "");
  const [experience, setExperience] = useState(existingProfile?.experience || "Intermediate");
  const [selectedStyles, setSelectedStyles] = useState<string[]>(existingProfile?.styles || ["Traditional Garba", "Bollywood Garba"]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(existingProfile?.interests || ["dance", "music"]);
  const [photo, setPhoto] = useState<string>(existingProfile?.photo_path || "🌸");
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [identityName, setIdentityName] = useState<string | null>(null);
  const [identityNameLoading, setIdentityNameLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIdentityName(null);
    setIdentityNameLoading(true);
    const loadIdentityName = async () => {
      const client = getSupabaseClient();
      if (!client) { if (active) setIdentityNameLoading(false); return; }
      try {
        const { data, error } = await client.auth.getUser();
        if (!active || error || data.user?.id !== user?.id) return;
        const name = reliableIdentityName(data.user);
        setIdentityName(name);
        if (name) setFirstName(name);
      } catch {
        // The existing authenticated submission check remains authoritative.
      } finally {
        if (active) setIdentityNameLoading(false);
      }
    };
    void loadIdentityName();
    return () => { active = false; };
  }, [user?.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    if (!user) { setUploading(false); setUploadError("Please sign in before uploading a photo."); return; }
    const { url, error } = await uploadAvatar(user.id, file);
    if (!error && url) {
      setPhoto(url);
      setUploadSuccess(true);
    } else {
      setUploadError(error || "Could not process photo");
    }
    setUploading(false);
  };

  const toggleStyle = (style: string) => {
    setSelectedStyles((prev) => (prev.includes(style) ? prev.filter((item) => item !== style) : [...prev, style]));
  };

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests((prev) => prev.filter((item) => item !== interest));
    } else if (selectedInterests.length < 6) {
      setSelectedInterests((prev) => [...prev, interest]);
    }
  };

  const handleFinish = async () => {
    const parsed = validateAge(age);
    if (parsed.error !== null) { setFormError(parsed.error); setStep(3); return; }
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const client = getSupabaseClient();
      const authenticated = client ? await client.auth.getUser() : null;
      const account = authenticated?.data.user || null;
      if (authenticated?.error || !isEligibleAccount(account) || account.id !== user?.id) throw new Error("Your sign-in session expired. Please sign in again.");
      const lockedName = reliableIdentityName(account) || identityName;
      const nameToSave = lockedName || firstName.trim();
      if (!nameToSave) { setFormError("Please enter your first name or nickname."); setStep(2); return; }
      if (lockedName) { setIdentityName(lockedName); setFirstName(lockedName); }
      await db.upsertProfile({
        id: account.id,
        first_name: nameToSave,
        age: parsed.age,
        gender: existingProfile?.gender || "Prefer not to say",
        branch,
        year: Number(year) || 2,
        bio: bio || "Excited for BMSCE Navratri!",
        experience,
        styles: selectedStyles.length ? selectedStyles : ["Traditional Garba"],
        looking_for: existingProfile?.looking_for.length ? existingProfile.looking_for : ["Garba partner"],
        available_nights: existingProfile?.available_nights.length ? existingProfile.available_nights : [1, 2, 3, 4, 5, 6, 7, 8, 9],
        interests: selectedInterests.length ? selectedInterests : ["dance"],
        partner_preference: existingProfile?.partner_preference || "Everyone",
        photo_path: photo,
        onboarding_complete: true,
      });
      await refreshProfile();
      router.replace(isEditing ? "/profile/me" : "/discover");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save your profile. Please try again.");
    } finally { setSaving(false); }
  };

  const handleContinue = () => {
    if (step === 2 && !firstName.trim() && !identityNameLoading) { setFormError("Please enter your first name or nickname."); return; }
    if (step === 3) { const parsed = validateAge(age); if (parsed.error) { setFormError(parsed.error); return; } }
    setFormError(null);
    setStep(current => Math.min(TOTAL_STEPS, current + 1));
  };

  const title = STEP_TITLES[step - 1];
  const description = STEP_DESCRIPTIONS[step - 1];

  return (
    <AppShell title={`${isEditing ? "Edit profile" : "Profile setup"} · ${step}/${TOTAL_STEPS}`}>
      <div className="mx-auto max-w-2xl pb-6">
        <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffd166]">Build your floor card</p><h1 className="display-font mt-1 text-2xl font-bold text-white sm:text-3xl">A few quick questions</h1></div><span className="text-xs font-bold text-[#aaa8d0]">{step} <span className="text-[#73789e]">/ {TOTAL_STEPS}</span></span></div>
        <div className="mb-5 flex gap-1.5" aria-label={`Step ${step} of ${TOTAL_STEPS}`}><div className="h-1.5 flex-1 rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#f35ca8] via-[#ff8b4d] to-[#ffd166] transition-all duration-300" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} /></div><div className="hidden gap-1 sm:flex">{Array.from({ length: TOTAL_STEPS }, (_, index) => <span key={index} className={`h-1.5 w-1.5 rounded-full ${index + 1 <= step ? "bg-[#ffd166]" : "bg-white/15"}`} />)}</div></div>

        <Card className="p-0">
          <div className="border-b border-white/10 p-5 sm:p-7"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#f35ca8]">Step {step} · {step === TOTAL_STEPS ? "Preview" : "One question"}</p><h2 className="display-font mt-2 text-2xl font-bold text-white sm:text-3xl">{title}</h2><p className="mt-2 max-w-xl text-xs leading-5 text-[#aaa8d0]">{description}</p></div>

          <div className="min-h-[330px] p-5 sm:p-7">
            {step === 1 && <div className="flex flex-col items-center gap-5"><div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-[38px] border-2 border-dashed border-[#f35ca8]/70 bg-white/[0.04] text-6xl shadow-[0_16px_35px_rgba(232,69,155,.15)]">{isImageSrc(photo) ? <img src={photo} alt="Your avatar preview" className="h-full w-full object-cover" /> : <span>{photo}</span>}</div><label className="cursor-pointer rounded-full bg-[#211952] px-5 py-3 text-xs font-bold text-white transition hover:bg-[#2c2561]">{uploading ? "Compressing & uploading…" : "📷 Upload a photo"}<input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploading} className="hidden" /></label>{uploadSuccess && <span className="-mt-3 text-[11px] font-semibold text-[#73f4df]">✓ Photo attached</span>}{uploadError && <span className="-mt-3 text-[11px] font-medium text-red-300">{uploadError}</span>}<div className="w-full max-w-sm"><p className="mb-3 text-center text-xs text-[#aaa8d0]">Or choose a festival avatar</p><div className="flex flex-wrap justify-center gap-2">{AVATAR_EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => setPhoto(emoji)} aria-label={`Choose ${emoji} avatar`} className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-2xl transition ${photo === emoji ? "scale-110 border-[#ffd166] bg-[#ffd166]/20" : "border-white/10 bg-white/[0.04] hover:border-white/30"}`}>{emoji}</button>)}</div></div></div>}

            {step === 2 && <div className="mx-auto max-w-md pt-8"><label htmlFor="first-name" className="text-xs font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">{identityName ? "Verified Google name" : "Your first name or nickname"}</label><input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} readOnly={identityNameLoading || Boolean(identityName)} aria-readonly={identityNameLoading || Boolean(identityName)} maxLength={40} autoComplete="given-name" className={`mt-3 w-full rounded-2xl border border-white/10 bg-[#100a2c] px-4 py-4 text-lg font-semibold text-white outline-none transition focus:border-[#ffd166] ${identityNameLoading || identityName ? "cursor-not-allowed opacity-80" : ""}`} placeholder="e.g. Aditya" /><p className="mt-2 text-[11px] text-[#73789e]">{identityName ? "Fetched from your Google account and kept fixed for authenticity." : identityNameLoading ? "Checking your verified account name…" : "This is the name your matches will see."}</p></div>}

            {step === 3 && <div className="mx-auto max-w-md pt-8"><label htmlFor="age" className="text-xs font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">Your age</label><div className="mt-3 flex items-center gap-3"><input id="age" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={age} aria-describedby="age-help" aria-invalid={!!formError} onChange={(e) => { if (/^\d*$/.test(e.target.value)) { setAge(e.target.value); setFormError(null); } }} className="w-full rounded-2xl border border-white/10 bg-[#100a2c] px-4 py-4 text-2xl font-bold text-white outline-none transition focus:border-[#ffd166]" /><span className="text-sm text-[#aaa8d0]">years</span></div><p id="age-help" className="mt-3 text-[11px] text-[#73789e]">You must be 18 or older to use GarbaMate.</p></div>}

            {step === 4 && <div className="mx-auto max-w-md pt-8"><label htmlFor="branch" className="text-xs font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">Your BMSCE branch</label><select id="branch" value={branch} onChange={(e) => setBranch(e.target.value)} className="mt-3 w-full rounded-2xl border border-white/10 bg-[#191342] p-4 text-base font-semibold text-white outline-none transition focus:border-[#ffd166]">{BRANCHES.map((item) => <option key={item} value={item}>{item}</option>)}</select><p className="mt-3 text-[11px] text-[#73789e]">Shown as a small context line on your card.</p></div>}

            {step === 5 && <div className="mx-auto max-w-md pt-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">Your current year</p><div className="mt-4 grid grid-cols-2 gap-2">{[1, 2, 3, 4].map((item) => <button key={item} type="button" onClick={() => setYear(item)} className={`min-h-16 rounded-2xl border text-left px-4 transition ${year === item ? "border-[#ffd166] bg-[#ffd166]/15 text-[#ffdca0]" : "border-white/10 bg-white/[0.04] text-[#cbc9e8] hover:border-white/25"}`}><span className="block text-sm font-bold">{item === 1 ? "1st" : item === 2 ? "2nd" : item === 3 ? "3rd" : "4th"} year</span><span className="mt-1 block text-[10px] text-[#aaa8d0]">BMSCE student</span></button>)}</div></div>}

            {step === 6 && <div className="mx-auto grid max-w-md gap-2 pt-6">{["Beginner", "Intermediate", "Advanced", "Just for Fun 😂"].map((item) => <button key={item} type="button" onClick={() => setExperience(item)} className={`flex min-h-14 items-center justify-between rounded-2xl border px-4 text-left text-sm font-semibold transition ${experience === item ? "border-[#ffd166] bg-[#ffd166]/15 text-[#ffdca0]" : "border-white/10 bg-white/[0.04] text-[#cbc9e8] hover:border-white/25"}`}><span>{item}</span><span className="text-lg">{experience === item ? "✓" : "＋"}</span></button>)}</div>}

            {step === 7 && <div className="pt-5"><p className="text-xs font-semibold text-[#cbc9e8]">Select all that sound like your kind of night.</p><div className="mt-4 flex flex-wrap gap-2.5">{GARBA_STYLES.map((style) => <button key={style} type="button" onClick={() => toggleStyle(style)} aria-pressed={selectedStyles.includes(style)} className={`rounded-full border px-4 py-2.5 text-xs font-semibold transition ${selectedStyles.includes(style) ? "border-[#f35ca8] bg-[#f35ca8]/20 text-[#ffb5dc]" : "border-white/10 bg-white/[0.04] text-[#aaa8d0] hover:border-white/30"}`}>{selectedStyles.includes(style) && <span className="mr-1">✓</span>}{style}</button>)}</div><p className="mt-5 text-[11px] text-[#73789e]">You can change these later from your profile.</p></div>}

            {step === 8 && <div className="pt-5"><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-[#cbc9e8]">Pick up to six conversation starters.</p><span className="text-[11px] text-[#ffd166]">{selectedInterests.length}/6</span></div><div className="mt-4 flex flex-wrap gap-2.5">{AVAILABLE_INTERESTS.map((interest) => <button key={interest} type="button" onClick={() => toggleInterest(interest)} aria-pressed={selectedInterests.includes(interest)} className={`rounded-full border px-4 py-2.5 text-xs font-semibold transition ${selectedInterests.includes(interest) ? "border-[#ff8b4d] bg-[#ff8b4d]/20 text-[#ffd166]" : "border-white/10 bg-white/[0.04] text-[#aaa8d0] hover:border-white/30"}`}>{selectedInterests.includes(interest) && <span className="mr-1">✓</span>}#{interest}</button>)}</div><div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-[#2dd4bf]/20 bg-[#123e4a]/25 p-4 text-[11px] leading-5 text-[#b4d9d7]"><span aria-hidden="true">🛡️</span><span>Keep meetups in safe, public festival spaces with friends.</span></div></div>}

            {step === 9 && <div className="pt-5"><label htmlFor="bio" className="text-xs font-bold uppercase tracking-[0.16em] text-[#aaa8d0]">A short intro <span className="font-normal normal-case tracking-normal text-[#73789e]">(optional)</span></label><textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} rows={5} className="mt-3 w-full rounded-2xl border border-white/10 bg-[#100a2c] p-4 text-sm leading-6 text-white outline-none transition focus:border-[#ffd166]" placeholder={"Share your Garba energy, favourite song, or the night you're excited for…"} /><div className="mt-2 flex justify-between text-[11px] text-[#73789e]"><span>Keep it warm and you.</span><span>{bio.length}/200</span></div></div>}

            {step === 10 && <div className="mx-auto max-w-md"><div className="overflow-hidden rounded-[26px] border border-white/10 bg-gradient-to-br from-[#2b215b] to-[#151034] shadow-[0_20px_45px_rgba(0,0,0,.24)]"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#ffd166]">Preview card</span><span className="text-[10px] font-bold text-[#73f4df]">✓ Verified student</span></div><div className="p-5"><div className="flex items-center gap-4"><div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/15 bg-white/[0.06] text-4xl">{isImageSrc(photo) ? <img src={photo} alt="Avatar preview" className="h-full w-full object-cover" /> : photo}</div><div className="min-w-0"><h3 className="display-font truncate text-2xl font-bold text-white">{firstName || "Student"}, {age}</h3><p className="mt-1 text-xs text-[#ffdca0]">{branch} · Year {year} · {experience}</p><p className="mt-2 text-[11px] text-[#aaa8d0]">Available for all 9 Navratri nights</p></div></div><p className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-3 text-sm leading-6 text-[#cbc9e8]">&ldquo;{bio || "Ready for Garba!"}&rdquo;</p><div className="mt-4 flex flex-wrap gap-1.5">{selectedStyles.slice(0, 4).map((style) => <span key={style} className="rounded-full bg-[#f35ca8]/15 px-2.5 py-1 text-[10px] font-semibold text-[#ffb5dc]">{style}</span>)}{selectedInterests.slice(0, 3).map((interest) => <span key={interest} className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] text-[#aaa8d0]">#{interest}</span>)}</div></div></div><p className="mt-4 text-center text-[11px] text-[#aaa8d0]">Looks good? Start discovering and keep your plans public.</p></div>}
          </div>

          {formError && <p role="alert" className="px-5 pb-4 text-sm text-rose-200 sm:px-7">{formError}</p>}
          <div className="flex items-center justify-between gap-3 border-t border-white/10 p-5 sm:p-7"><Button variant="ghost" disabled={step === 1 || saving} onClick={() => { setFormError(null); setStep((current) => Math.max(1, current - 1)); }} className="px-3 text-xs">← Back</Button>{step < TOTAL_STEPS ? <Button onClick={handleContinue} className="min-w-32">Continue <span aria-hidden="true">→</span></Button> : <Button onClick={handleFinish} disabled={saving} className="min-w-40">{saving ? "Saving profile…" : "Start discovering →"}</Button>}</div>
        </Card>
      </div>
    </AppShell>
  );
}
