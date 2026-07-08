import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import logoWhite from "@/assets/bizarri-logo-white.png";
import { Lock, LogOut, Trash2, Plus, X } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: Admin });

const PASSWORD = "BIZARRIkwt2026";

function Admin() {
  const { tr, lang } = useI18n();
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("bizarri_admin") === "1") {
      setAuthed(true);
    }
  }, []);

  if (!authed) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 relative">
        <Link
          to="/"
          aria-label="Close"
          className="absolute top-5 right-5 p-2.5 text-white/70 hover:text-white border border-white/20 hover:border-white/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </Link>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pw === PASSWORD) {
              sessionStorage.setItem("bizarri_admin", "1");
              setAuthed(true);
            } else {
              setErr(lang === "en" ? "Incorrect password" : "كلمة المرور غير صحيحة");
            }
          }}
          className="w-full max-w-sm animate-fade-up"
        >
          <img src={logoWhite} alt="Bizarri" className="h-12 mx-auto mb-10" />
          <p className="text-center text-xs tracking-[0.4em] uppercase text-white/40 mb-2">
            {tr("admin")}
          </p>
          <h1 className="font-display text-3xl text-center mb-8">{tr("login")}</h1>
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-white/60">
              {tr("password")}
            </span>
            <div className="relative mt-2">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 outline-none focus:border-white"
                autoFocus
              />
            </div>
          </label>
          {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
          <button
            type="submit"
            className="w-full mt-8 py-4 bg-white text-black text-sm tracking-widest uppercase hover:bg-white/90"
          >
            {tr("login")}
          </button>
        </form>
      </div>
    );
  }

  return (
    <Dashboard
      onLogout={() => {
        sessionStorage.removeItem("bizarri_admin");
        setAuthed(false);
      }}
    />
  );
}

interface BookingRecord {
  name: string;
  phone: string;
  email: string;
  guests: string;
  notes?: string;
  chalet: string;
  dates: string;
  createdAt: string;
}

interface NewsRecord {
  id: string;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  date: string;
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const { tr, lang } = useI18n();
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [news, setNews] = useState<NewsRecord[]>([]);
  const [newDate, setNewDate] = useState("");
  const [newsForm, setNewsForm] = useState({
    title_en: "",
    title_ar: "",
    body_en: "",
    body_ar: "",
  });

  useEffect(() => {
    try {
      setUnavailable(JSON.parse(localStorage.getItem("bizarri_unavailable") || "[]"));
      setBookings(JSON.parse(localStorage.getItem("bizarri_bookings") || "[]"));
      setNews(JSON.parse(localStorage.getItem("bizarri_news") || "[]"));
    } catch {
      /* ignore malformed localStorage */
    }
  }, []);

  const saveDates = (d: string[]) => {
    setUnavailable(d);
    localStorage.setItem("bizarri_unavailable", JSON.stringify(d));
  };

  const addDate = () => {
    if (!newDate || unavailable.includes(newDate)) return;
    saveDates([...unavailable, newDate].sort());
    setNewDate("");
  };

  const removeBooking = (i: number) => {
    const next = bookings.filter((_, idx) => idx !== i);
    setBookings(next);
    localStorage.setItem("bizarri_bookings", JSON.stringify(next));
  };

  const saveNews = (n: NewsRecord[]) => {
    setNews(n);
    localStorage.setItem("bizarri_news", JSON.stringify(n));
  };

