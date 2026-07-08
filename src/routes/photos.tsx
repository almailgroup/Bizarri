import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { useI18n, type Lang } from "@/lib/i18n";
import { useState } from "react";
import { ImageIcon, X } from "lucide-react";
import room1 from "@/assets/room-1.jpg";
import room2 from "@/assets/room-2.jpg";
import room3 from "@/assets/room-3.jpg";
import room4 from "@/assets/room-4.jpg";
import room5 from "@/assets/room-5.jpg";

const ROOM_PHOTOS = [room1, room2, room3, room4, room5];

export const Route = createFileRoute("/photos")({ component: Photos });

const categories: { en: string; ar: string }[] = [
  { en: "Rooms", ar: "الغرف" },
  { en: "Bathrooms", ar: "الحمامات" },
  { en: "Living Area", ar: "غرفة المعيشة" },
  { en: "Kitchen", ar: "المطبخ" },
  { en: "Pool", ar: "المسبح" },
  { en: "Outdoor Area", ar: "المنطقة الخارجية" },
  { en: "Seating Area", ar: "منطقة الجلوس" },
  { en: "Smart Home Features", ar: "ميزات المنزل الذكي" },
  { en: "Entertainment", ar: "الترفيه" },
  { en: "Views", ar: "الإطلالات" },
  { en: "Parking", ar: "موقف السيارات" },
  { en: "Entrance", ar: "المدخل" },
  { en: "Dining Area", ar: "منطقة الطعام" },
  { en: "Beach Access", ar: "إطلالة الشاطئ" },
  { en: "Other Areas", ar: "مناطق أخرى" },
];

function Photos() {
  const { tr, lang } = useI18n();
  const [active, setActive] = useState<number | null>(null);

  // Future: load uploaded photos from localStorage by category
  const getPhotos = (cat: string): string[] => {
    let stored: string[] = [];
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(`bizarri_photos_${cat}`);
        stored = raw ? (JSON.parse(raw) as string[]) : [];
      } catch {
        stored = [];
      }
    }
    if (cat === "Rooms") return [...ROOM_PHOTOS, ...stored];
    return stored;
  };

  return (
    <PageShell>
      <section className="max-w-7xl mx-auto px-6 py-24 md:py-32">
        <p className="text-xs tracking-[0.4em] uppercase text-muted-foreground mb-6">
          {tr("photos")}
        </p>
        <h1 className="font-display text-5xl md:text-6xl mb-16 animate-fade-up">
          {lang === "en" ? "Gallery" : "المعرض"}
        </h1>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {categories.map((c, i) => {
            const photos = getPhotos(c.en);
            return (
              <button
                key={c.en}
                onClick={() => setActive(i)}
                className="group relative aspect-[4/5] bg-secondary border border-border overflow-hidden hover-lift animate-fade-up text-left"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {photos[0] ? (
                  <img
                    src={photos[0]}
                    alt={c[lang]}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 luxe-gradient flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-white/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 inset-x-0 p-5 text-white">
                  <p className="font-display text-xl">{c[lang]}</p>
                  <p className="text-[10px] tracking-[0.3em] uppercase text-white/60 mt-1">
                    {photos.length > 0 ? `${photos.length} photos` : tr("comingSoon")}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {active !== null && (
        <CategoryViewer
          category={categories[active]}
          lang={lang}
          photos={getPhotos(categories[active].en)}
          onClose={() => setActive(null)}
        />
      )}
    </PageShell>
  );
}

function CategoryViewer({
  category,
  lang,
  photos,
  onClose,
}: {
  category: { en: string; ar: string };
  lang: Lang;
  photos: string[];
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => setTouchX(e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX === null) return;
    const diff = e.changedTouches[0].clientX - touchX;
    if (diff > 50) setIdx((i) => Math.max(0, i - 1));
    else if (diff < -50) setIdx((i) => Math.min(photos.length - 1, i + 1));
    setTouchX(null);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/95 backdrop-blur flex flex-col animate-fade-in">
      <div className="flex items-center justify-between px-6 py-5 text-white">
        <p className="font-display text-2xl">{category[lang]}</p>
        <button onClick={onClose} aria-label="Close">
          <X className="w-6 h-6" />
        </button>
      </div>
      <div
        className="flex-1 flex items-center justify-center px-6"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {photos.length === 0 ? (
          <div className="text-center text-white/60">
            <ImageIcon className="w-16 h-16 mx-auto mb-6 opacity-40" />
            <p className="text-xs tracking-[0.4em] uppercase">
              {lang === "en" ? "Coming Soon" : "قريباً"}
            </p>
          </div>
        ) : (
          <img
            src={photos[idx]}
            alt=""
            className="max-h-[80vh] max-w-full object-contain animate-scale-in"
          />
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 justify-center pb-8 px-6 overflow-x-auto">
          {photos.map((p, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`shrink-0 w-16 h-16 ${i === idx ? "ring-2 ring-white" : "opacity-50"}`}
            >
              <img src={p} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
