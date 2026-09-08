import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSaveSetting, useSettings } from "@/lib/api";

type ContactForm = {
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  maps: string;
};

const EMPTY_CONTACT: ContactForm = { phone: "", whatsapp: "", email: "", instagram: "", maps: "" };

function readContact(value: unknown): ContactForm {
  if (!value || typeof value !== "object") return EMPTY_CONTACT;
  const v = value as Record<string, unknown>;
  return {
    phone: typeof v.phone === "string" ? v.phone : "",
    whatsapp: typeof v.whatsapp === "string" ? v.whatsapp : "",
    email: typeof v.email === "string" ? v.email : "",
    instagram: typeof v.instagram === "string" ? v.instagram : "",
    maps: typeof v.maps === "string" ? v.maps : "",
  };
}

function readEmailList(value: unknown): string {
  return Array.isArray(value) ? value.filter((v) => typeof v === "string").join(", ") : "";
}

type WhatsAppRecipient = { phone: string; apikey: string };

function readWhatsAppList(value: unknown): WhatsAppRecipient[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((v) => ({
      phone: typeof v.phone === "string" ? v.phone : "",
      apikey: typeof v.apikey === "string" ? v.apikey : "",
    }));
}

/**
 * This is the only place `public.settings` is actually editable — the site's
 * Contact page and footer read from it (see useSettings() in Footer.tsx /
 * contact.tsx), so a change here reaches the live site on the next load.
 */