  const addNews = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsForm.title_en && !newsForm.title_ar) return;
    const item = { id: crypto.randomUUID(), ...newsForm, date: new Date().toISOString() };
    saveNews([item, ...news]);
    setNewsForm({ title_en: "", title_ar: "", body_en: "", body_ar: "" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logoWhite} alt="Bizarri" className="h-8" />
            <span className="text-xs tracking-[0.4em] uppercase text-white/60">
              {tr("dashboard")}
            </span>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-xs uppercase tracking-widest hover:text-white/70"
          >
            <LogOut className="w-4 h-4" /> {tr("logout")}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 grid lg:grid-cols-2 gap-12">
        <section>
          <h2 className="font-display text-3xl mb-6">
            {lang === "en" ? "Unavailable Dates" : "التواريخ غير المتاحة"}
          </h2>
          <div className="flex gap-2 mb-6">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="flex-1 px-4 py-3 bg-secondary border border-border outline-none"
            />
            <button
              onClick={addDate}
              className="px-5 bg-black text-white flex items-center gap-2 text-sm uppercase tracking-widest"
            >
              <Plus className="w-4 h-4" /> {lang === "en" ? "Add" : "إضافة"}
            </button>
          </div>
          <ul className="space-y-2">
            {unavailable.length === 0 && (
              <li className="text-muted-foreground text-sm">
                {lang === "en" ? "No dates blocked." : "لا توجد تواريخ محظورة."}
              </li>
            )}
            {unavailable.map((d) => (
              <li
                key={d}
                className="flex items-center justify-between border border-border px-4 py-3"
              >
                <span className="font-mono">{d}</span>
                <button
                  onClick={() => saveDates(unavailable.filter((x) => x !== d))}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-display text-3xl mb-6">
            {lang === "en" ? "Booking Requests" : "طلبات الحجز"}
          </h2>
          {bookings.length === 0 && (
            <p className="text-muted-foreground text-sm">
              {lang === "en" ? "No requests yet." : "لا توجد طلبات."}
            </p>
          )}
          <ul className="space-y-3">
            {bookings.map((b, i) => (
              <li key={i} className="border border-border p-5">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <p className="font-display text-xl">{b.name}</p>
                  <button
                    onClick={() => removeBooking(i)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {b.chalet} · {b.dates}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <span>{b.phone}</span>
                  <span className="truncate">{b.email}</span>
                  <span>Guests: {b.guests}</span>
                </div>
                {b.notes && <p className="mt-3 text-sm text-muted-foreground">{b.notes}</p>}
              </li>
            ))}
          </ul>
        </section>

        <section className="lg:col-span-2">
          <h2 className="font-display text-3xl mb-6">{lang === "en" ? "News" : "الأخبار"}</h2>
          <form
            onSubmit={addNews}
            className="grid md:grid-cols-2 gap-3 border border-border p-5 mb-6"
          >
            <input
              placeholder="Title (English)"
              value={newsForm.title_en}
              onChange={(e) => setNewsForm({ ...newsForm, title_en: e.target.value })}
              className="px-4 py-3 bg-secondary border border-border outline-none"
            />
            <input
              placeholder="العنوان (عربي)"
              dir="rtl"
              value={newsForm.title_ar}
              onChange={(e) => setNewsForm({ ...newsForm, title_ar: e.target.value })}
              className="px-4 py-3 bg-secondary border border-border outline-none"
            />
            <textarea
              placeholder="Body (English)"
              rows={3}
              value={newsForm.body_en}
              onChange={(e) => setNewsForm({ ...newsForm, body_en: e.target.value })}
              className="px-4 py-3 bg-secondary border border-border outline-none"
            />
            <textarea
              placeholder="المحتوى (عربي)"
              dir="rtl"
              rows={3}
              value={newsForm.body_ar}
              onChange={(e) => setNewsForm({ ...newsForm, body_ar: e.target.value })}
              className="px-4 py-3 bg-secondary border border-border outline-none"
            />
            <button
              type="submit"
              className="md:col-span-2 px-6 py-3 bg-black text-white text-sm uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> {lang === "en" ? "Publish News" : "نشر الخبر"}
            </button>
          </form>
          <ul className="space-y-3">
            {news.length === 0 && (
              <li className="text-muted-foreground text-sm">
                {lang === "en" ? "No news yet." : "لا توجد أخبار."}
              </li>
            )}
            {news.map((n, i) => (
              <li
                key={n.id}
                className="border border-border p-5 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {new Date(n.date).toLocaleDateString()}
                  </p>
                  <p className="font-display text-xl mt-1">{n.title_en || n.title_ar}</p>
                </div>
                <button
                  onClick={() => saveNews(news.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
