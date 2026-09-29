export function isAllowedEmail(email: string, configured = process.env.ALLOWED_EMAIL_DOMAINS ?? "bmsce.ac.in") {
  const normalized = email.trim().toLowerCase(); const at = normalized.lastIndexOf("@");
  if (at < 1 || at === normalized.length - 1) return false;
  const domain = normalized.slice(at + 1); return configured.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean).includes(domain);
}

export function parseCollegeEmail(email: string) {
  const local = email.trim().toLowerCase().split("@")[0] ?? "";
  const match = local.match(/^[^.]+\.(cs|is|ec|ee|me|cv|ai|ad)(\d{2})$/);
  if (!match) return { branch: "", admissionYear: null as number | null };
  return { branch: match[1], admissionYear: 2000 + Number(match[2]) };
}