export function SettingsPanel() {
  const { tr, lang } = useI18n();
  const { data: settings } = useSettings();
  const save = useSaveSetting();

  const [contact, setContact] = useState<ContactForm>(EMPTY_CONTACT);
  const [emails, setEmails] = useState("");
  const [whatsapp, setWhatsapp] = useState<WhatsAppRecipient[]>([]);

  useEffect(() => {
    if (settings) {
      setContact(readContact(settings.contact));
      setEmails(readEmailList(settings.notify_emails));
      setWhatsapp(readWhatsAppList(settings.notify_whatsapp));
    }
  }, [settings]);

  const saveContact = () => save.mutate({ key: "contact", value: contact });
  const saveEmails = () =>
    save.mutate({
      key: "notify_emails",
      value: emails
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  const saveWhatsapp = () =>
    save.mutate({
      key: "notify_whatsapp",
      value: whatsapp.filter((r) => r.phone.trim() && r.apikey.trim()),
    });

  return (
    <section>
      <h2 className="mb-2 font-display text-3xl">{tr("siteSettings")}</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        {lang === "en"
          ? "Feeds the Contact page and footer directly — changes appear on the live site right away."
          : "تُغذّي صفحة التواصل والتذييل مباشرة — التغييرات تظهر على الموقع فوراً."}
      </p>

      {save.error && (
        <p className="mb-4 border border-destructive p-4 text-sm text-destructive">
          {(save.error as Error).message}
        </p>
      )}

      <div className="border border-border p-6">
        <h3 className="mb-4 font-display text-xl">{tr("contact")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {tr("contactPhone")}
            </span>
            <input
              dir="ltr"
              value={contact.phone}
              onChange={(e) => setContact({ ...contact, phone: e.target.value })}
              placeholder="+96594040955"
              className="mt-1 w-full border border-border bg-secondary px-3 py-2 outline-none focus:border-foreground"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {tr("contactWhatsapp")}
            </span>
            <input
              dir="ltr"
              value={contact.whatsapp}
              onChange={(e) => setContact({ ...contact, whatsapp: e.target.value })}
              placeholder="96594040955"
              className="mt-1 w-full border border-border bg-secondary px-3 py-2 outline-none focus:border-foreground"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {tr("contactEmail")}
            </span>
            <input
              dir="ltr"
              type="email"
              value={contact.email}
              onChange={(e) => setContact({ ...contact, email: e.target.value })}
              className="mt-1 w-full border border-border bg-secondary px-3 py-2 outline-none focus:border-foreground"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {tr("contactInstagram")}
            </span>
            <input
              dir="ltr"
              value={contact.instagram}
              onChange={(e) => setContact({ ...contact, instagram: e.target.value })}
              placeholder="https://instagram.com/…"
              className="mt-1 w-full border border-border bg-secondary px-3 py-2 outline-none focus:border-foreground"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {tr("contactMaps")}
            </span>
            <input
              dir="ltr"
              value={contact.maps}
              onChange={(e) => setContact({ ...contact, maps: e.target.value })}
              placeholder="https://maps.app.goo.gl/…"
              className="mt-1 w-full border border-border bg-secondary px-3 py-2 outline-none focus:border-foreground"
            />
          </label>
        </div>
        <button
          onClick={saveContact}
          disabled={save.isPending}
          className="mt-5 bg-black px-8 py-3 text-sm uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-50"
        >
          {tr("save")}
        </button>
      </div>

      <div className="mt-6 border border-border p-6">
        <h3 className="mb-1 font-display text-xl">{tr("notifyEmails")}</h3>
        <p className="mb-4 text-xs text-muted-foreground">{tr("notifyEmailsHint")}</p>
        <input
          dir="ltr"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder="sales@bizarri.com, manager@bizarri.com"
          className="w-full border border-border bg-secondary px-3 py-2 outline-none focus:border-foreground"
        />
        <button
          onClick={saveEmails}
          disabled={save.isPending}
          className="mt-4 bg-black px-8 py-3 text-sm uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-50"
        >
          {tr("save")}
        </button>
      </div>

      <div className="mt-6 border border-border p-6">
        <h3 className="mb-1 font-display text-xl">{tr("notifyWhatsapp")}</h3>
        <p className="mb-2 text-xs text-muted-foreground">{tr("notifyWhatsappHint")}</p>
        <p className="mb-4 border-s-2 border-foreground/30 ps-3 text-xs text-muted-foreground">
          {tr("callmebotSteps")}
        </p>

        {whatsapp.length === 0 && (
          <p className="mb-4 text-sm text-muted-foreground">{tr("noWhatsappNumbers")}</p>
        )}

        <div className="space-y-3">
          {whatsapp.map((r, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <label className="block">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {tr("whatsappPhoneLabel")}
                </span>
                <input
                  dir="ltr"
                  value={r.phone}
                  onChange={(e) => {
                    const next = [...whatsapp];
                    next[i] = { ...next[i], phone: e.target.value };
                    setWhatsapp(next);
                  }}
                  placeholder="96594040955"
                  className="mt-1 w-full border border-border bg-secondary px-3 py-2 outline-none focus:border-foreground"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {tr("whatsappApikeyLabel")}
                </span>
                <input
                  dir="ltr"
                  value={r.apikey}
                  onChange={(e) => {
                    const next = [...whatsapp];
                    next[i] = { ...next[i], apikey: e.target.value };
                    setWhatsapp(next);
                  }}
                  className="mt-1 w-full border border-border bg-secondary px-3 py-2 outline-none focus:border-foreground"
                />
              </label>
              <button
                onClick={() => setWhatsapp(whatsapp.filter((_, idx) => idx !== i))}
                aria-label={lang === "en" ? "Remove number" : "إزالة الرقم"}
                className="self-end p-2.5 text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={() => setWhatsapp([...whatsapp, { phone: "", apikey: "" }])}
            className="inline-flex items-center gap-2 border border-border px-5 py-2.5 text-xs uppercase tracking-widest hover:bg-secondary"
          >
            <Plus className="h-4 w-4" /> {tr("addNumber")}
          </button>
          <button
            onClick={saveWhatsapp}
            disabled={save.isPending}
            className="bg-black px-8 py-2.5 text-xs uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-50"
          >
            {tr("save")}
          </button>
        </div>
      </div>
    </section>
  );
}
