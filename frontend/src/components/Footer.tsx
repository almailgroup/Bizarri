import { Link } from "@tanstack/react-router";
import { Instagram, Phone, MapPin, Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BrandHomeLink } from "@/components/BrandHomeLink";
import { useContactInfo } from "@/lib/api";
import logoWhite from "@/assets/bizarri-logo-white.png";

export function Footer() {
  const { tr, lang } = useI18n();
  const contact = useContactInfo();
  return (
    <footer className="bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-4 gap-12">
        <div className="md:col-span-2">
          <BrandHomeLink className="mb-6 inline-block">
            <img src={logoWhite} alt="Bizarri Chalet" className="h-14" />
          </BrandHomeLink>
          <p className="text-white/60 max-w-sm leading-relaxed">{tr("tagline")}</p>
        </div>

        <div>
          <h4 className="text-xs tracking-[0.3em] uppercase text-white/40 mb-5">{tr("contact")}</h4>
          <ul className="space-y-1 text-sm">
            <li>
              <a
                href={`tel:${contact.phone}`}
                dir="ltr"
                className="-my-1 flex items-center gap-3 py-2 text-white/70 hover:text-white"
              >
                <Phone className="w-4 h-4" /> {contact.phone}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${contact.email}`}
                className="-my-1 flex items-center gap-3 py-2 text-white/70 hover:text-white"
              >
                <Mail className="w-4 h-4" /> {contact.email}
              </a>
            </li>
            <li>
              <a
                href={contact.maps}
                target="_blank"
                rel="noopener noreferrer"
                className="-my-1 flex items-center gap-3 py-2 text-white/70 hover:text-white"
              >
                <MapPin className="w-4 h-4" /> {tr("location")}
              </a>
            </li>
            <li>
              <a
                href={contact.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="-my-1 flex items-center gap-3 py-2 text-white/70 hover:text-white"
              >
                <Instagram className="w-4 h-4" /> Instagram
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs tracking-[0.3em] uppercase text-white/40 mb-5">Links</h4>
          <ul className="space-y-1 text-sm">
            <li>
              <Link
                to="/booking/$lang"
                params={{ lang }}
                className="-my-1 inline-block py-2 text-white/70 hover:text-white"
              >
                {tr("bookNow")}
              </Link>
            </li>
            <li>
              <Link
                to="/facilities/$lang"
                params={{ lang }}
                className="-my-1 inline-block py-2 text-white/70 hover:text-white"
              >
                {tr("facilities")}
              </Link>
            </li>
            <li>
              <Link
                to="/photos/$lang"
                params={{ lang }}
                className="-my-1 inline-block py-2 text-white/70 hover:text-white"
              >
                {tr("photos")}
              </Link>
            </li>
            <li>
              <Link
                to="/news/$lang"
                params={{ lang }}
                className="-my-1 inline-block py-2 text-white/70 hover:text-white"
              >
                {tr("news")}
              </Link>
            </li>
            <li>
              <Link
                to="/privacy/$lang"
                params={{ lang }}
                className="-my-1 inline-block py-2 text-white/70 hover:text-white"
              >
                {tr("privacy")}
              </Link>
            </li>
            <li>
              <Link
                to="/rules/$lang"
                params={{ lang }}
                className="-my-1 inline-block py-2 text-white/70 hover:text-white"
              >
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
            <a
              href="https://almailgroup.com"
              target="_blank"
              rel="noopener noreferrer"
              className="-my-2 inline-block py-2 transition-colors hover:text-white"
            >
              {tr("visitAlmail")} →
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
