import { cn } from "@/lib/utils";

const avatarSizes = {
  sm: "h-9 w-9 text-sm",
  md: "h-14 w-14 text-lg",
  lg: "h-20 w-20 text-2xl",
  xl: "h-28 w-28 text-4xl",
} as const;

export type AvatarFallbackProps = React.HTMLAttributes<HTMLDivElement> & {
  src?: string | null;
  alt?: string;
  name?: string | null;
  fallback?: React.ReactNode;
  size?: keyof typeof avatarSizes;
};

function isImageSrc(src?: string | null): boolean {
  if (!src) return false;
  const value = src.trim();
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:") || value.startsWith("/") || value.startsWith("blob:");
}

function initialsFor(name?: string | null): string {
  const initials = (name || "GarbaMate")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  return initials || "GM";
}

export function AvatarFallback({ src, alt, name, fallback, size = "md", className, ...props }: AvatarFallbackProps) {
  const label = alt || name || "Profile avatar";
  const fallbackContent = fallback !== undefined ? fallback : initialsFor(name);
  const hasImage = isImageSrc(src);

  return (
    <div
      className={cn(
        "subtle-ring relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#211952] font-bold text-[#ffd166]",
        avatarSizes[size],
        className,
      )}
      role={hasImage ? undefined : "img"}
      aria-label={hasImage ? undefined : label}
      {...props}
    >
      {hasImage ? (
        <img src={src!} alt={label} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <span className="select-none" aria-hidden="true">{fallbackContent}</span>
      )}
    </div>
  );
}
