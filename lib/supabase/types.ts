export type GenderLabel = "Woman" | "Man" | "Non-binary" | "Prefer not to say";
export type LikeKind = "interested" | "garba_vibe";
export type RelationshipStatus = "matched" | "sent" | "passed" | "incoming" | "new";
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
  is_verified?: boolean;
  read_receipts_enabled?: boolean;
  has_seen_discover_tutorial?: boolean;
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

export interface RelationshipRow {
  profile: Profile;
  status: RelationshipStatus;
  like_kind?: LikeKind | null;
  match_id?: string | null;
  overlap_nights: number;
}

export interface Match {
  id: string;
  user_a: string;
  user_b: string;
  status: "active" | "unmatched";
  created_at: string;
  chat_started_at?: string;
  unmatched_at?: string | null;
  unmatched_by?: string | null;
  partner?: Profile;
}

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  delivered_at?: string | null;
  local_status?: "sending" | "failed";
  chat_started_at?: string;
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

export type NotificationType = "interest" | "match" | "message" | "unmatch";

export interface NotificationItem {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  sender_id?: string;
  sender_name?: string;
  sender_photo?: string | null;
  match_id?: string;
  created_at: string;
  read: boolean;
  unread_count?: number;
  like_kind?: LikeKind | null;
  overlap_nights?: number;
}
