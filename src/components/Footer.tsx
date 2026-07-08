import { Link } from "@tanstack/react-router";
import { Instagram, Phone, MapPin, Mail, Lock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import logoWhite from "@/assets/bizarri-logo-white.png";

export function Footer() {
  const { tr } = useI18n();
  return (
    <footer className="bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-4 gap-12">
        <div className="md:col-span-2">
          <img src={logoWhite} alt="Bizarri Chalet" className="h-12 mb-6" />
          <p className="text-white/60 max-w-sm leading-relaxed">{tr("tagline")}</p>
        </div>

        <div>
          <h4 className="text-xs tracking-[0.3em] uppercase text-white/40 mb-5">{tr("contact")}</h4>
          <ul className="space-y-3 text-sm">
            <li>
              <a
                href="tel:+96594040955"
                className="flex items-center gap-3 hover:text-white text-white/70"
              >
                <Phone className="w-4 h-4" /> +965 94040955
              </a>
            </li>
            <li>
              <a
                href="mailto:sales@bizarri.com"
                className="flex items-center gap-3 hover:text-white text-white/70"
              >
                <Mail className="w-4 h-4" /> sales@bizarri.com
              </a>
            </li>
            <li>
              <a
                href="https://maps.app.goo.gl/5wjw1skfpqdnDhFa6"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 hover:text-white text-white/70"
              >
                <MapPin className="w-4 h-4" /> {tr("location")}
              </a>
            </li>
            <li>
              <a
                href="https://www.instagram.com/bizarri.chalet?igsh=N3Y2bDZ2ZHFnNDNz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 hover:text-white text-white/70"
              >
                <Instagram className="w-4 h-4" /> Instagram
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs tracking-[0.3em] uppercase text-white/40 mb-5">Links</h4>
          <ul className="space-y-3 text-sm">
            <li>
              <Link to="/booking" className="text-white/70 hover:text-white">
                {tr("bookNow")}
              </Link>
            </li>
            <li>
              <Link to="/facilities" className="text-white/70 hover:text-white">
                {tr("facilities")}
              </Link>
            </li>
            <li>
              <Link to="/photos" className="text-white/70 hover:text-white">
                {tr("photos")}
              </Link>
            </li>
            <li>
              <Link to="/news" className="text-white/70 hover:text-white">
                {tr("news")}
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="text-white/70 hover:text-white">
                {tr("privacy")}
              </Link>
            </li>
            <li>
              <Link to="/rules" className="text-white/70 hover:text-white">
                {tr("rules")}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/50 tracking-widest uppercase">
          <p>© {new Date().getFullYear()} Bizarri Chalet</p>
          <div className="flex items-center gap-6">
            <Link
              to="/admin"
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              <Lock className="w-3 h-3" /> {tr("adminAccess")}
            </Link>
            <a
              href="https://almailgroup.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              {tr("visitAlmail")} →
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
