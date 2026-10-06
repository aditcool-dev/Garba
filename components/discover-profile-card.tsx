"use client";

import { memo } from "react";
import Image from "next/image";
import { AvatarFallback, Badge, NightStrip, ScoreRing, VerifiedBadge } from "@/components/ui";
import type { Profile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { optimizableImage, PROFILE_SIZES } from "@/lib/profile-images";

export function isImageSrc(src?: string | null): boolean {
  if (!src) return false;
  const value = src.trim();
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:") || value.startsWith("/") || value.startsWith("blob:");
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "GM";
}

const avatarGradients = [
  "from-[#ff2e93] via-[#7b2ff7] to-[#16123a]",
  "from-[#ff8a00] via-[#ff2e93] to-[#20184f]",
  "from-[#2de2c4] via-[#7b2ff7] to-[#16123a]",
  "from-[#ffc83d] via-[#ff8a00] to-[#24143f]",
];

export function IllustratedProfileVisual({ person, className, priority = false }: { person: Profile; className?: string; priority?: boolean }) {
  const gradient = avatarGradients[person.first_name.length % avatarGradients.length];
  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-[#16123a]", className)}>
      {isImageSrc(person.photo_path) ? (
        <Image src={person.photo_path!} alt={`${person.first_name}'s profile`} fill sizes={PROFILE_SIZES} quality={75} unoptimized={!optimizableImage(person.photo_path!)} priority={priority} decoding="async" draggable={false} className="object-cover object-center" />
      ) : (
        <div className={cn("relative flex h-full w-full items-center justify-center bg-gradient-to-br", gradient)}>
           <span aria-hidden="true" className="display-font absolute top-[12%] text-8xl font-bold tracking-[-0.08em] text-white/70 sm:text-9xl">{person.photo_path || initials(person.first_name)}</span>
        </div>
      )}
    </div>
  );
}

export type DiscoverProfileCardProps = {
  person: Profile;
  score: number;
  myNights: number[];
  className?: string;
  onOpenDetails?: () => void;
  onPass?: () => void;
  onInterested?: () => void;
  isMatched?: boolean;
  priority?: boolean;
};

export const DiscoverProfileCard = memo(function DiscoverProfileCard({ person, score, myNights, className, onOpenDetails, onPass, onInterested, isMatched, priority }: DiscoverProfileCardProps) {
  const overlap = person.available_nights.filter((night) => myNights.includes(night));
  const visibleStyles = person.styles.slice(0, 3);
  const extraStyles = Math.max(0, person.styles.length - visibleStyles.length);

  return (
    <article
      className={cn("relative isolate overflow-hidden rounded-[28px] border border-white/12 bg-[#16123a]", className)}
      aria-label={`${person.first_name}'s Garba profile`}
      onClick={onOpenDetails}
    >
      <div className="absolute inset-0">
        <IllustratedProfileVisual person={person} priority={priority} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0820] via-[#0a0820]/40 to-transparent" aria-hidden="true" />
      </div>

      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-5">
        {person.is_verified && <VerifiedBadge className="rounded-full border border-[#2de2c4]/25 bg-[#071c22] px-2.5 py-1 text-[10px]" />}
        <div className="rounded-full border border-white/15 bg-[#0a0820] p-1" title="A fun app-generated score based on nights, styles, and interests.">
          <ScoreRing score={score} size="sm" label="Garba compatibility" />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="display-font truncate text-3xl font-bold tracking-[-0.06em] text-white sm:text-4xl">{person.first_name}, {person.age}</h2>
            <p className="mt-1 text-xs font-semibold text-white/75">{person.branch} · Year {person.year}</p>
          </div>
          {isMatched && <Badge className="shrink-0 border-[#2de2c4]/30 bg-[#2de2c4]/15 text-[#73f4df]">Matched</Badge>}
        </div>

        <p className="mt-3 line-clamp-2 max-w-[34rem] text-sm leading-5 text-white/82">{person.bio || "Ready to share a few rounds on the Garba floor."}</p>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {visibleStyles.map((style) => <Badge key={style} className="border-white/12 bg-white/10 text-[10px] text-white/85">{style}</Badge>)}
          {extraStyles > 0 && <Badge className="border-white/12 bg-white/10 text-[10px] text-white/70">+{extraStyles}</Badge>}
        </div>

        <NightStrip nights={person.available_nights} highlightedNights={overlap} showLabel={false} compact className="mt-4" />

        <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-white/65">
          <span>{overlap.length ? `${overlap.length} night${overlap.length === 1 ? "" : "s"} overlap with you` : "See if your nights line up"}</span>
          <span className="font-semibold text-white/80">Tap for details</span>
        </div>

        <div className="sr-only">
          <button type="button" onClick={(event) => { event.stopPropagation(); onPass?.(); }}>Pass on {person.first_name}</button>
          <button type="button" onClick={(event) => { event.stopPropagation(); onInterested?.(); }}>Interested in {person.first_name}</button>
        </div>
      </div>
    </article>
  );
});

export { AvatarFallback };
