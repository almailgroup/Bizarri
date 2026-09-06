/**
 * Supabase data access for the chalet.
 *
 * Every read and write goes through here so the rest of the app never touches
 * the client directly. Reads use React Query; writes invalidate the keys they
 * affect, which is what keeps the admin panel and the guest calendar in step.
 */
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  BookingRow,
  BookingStatus,
  CalendarDay,
  ChaletRow,
  NewsRow,
  RatesRow,
} from "@/integrations/supabase/types";
import { DEFAULT_RATES, fmtDate, type Rates } from "@/lib/booking";

/* ------------------------------------------------------------------- keys */

export const qk = {
  chalets: ["chalets"] as const,
  rates: ["rates"] as const,
  calendar: (chalet: number, from: string, to: string) => ["calendar", chalet, from, to] as const,
  bookings: ["bookings"] as const,
  blocked: (chalet: number) => ["blocked", chalet] as const,
  dayPrices: (chalet: number) => ["dayPrices", chalet] as const,
  news: (all: boolean) => ["news", all] as const,
  isAdmin: ["isAdmin"] as const,
};

/** Postgres errors arrive with a `message`; surface it rather than "[object Object]". */
function fail(context: string, error: { message?: string } | null): never {
  throw new Error(error?.message ? `${context}: ${error.message}` : context);
}

/* ---------------------------------------------------------------- reading */

export function useChalets() {
  return useQuery({
    queryKey: qk.chalets,
    queryFn: async (): Promise<ChaletRow[]> => {
      const { data, error } = await supabase.from("chalets").select("*").order("sort_order");
      if (error) fail("Could not load chalets", error);
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

/** Rates in the shape the pricing mirror expects. */
export function useRates() {
  return useQuery({
    queryKey: qk.rates,
    queryFn: async (): Promise<Rates & { currency: string; minStayDays: number }> => {
      const { data, error } = await supabase.from("rates").select("*").maybeSingle();
      if (error) fail("Could not load rates", error);
      const r = data as RatesRow | null;
      return r
        ? {
            fullWeek: Number(r.full_week),
            weekend: Number(r.weekend),
            weekday: Number(r.weekday),
            dailyWeekday: Number(r.daily_weekday),
            dailyWeekend: Number(r.daily_weekend),
            currency: r.currency,
            minStayDays: r.min_stay_days,
          }
        : { ...DEFAULT_RATES, currency: "KWD", minStayDays: 3 };
    },
    staleTime: 60_000,
  });
}

/**
 * Availability and per-day prices for a window, in one call. The server decides
 * what "blocked" means (past, admin-blocked, or held by an accepted booking).
 */
export function useAvailability(chaletId: number, from: Date, to: Date, enabled = true) {
  const f = fmtDate(from);
  const t = fmtDate(to);
  return useQuery({
    queryKey: qk.calendar(chaletId, f, t),
    enabled,
    queryFn: async (): Promise<CalendarDay[]> => {
      const { data, error } = await supabase.rpc("availability_calendar", {
        p_chalet_id: chaletId,
        p_from: f,
        p_to: t,
      });
      if (error) fail("Could not load availability", error);
      return (data ?? []) as CalendarDay[];
    },
    staleTime: 30_000,
  });
}

export function usePublishedNews() {
  return useQuery({
    queryKey: qk.news(false),
    queryFn: async (): Promise<NewsRow[]> => {
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .eq("published", true)
        .order("published_at", { ascending: false });
      if (error) fail("Could not load news", error);
      return data ?? [];
    },
  });
}

/* --------------------------------------------------------- guest booking */

export interface BookingRequestInput {
  chaletId: number;
  start: Date;
  end: Date;
  name: string;
  phone: string;
  email: string;
  guests: number;
  notes?: string;
}

/**
 * Create a booking request. The server re-checks availability and re-derives
 * the price, so nothing here is trusted; the returned row is the truth.
 */
export function useRequestBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BookingRequestInput): Promise<BookingRow> => {
      const { data, error } = await supabase.rpc("request_booking", {
        p_chalet_id: input.chaletId,
        p_start: fmtDate(input.start),
        p_end: fmtDate(input.end),
        p_guest_name: input.name,
        p_guest_phone: input.phone,
        p_guest_email: input.email,
        p_guests: input.guests,
        p_notes: input.notes ?? null,
      });
      if (error) fail("Booking failed", error);
      return data as unknown as BookingRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: qk.bookings });
    },
  });
}

