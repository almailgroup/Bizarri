import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSaveSetting, useSettings } from "@/lib/api";
import { useAdminT } from "./strings";
import { errorText, useToast } from "./toast";
import { Btn, Card, Field, IconBtn, PanelHeader, inputClass } from "./ui";

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
  const t = useAdminT();
  const toast = useToast();
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

  const persist = (key: string, value: Parameters<typeof save.mutate>[0]["value"]) =>
    save.mutate(
      { key, value },
      {
        onSuccess: () => toast.success(t("saved")),
        onError: (err) => toast.error(errorText(err)),
      },
    );
  const savingKey = save.isPending ? save.variables?.key : undefined;

  const saveContact = () => persist("contact", contact);
  const saveEmails = () =>
    persist(
      "notify_emails",
      emails
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  const saveWhatsapp = () =>
    persist(
      "notify_whatsapp",
      whatsapp.filter((r) => r.phone.trim() && r.apikey.trim()),
    );

  const text = (key: keyof ContactForm, label: string, placeholder?: string, wide = false) => (
    <Field label={label} className={wide ? "sm:col-span-2" : undefined}>
      {(a) => (
        <input
          {...a}
          dir="ltr"
          type={key === "email" ? "email" : "text"}
          value={contact[key]}
          onChange={(e) => setContact({ ...contact, [key]: e.target.value })}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
    </Field>
  );

  return (
    <section>
      <PanelHeader
        title={tr("siteSettings")}
        description={
          lang === "en"
            ? "Feeds the Contact page and footer directly — changes appear on the live site right away."
            : "تُغذّي صفحة التواصل والتذييل مباشرة — التغييرات تظهر على الموقع فوراً."
        }
      />

      <div className="space-y-6">
        <Card className="p-5 sm:p-6">
          <h3 className="mb-4 text-lg font-semibold">{tr("contact")}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("phone", tr("contactPhone"), "+96594040955")}
            {text("whatsapp", tr("contactWhatsapp"), "96594040955")}
            {text("email", tr("contactEmail"))}
            {text("instagram", tr("contactInstagram"), "https://instagram.com/…")}
            {text("maps", tr("contactMaps"), "https://maps.app.goo.gl/…", true)}
          </div>
          <Btn
            variant="primary"
            className="mt-5"
            onClick={saveContact}
            busy={savingKey === "contact"}
            disabled={save.isPending}
          >
            {tr("save")}
          </Btn>
        </Card>

        <Card className="p-5 sm:p-6">
          <h3 className="text-lg font-semibold">{tr("notifyEmails")}</h3>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">{tr("notifyEmailsHint")}</p>
          <input
            dir="ltr"
            aria-label={tr("notifyEmails")}
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="sales@bizarri.com, manager@bizarri.com"
            className={inputClass}
          />
          <Btn
            variant="primary"
            className="mt-4"
            onClick={saveEmails}
            busy={savingKey === "notify_emails"}
            disabled={save.isPending}
          >
            {tr("save")}
          </Btn>
        </Card>

        <Card className="p-5 sm:p-6">
          <h3 className="text-lg font-semibold">{tr("notifyWhatsapp")}</h3>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">{tr("notifyWhatsappHint")}</p>
          <p className="mb-4 rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
            {tr("callmebotSteps")}
          </p>

          {whatsapp.length === 0 && (
            <p className="mb-4 text-sm text-muted-foreground">{tr("noWhatsappNumbers")}</p>
          )}

          <div className="space-y-3">
            {whatsapp.map((r, i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field label={tr("whatsappPhoneLabel")}>
                  {(a) => (
                    <input
                      {...a}
                      dir="ltr"
                      value={r.phone}
                      onChange={(e) => {
                        const next = [...whatsapp];
                        next[i] = { ...next[i], phone: e.target.value };
                        setWhatsapp(next);
                      }}
                      placeholder="96594040955"
                      className={inputClass}
                    />
                  )}
                </Field>
                <Field label={tr("whatsappApikeyLabel")}>
                  {(a) => (
                    <input
                      {...a}
                      dir="ltr"
                      value={r.apikey}
                      onChange={(e) => {
                        const next = [...whatsapp];
                        next[i] = { ...next[i], apikey: e.target.value };
                        setWhatsapp(next);
                      }}
                      className={inputClass}
                    />
                  )}
                </Field>
                <IconBtn
                  tone="danger"
                  label={lang === "en" ? "Remove number" : "إزالة الرقم"}
                  onClick={() => setWhatsapp(whatsapp.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </IconBtn>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Btn
              onClick={() => setWhatsapp([...whatsapp, { phone: "", apikey: "" }])}
              icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              {tr("addNumber")}
            </Btn>
            <Btn
              variant="primary"
              onClick={saveWhatsapp}
              busy={savingKey === "notify_whatsapp"}
              disabled={save.isPending}
            >
              {tr("save")}
            </Btn>
          </div>
        </Card>
      </div>
    </section>
  );
}
