export type GenderLabel = "Woman" | "Man" | "Non-binary" | "Prefer not to say";
export type LikeKind = "interested" | "garba_vibe";
export type ReportReason = "harassment" | "fake_profile" | "inappropriate_content" | "spam" | "other";

export interface Profile {
  id: string;
  first_name: string;
  age: number;
  gender: GenderLabel;
  branch: string;
  year: number;
  bio: string;
  experience: string;
  styles: string[];
  looking_for: string[];
  available_nights: number[];
  interests: string[];
  partner_preference: string;
  photo_path: string | null;
  is_hidden: boolean;
  is_suspended: boolean;
  is_banned: boolean;
  onboarding_complete: boolean;
  is_demo: boolean;
  last_active_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Like {
  id: string;
  from_user: string;
  to_user: string;
  kind: LikeKind;
  created_at: string;
}

export interface IncomingInterest {
  id: string;
  from_user: string;
  to_user: string;
  kind: LikeKind;
  created_at: string;
  sender_profile?: Profile;
}

export interface Match {
  id: string;
  user_a: string;
  user_b: string;
  status: "active" | "unmatched";
  created_at: string;
  partner?: Profile;
}

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: ReportReason;
  description?: string;
  status: "open" | "reviewing" | "actioned" | "dismissed";
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface AdminUser {
  user_id: string;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_id?: string | null;
  created_at: string;
}
