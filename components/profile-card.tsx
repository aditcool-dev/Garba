import { cn } from "@/lib/utils";

export function ProfileCard({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <article className={cn("garba-card overflow-hidden", className)} {...props} />;
}

export function ProfileCardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-start justify-between gap-3 p-5 pb-0", className)} {...props} />;
}

export function ProfileCardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function ProfileCardActions({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap items-center gap-3 border-t border-white/10 p-5", className)} {...props} />;
}
