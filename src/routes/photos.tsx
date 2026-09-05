import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useI18n, type Lang } from "@/lib/i18n";
import { usePageMeta } from "@/hooks/use-page-meta";
import room1 from "@/assets/room-1.jpg";
import room2 from "@/assets/room-2.jpg";
import room3 from "@/assets/room-3.jpg";
import room4 from "@/assets/room-4.jpg";
import room5 from "@/assets/room-5.jpg";

export const Route = createFileRoute("/photos")({ component: Photos });

interface Category {
  en: string;
  ar: string;
  photos: string[];
}

/**
 * Only categories that actually have photography are shown. The page used to
 * render all fifteen, so a visitor met a grid of near-identical "Coming Soon"
 * tiles; add images here and the category appears.
 */
const CATEGORIES: Category[] = [
  { en: "Rooms", ar: "الغرف", photos: [room1, room3, room4, room5, room2] },
  { en: "Bathrooms", ar: "الحمامات", photos: [] },
  { en: "Living Area", ar: "غرفة المعيشة", photos: [] },
  { en: "Kitchen", ar: "المطبخ", photos: [] },
  { en: "Pool", ar: "المسبح", photos: [] },
  { en: "Outdoor Area", ar: "المنطقة الخارجية", photos: [] },
  { en: "Seating Area", ar: "منطقة الجلوس", photos: [] },
  { en: "Smart Home Features", ar: "ميزات المنزل الذكي", photos: [] },
  { en: "Entertainment", ar: "الترفيه", photos: [] },
  { en: "Views", ar: "الإطلالات", photos: [] },
  { en: "Parking", ar: "موقف السيارات", photos: [] },
  { en: "Entrance", ar: "المدخل", photos: [] },
  { en: "Dining Area", ar: "منطقة الطعام", photos: [] },
  { en: "Beach Access", ar: "إطلالة الشاطئ", photos: [] },
  { en: "Other Areas", ar: "مناطق أخرى", photos: [] },
];

function Photos() {
  const { tr, lang } = useI18n();
  usePageMeta(
    lang === "en" ? "Gallery" : "المعرض",
    lang === "en"
      ? "Photographs of Bizarri Chalet — rooms, interiors and the private pool."
      : "صور شاليه بيزاري — الغرف والتصميم الداخلي والمسبح الخاص.",
  );

  const [openAt, setOpenAt] = useState<number | null>(null);

  // Every photo in one flat list so the lightbox can run straight through the
  // gallery rather than dead-ending at the edge of a category.
  const flat = useMemo(
    () =>
      CATEGORIES.flatMap((c) =>
        c.photos.map((src) => ({ src, category: c, alt: `${c[lang]} — Bizarri Chalet` })),
      ),
    [lang],
  );

  const withPhotos = CATEGORIES.filter((c) => c.photos.length > 0);
  const upcoming = CATEGORIES.filter((c) => c.photos.length === 0);

  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <p className="mb-6 text-xs uppercase tracking-[0.4em] text-muted-foreground">
          {tr("photos")}
        </p>
        <h1 className="animate-fade-up mb-16 font-display text-5xl md:text-6xl">
          {lang === "en" ? "Gallery" : "المعرض"}
        </h1>

        {withPhotos.map((cat) => (
          <div key={cat.en} className="mb-16">
            <h2 className="mb-6 font-display text-2xl">{cat[lang]}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cat.photos.map((src) => {
                const index = flat.findIndex((f) => f.src === src);
                return (
                  <button
                    key={src}
                    onClick={() => setOpenAt(index)}
                    className="group relative aspect-[4/3] overflow-hidden bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                    aria-label={`${cat[lang]} — ${lang === "en" ? "open photo" : "فتح الصورة"}`}
                  >
                    <img
                      src={src}
                      alt={`${cat[lang]} — Bizarri Chalet`}
                      loading="lazy"
                      width={1206}
                      height={800}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {upcoming.length > 0 && (
          <div className="border-t border-border pt-10">
            <p className="mb-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {tr("comingSoon")}
            </p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {upcoming.map((c) => (
                <li key={c.en}>{c[lang]}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {openAt !== null && flat[openAt] && (
        <Lightbox
          photos={flat}
          index={openAt}
          lang={lang}
          onIndex={setOpenAt}
          onClose={() => setOpenAt(null)}
        />
      )}
    </PageShell>
  );
}

function Lightbox({
  photos,
  index,
  lang,
  onIndex,
  onClose,
}: {
  photos: { src: string; category: Category; alt: string }[];
  index: number;
  lang: Lang;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const { tr } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (delta: number) => onIndex((index + delta + photos.length) % photos.length),
    [index, photos.length, onIndex],
  );

  // Keyboard: Escape closes, arrows navigate, Tab is trapped inside the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key === "ArrowRight") return go(1);
      if (e.key === "ArrowLeft") return go(-1);
      if (e.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>("button");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  // Hold the page still behind the overlay.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const current = photos[index];

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={current.category[lang]}
      className="animate-fade-in fixed inset-0 z-[80] flex flex-col bg-black/95 backdrop-blur"
    >
      <div className="flex items-center justify-between px-6 py-5 text-white">
        <div>
          <p className="font-display text-2xl">{current.category[lang]}</p>
          <p className="text-xs uppercase tracking-[0.3em] text-white/50" dir="ltr">
            {index + 1} / {photos.length}
          </p>
        </div>
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label={tr("close")}
          className="p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center px-6 pb-6"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const diff = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(diff) > 50) go(diff > 0 ? -1 : 1);
          touchX.current = null;
        }}
      >
        {photos.length > 1 && (
          <button
            onClick={() => go(-1)}
            aria-label={lang === "en" ? "Previous photo" : "الصورة السابقة"}
            className="absolute start-2 z-10 p-3 text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white md:start-6"
          >
            <ChevronLeft className="h-8 w-8 rtl:rotate-180" />
          </button>
        )}

        <img
          key={current.src}
          src={current.src}
          alt={current.alt}
          className="animate-scale-in max-h-[75vh] max-w-full object-contain"
        />

        {photos.length > 1 && (
          <button
            onClick={() => go(1)}
            aria-label={lang === "en" ? "Next photo" : "الصورة التالية"}
            className="absolute end-2 z-10 p-3 text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white md:end-6"
          >
            <ChevronRight className="h-8 w-8 rtl:rotate-180" />
          </button>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-6 pb-8">
          {photos.map((p, i) => (
            <button
              key={p.src}
              onClick={() => onIndex(i)}
              aria-label={`${lang === "en" ? "Photo" : "صورة"} ${i + 1}`}
              aria-current={i === index}
              className={`h-16 w-16 shrink-0 transition-opacity focus-visible:outline-2 focus-visible:outline-white ${
                i === index ? "ring-2 ring-white" : "opacity-50 hover:opacity-80"
              }`}
            >
              <img src={p.src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