export function useLookupBooking() {
  return useMutation({
    mutationFn: async ({ ref, email }: { ref: string; email: string }) => {
      const { data, error } = await supabase.rpc("lookup_booking", {
        p_ref: ref,
        p_email: email,
      });
      if (error) fail("Lookup failed", error);
      return (data ?? []) as Pick<
        BookingRow,
        "ref" | "status" | "chalet_id" | "start_date" | "end_date" | "days" | "total" | "currency"
      >[];
    },
  });
}

/* ----------------------------------------------------------------- admin */

export function useIsAdmin(enabled: boolean) {
  return useQuery({
    queryKey: qk.isAdmin,
    enabled,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("is_admin");
      if (error) return false;
      return Boolean(data);
    },
    staleTime: 60_000,
  });
}

export function useBookings(enabled: boolean) {
  return useQuery({
    queryKey: qk.bookings,
    enabled,
    queryFn: async (): Promise<BookingRow[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) fail("Could not load bookings", error);
      return data ?? [];
    },
  });
}

export function useSetBookingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BookingStatus }) => {
      const { data, error } = await supabase.rpc("set_booking_status", {
        p_id: id,
        p_status: status,
      });
      if (error) fail("Could not update status", error);
      return data as unknown as BookingRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.bookings });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useDeleteBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bookings").delete().eq("id", id);
      if (error) fail("Could not delete booking", error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.bookings });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useBlockedDates(chaletId: number, enabled: boolean) {
  return useQuery({
    queryKey: qk.blocked(chaletId),
    enabled,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("blocked_dates")
        .select("day")
        .eq("chalet_id", chaletId);
      if (error) fail("Could not load blocked dates", error);
      return (data ?? []).map((r) => r.day);
    },
  });
}

export function useToggleBlocked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      chaletId,
      day,
      blocked,
    }: {
      chaletId: number;
      day: string;
      blocked: boolean;
    }) => {
      if (blocked) {
        const { error } = await supabase
          .from("blocked_dates")
          .delete()
          .eq("chalet_id", chaletId)
          .eq("day", day);
        if (error) fail("Could not unblock the day", error);
      } else {
        const { error } = await supabase.from("blocked_dates").insert({ chalet_id: chaletId, day });
        if (error) fail("Could not block the day", error);
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.blocked(v.chaletId) });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useDayPrices(chaletId: number, enabled: boolean) {
  return useQuery({
    queryKey: qk.dayPrices(chaletId),
    enabled,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("day_prices")
        .select("day, price")
        .eq("chalet_id", chaletId);
      if (error) fail("Could not load custom prices", error);
      return Object.fromEntries((data ?? []).map((r) => [r.day, Number(r.price)]));
    },
  });
}

export function useSetDayPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      chaletId,
      day,
      price,
    }: {
      chaletId: number;
      day: string;
      price: number | null;
    }) => {
      if (price === null) {
        const { error } = await supabase
          .from("day_prices")
          .delete()
          .eq("chalet_id", chaletId)
          .eq("day", day);
        if (error) fail("Could not clear the price", error);
      } else {
        const { error } = await supabase
          .from("day_prices")
          .upsert({ chalet_id: chaletId, day, price }, { onConflict: "chalet_id,day" });
        if (error) fail("Could not save the price", error);
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.dayPrices(v.chaletId) });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useSaveRates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: Rates) => {
      const { error } = await supabase
        .from("rates")
        .update({
          full_week: r.fullWeek,
          weekend: r.weekend,
          weekday: r.weekday,
          daily_weekday: r.dailyWeekday,
          daily_weekend: r.dailyWeekend,
        })
        .eq("id", true);
      if (error) fail("Could not save rates", error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.rates });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useAllNews(enabled: boolean) {
  return useQuery({
    queryKey: qk.news(true),
    enabled,
    queryFn: async (): Promise<NewsRow[]> => {
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) fail("Could not load news", error);
      return data ?? [];
    },
  });
}

export function useSaveNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<NewsRow> & { id?: string }) => {
      const payload = {
        title_en: item.title_en ?? "",
        title_ar: item.title_ar ?? "",
        body_en: item.body_en ?? "",
        body_ar: item.body_ar ?? "",
        published: item.published ?? false,
        published_at: item.published ? (item.published_at ?? new Date().toISOString()) : null,
      };
      const { error } = item.id
        ? await supabase.from("news").update(payload).eq("id", item.id)
        : await supabase.from("news").insert(payload);
      if (error) fail("Could not save the news item", error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["news"] }),
  });
}

export function useDeleteNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("news").delete().eq("id", id);
      if (error) fail("Could not delete the news item", error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["news"] }),
  });
}

export type { UseQueryOptions };
