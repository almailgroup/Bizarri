/* NOTE: rows are declared as type aliases, not interfaces. postgrest-js
   requires Row/Insert/Update to satisfy Record<string, unknown>, and only type
   aliases get an implicit index signature. */

/**
 * Database types for the Bizarri schema.
 *
 * Mirrors backend/supabase/migrations/. Regenerate with:
 *   supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type BookingStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type PackageKey = "fullWeek" | "weekend" | "weekday";

export type ChaletRow = {
  id: number;
  slug: string;
  name_en: string;
  name_ar: string;
  active: boolean;
  sort_order: number;
};

export type RatesRow = {
  id: boolean;
  full_week: number;
  weekend: number;
  weekday: number;
  daily_weekday: number;
  daily_weekend: number;
  currency: string;
  min_stay_days: number;
  updated_at: string;
  updated_by: string | null;
};

export type BlockedDateRow = {
  id: string;
  chalet_id: number;
  day: string;
  reason: string | null;
  created_at: string;
  created_by: string | null;
};

export type DayPriceRow = {
  id: string;
  chalet_id: number;
  day: string;
  price: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type BookingRow = {
  id: string;
  ref: string;
  chalet_id: number;
  start_date: string;
  end_date: string;
  days: number;
  total: number;
  currency: string;
  package_key: PackageKey | null;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  guests: number;
  notes: string | null;
  status: BookingStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  decided_at: string | null;
  decided_by: string | null;
};

export type NewsRow = {
  id: string;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SettingRow = {
  key: string;
  value: Json;
  updated_at: string;
  updated_by: string | null;
};

export type AuditRow = {
  id: number;
  actor: string | null;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  detail: Json;
  created_at: string;
};

/** One row per day from availability_calendar(). */
export type CalendarDay = {
  day: string;
  blocked: boolean;
  price: number;
  custom: boolean;
};

export type QuoteRow = {
  total: number;
  package_key: PackageKey | null;
  days: number;
  has_custom: boolean;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      admins: {
        Row: { user_id: string; email: string | null; created_at: string };
        Insert: { user_id: string; email?: string | null };
        Update: { email?: string | null };
        Relationships: [];
      };
      chalets: {
        Row: ChaletRow;
        Insert: Partial<ChaletRow> & { id: number; slug: string; name_en: string; name_ar: string };
        Update: Partial<ChaletRow>;
        Relationships: [];
      };
      rates: {
        Row: RatesRow;
        Insert: Partial<RatesRow>;
        Update: Partial<RatesRow>;
        Relationships: [];
      };
      blocked_dates: {
        Row: BlockedDateRow;
        Insert: { chalet_id: number; day: string; reason?: string | null };
        Update: Partial<BlockedDateRow>;
        Relationships: [];
      };
      day_prices: {
        Row: DayPriceRow;
        Insert: { chalet_id: number; day: string; price: number };
        Update: Partial<DayPriceRow>;
        Relationships: [];
      };
      bookings: {
        Row: BookingRow;
        Insert: Partial<BookingRow>;
        Update: Partial<BookingRow>;
        Relationships: [];
      };
      news: { Row: NewsRow; Insert: Partial<NewsRow>; Update: Partial<NewsRow>; Relationships: [] };
      settings: {
        Row: SettingRow;
        Insert: { key: string; value: Json };
        Update: Partial<SettingRow>;
        Relationships: [];
      };
      audit_log: {
        Row: AuditRow;
        Insert: Partial<AuditRow>;
        Update: Partial<AuditRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: Record<string, unknown>; Returns: boolean };
      availability_calendar: {
        Args: { p_chalet_id: number; p_from: string; p_to: string };
        Returns: CalendarDay[];
      };
      quote_stay: {
        Args: { p_chalet_id: number; p_start: string; p_end: string };
        Returns: QuoteRow[];
      };
      is_range_available: {
        Args: { p_chalet_id: number; p_start: string; p_end: string };
        Returns: boolean;
      };
      request_booking: {
        Args: {
          p_chalet_id: number;
          p_start: string;
          p_end: string;
          p_guest_name: string;
          p_guest_phone: string;
          p_guest_email: string;
          p_guests: number;
          p_notes?: string | null;
        };
        Returns: BookingRow;
      };
      lookup_booking: {
        Args: { p_ref: string; p_email: string };
        Returns: Pick<
          BookingRow,
          "ref" | "status" | "chalet_id" | "start_date" | "end_date" | "days" | "total" | "currency"
        >[];
      };
      set_booking_status: {
        Args: { p_id: string; p_status: BookingStatus; p_note?: string | null };
        Returns: BookingRow;
      };
    };
    Enums: { booking_status: BookingStatus };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
