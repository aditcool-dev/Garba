export function errorReference(error: { message: string; digest?: string }): string {
  if (error.digest) return `GM-${error.digest.replace(/[^a-z0-9-]/gi, "").slice(0, 32)}`;
  let hash = 2166136261;
  for (const character of error.message) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `GM-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
