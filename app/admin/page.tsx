"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/lib/supabase/auth-context";
import { db } from "@/lib/supabase/client";
import type { Profile, Report } from "@/lib/supabase/types";
import { ReportEvidence } from "@/components/report-evidence";

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const [allowed, setAllowed] = useState(false), [profiles, setProfiles] = useState<Profile[]>([]), [reports, setReports] = useState<Report[]>([]), [error, setError] = useState<string | null>(null), [search, setSearch] = useState("");
  useEffect(() => {
    let cancelled = false;
    setAllowed(false);
    if (!user) return;
    void db.isAdmin(user.id).then(async authorized => {
      if (cancelled || !authorized) return;
      setAllowed(true);
      const [students, queue] = await Promise.all([db.getAllAdminProfiles(), db.getReports()]);
      if (!cancelled) { setProfiles(students); setReports(queue); }
    }).catch(error => { console.error("[admin]", error); setError("Could not load the moderation console."); });
    return () => { cancelled = true; };
  }, [user]);
  if (isLoading) return <main className="p-6">Checking access…</main>;
  if (!allowed) return <main className="mx-auto max-w-lg p-6"><Card><h1 className="text-xl font-bold">Administrative access</h1><p className="mt-3">Sign in with an account assigned to admin_users.</p><Link href="/login">Sign in</Link></Card></main>;
  return <AppShell title="Moderation"><h1 className="text-2xl font-bold">Campus safety console</h1>{error && <p role="alert">{error}</p>}
    <Card className="mt-5"><h2 className="text-xl">Student accounts · {profiles.length}</h2><input aria-label="Search students" placeholder="Search by name or branch" value={search} onChange={event => setSearch(event.target.value)} className="mt-4 w-full rounded-xl bg-white/10 p-3" />
      {profiles.filter(profile => `${profile.first_name} ${profile.branch}`.toLowerCase().includes(search.toLowerCase())).map(profile => <div key={profile.id} className="mt-3 flex flex-wrap justify-between gap-3 border-b border-white/10 py-3"><span>{profile.first_name} · {profile.branch} · Year {profile.year}</span><Button variant="secondary" onClick={async () => { try { await db.setUserStatus(profile.id, { is_suspended: !profile.is_suspended }); setProfiles(await db.getAllAdminProfiles()); } catch { setError("Could not update student."); } }}>{profile.is_suspended ? "Reinstate" : "Suspend"}</Button></div>)}
    </Card><Card className="mt-5"><h2 className="text-xl">Safety reports · {reports.filter(report => report.status === "open").length} open</h2>
      {reports.map(report => <div key={report.id} className="mt-4 rounded-xl bg-white/5 p-4"><p>{report.reason} · {report.status}</p><p>{report.description}</p><ReportEvidence reportId={report.id} /><Button variant="secondary" className="mt-3" onClick={async () => { try { await db.reviewReport(report.id, "reviewing"); setReports(await db.getReports()); } catch { setError("Could not update report."); } }}>Mark reviewing</Button></div>)}
    </Card></AppShell>;
}
