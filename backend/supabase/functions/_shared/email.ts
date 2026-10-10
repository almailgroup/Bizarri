/**
 * The branded email layout every Bizarri email is built from.
 *
 * The same design as backend/email-templates/: the white logo on a black
 * band, the front of the chalet, the message, a panel for the reference or
 * the code, a table of the stay, a black button, and a black footer with
 * the address and the ways to reach us. One function, so the code email,
 * the guest's emails and the team's alert cannot drift apart.
 *
 * Email clients are not browsers: tables and inline styles throughout,
 * images at absolute URLs on the site (frontend/public/email/), a 600px
 * column that narrows on a phone. Arabic is laid out right to left, with
 * references, codes, numbers and handles kept left to right.
 */

export type EmailLang = "en" | "ar";

const SITE = "https://bizarri.com";
const BLACK = "#0a0a0a";
const SAND = "#f3f2ef";
const RULE = "#e6e4df";
const MUTED = "#8a8a8a";

export function escapeHtml(s: string): string {
  return String(s).replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string,
  );
}

/** "96594040955" -> "+965 94040955", the site's one way of writing it. */
export function formatPhone(digits: string): string {
  const d = String(digits).replace(/\D/g, "");
  return d.startsWith("965") && d.length === 11 ? `+965 ${d.slice(3)}` : `+${d}`;
}

/**
 * "Thu 15 Oct 2026" / "الخميس، 15 أكتوبر 2026" from "2026-10-15", read in
 * UTC so no server time zone can move it a day. Latin digits in Arabic, as
 * on the site.
 */
export function formatEmailDate(iso: string, lang: EmailLang): string {
  const [y, m, d] = iso.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return lang === "ar"
    ? at.toLocaleDateString("ar-EG-u-nu-latn", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : at.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
}

export interface EmailRow {
  label: string;
  /** Already escaped: a value may carry a <span dir="ltr">. */
  valueHtml: string;
}

export interface BrandedEmail {
  lang: EmailLang;
  title: string;
  /** "Dear Fatima," -- plain text. */
  greeting?: string;
  /** Plain text, one paragraph each. */
  paragraphs?: string[];
  /** The booking reference, or the code: shown large, left to right. */
  panel?: { label: string; value: string; large?: boolean };
  rows?: EmailRow[];
  total?: { label: string; value: string };
  button?: { href: string; label: string };
  /** Small print under the button. Already escaped; may hold a link. */
  noteHtml?: string;
  /** The front of the chalet under the logo. Off for short, practical mail. */
  photo?: boolean;
  signOff?: boolean;
  /** Digits. No number, no WhatsApp link anywhere -- never a dead one. */
  whatsapp?: string;
  /** Profile URL for the footer. */
  instagram?: string;
}

const COPY = {
  en: {
    dir: "ltr",
    align: "left",
    font: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    home: `${SITE}/en`,
    eyebrow: "Bizarri Chalet &middot; Al Khiran",
    signOff: "Warm regards,",
    team: "The Bizarri Chalet team",
    name: "Bizarri Chalet",
    address: "Al Khiran Al Bahri, Road 278, Phase 3, Kuwait",
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    member: "A member of Almail Group",
    logoAlt: "Bizarri Chalet",
    photoAlt: "The front of Bizarri Chalet",
  },
  ar: {
    dir: "rtl",
    align: "right",
    font: "Tahoma, 'Geeza Pro', 'Segoe UI', Arial, sans-serif",
    home: `${SITE}/ar`,
    eyebrow: "شاليه بيزاري &middot; الخيران",
    signOff: "مع أطيب التحيات،",
    team: "فريق شاليه بيزاري",
    name: "شاليه بيزاري",
    address: "الخيران البحري، طريق 278، المرحلة الثالثة، الكويت",
    whatsapp: "واتساب",
    instagram: "إنستغرام",
    member: "عضو في مجموعة الميل",
    logoAlt: "شاليه بيزاري",
    photoAlt: "واجهة شاليه بيزاري",
  },
} as const;

export function brandedEmail(e: BrandedEmail): string {
  const c = COPY[e.lang];
  const ar = e.lang === "ar";
  const f = c.font;
  const al = c.align;
  const year = new Date().getUTCFullYear();
  const handle = (e.instagram ?? "").match(/instagram\.com\/([^/?#]+)/i)?.[1];

  const label = (text: string) =>
    `<p style="margin:0 0 6px; font-size:11px; ${ar ? "" : "letter-spacing:3px; text-transform:uppercase; "}color:${MUTED};">${escapeHtml(text)}</p>`;

  const rows = (e.rows ?? [])
    .map(
      (r) => `
              <tr>
                <td align="${al}" style="text-align:${al}; padding:12px 0; border-bottom:1px solid ${RULE}; color:${MUTED}; width:38%;">${escapeHtml(r.label)}</td>
                <td align="${al}" style="text-align:${al}; padding:12px 0; border-bottom:1px solid ${RULE}; font-weight:600;">${r.valueHtml}</td>
              </tr>`,
    )
    .join("");
  const total = e.total
    ? `
              <tr>
                <td align="${al}" style="text-align:${al}; padding:14px 0 0; color:${MUTED};">${escapeHtml(e.total.label)}</td>
                <td align="${al}" style="text-align:${al}; padding:14px 0 0; font-size:20px; font-weight:700; color:${BLACK};">${escapeHtml(e.total.value)}</td>
              </tr>`
    : "";

  const footerLinks = [
    e.whatsapp
      ? `<a href="https://wa.me/${escapeHtml(e.whatsapp)}" target="_blank" style="color:#ffffff; text-decoration:none;">${c.whatsapp}&nbsp;<span dir="ltr">${escapeHtml(formatPhone(e.whatsapp)).replace(" ", "&nbsp;")}</span></a>`
      : "",
    handle
      ? `<a href="${escapeHtml(e.instagram!)}" target="_blank" style="color:#ffffff; text-decoration:none;">${c.instagram}&nbsp;<span dir="ltr">@${escapeHtml(handle)}</span></a>`
      : "",
    `<a href="${c.home}" target="_blank" style="color:#ffffff; text-decoration:none;">bizarri.com</a>`,
  ]
    .filter(Boolean)
    .join("\n              &nbsp;&middot;&nbsp;\n              ");

  return `<!DOCTYPE html>
<html lang="${e.lang}" dir="${c.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(e.title)}</title>
<style>
  @media only screen and (max-width: 620px) {
    .px { padding-left: 24px !important; padding-right: 24px !important; }
    .h1 { font-size: 26px !important; line-height: 32px !important; }
    .panel { font-size: 24px !important; }
    .btn a { display: block !important; text-align: center !important; }
  }
</style>
</head>
<body dir="${c.dir}" style="margin:0; padding:0; background-color:${SAND}; -webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${SAND}" style="background-color:${SAND};">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" dir="${c.dir}" style="width:100%; max-width:600px; background-color:#ffffff;">
        <tr>
          <td align="center" bgcolor="${BLACK}" style="background-color:${BLACK}; padding:36px 24px 32px;">
            <a href="${c.home}" target="_blank" style="text-decoration:none;"><img src="${SITE}/email/bizarri-logo-white.png" width="168" height="61" alt="${c.logoAlt}" style="display:block; width:168px; height:auto; border:0; outline:none; color:#ffffff; font-family:${f}; font-size:24px;"></a>
          </td>
        </tr>${
          e.photo
            ? `
        <tr>
          <td style="line-height:0; font-size:0;"><img src="${SITE}/email/front.jpg" width="600" alt="${c.photoAlt}" style="display:block; width:100%; max-width:600px; height:auto; border:0;"></td>
        </tr>`
            : ""
        }
        <tr>
          <td class="px" align="${al}" style="text-align:${al}; padding:44px 48px 0; font-family:${f}; color:#1a1a1a;">
            <p style="margin:0 0 14px; font-size:11px; ${ar ? "" : "letter-spacing:3px; text-transform:uppercase; "}color:${MUTED};">${c.eyebrow}</p>
            <h1 class="h1" style="margin:0 0 24px; font-size:30px; line-height:36px; font-weight:700; color:${BLACK};">${escapeHtml(e.title)}</h1>${
              e.greeting
                ? `
            <p style="margin:0 0 16px; font-size:16px; line-height:26px;">${escapeHtml(e.greeting)}</p>`
                : ""
            }${(e.paragraphs ?? [])
              .map(
                (p) => `
            <p style="margin:0 0 16px; font-size:16px; line-height:26px; color:#3a3a3a;">${escapeHtml(p)}</p>`,
              )
              .join("")}
          </td>
        </tr>${
          e.panel
            ? `
        <tr>
          <td class="px" style="padding:16px 48px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${SAND}" style="background-color:${SAND}; ${ar ? "border-right" : "border-left"}:3px solid ${BLACK};">
              <tr>
                <td align="${al}" style="text-align:${al}; padding:20px 24px; font-family:${f};">
                  ${label(e.panel.label)}
                  <p class="panel" dir="ltr" align="${al}" style="margin:0; font-family:'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace; font-size:${e.panel.large ? 36 : 28}px; letter-spacing:${e.panel.large ? 8 : 2}px; color:${BLACK};">${escapeHtml(e.panel.value)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
            : ""
        }${
          rows || total
            ? `
        <tr>
          <td class="px" style="padding:28px 48px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${f}; font-size:15px; line-height:22px; color:#1a1a1a;">${rows}${total}
            </table>
          </td>
        </tr>`
            : ""
        }${
          e.button || e.noteHtml
            ? `
        <tr>
          <td class="px" align="${al}" style="text-align:${al}; padding:${e.button ? 40 : 28}px 48px 0;">${
            e.button
              ? `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn" style="width:auto;">
              <tr>
                <td bgcolor="${BLACK}" style="background-color:${BLACK};">
                  <a href="${escapeHtml(e.button.href)}" target="_blank" style="display:inline-block; padding:16px 34px; font-family:${f}; font-size:13px; ${ar ? "" : "letter-spacing:2px; text-transform:uppercase; "}color:#ffffff; text-decoration:none;">${escapeHtml(e.button.label)}</a>
                </td>
              </tr>
            </table>`
              : ""
          }${
            e.noteHtml
              ? `
            <p style="margin:18px 0 0; font-family:${f}; font-size:13px; line-height:20px; color:${MUTED};">${e.noteHtml}</p>`
              : ""
          }
          </td>
        </tr>`
            : ""
        }
        <tr>
          <td class="px" align="${al}" style="text-align:${al}; padding:${e.signOff ? "36px 48px 48px" : "0 48px 40px"}; font-family:${f}; font-size:15px; line-height:24px; color:#1a1a1a;">${
            e.signOff ? `${c.signOff}<br>\n            <strong>${c.team}</strong>` : "&nbsp;"
          }</td>
        </tr>
        <tr>
          <td class="px" align="${al}" bgcolor="${BLACK}" style="text-align:${al}; background-color:${BLACK}; padding:36px 48px; font-family:${f};">
            <p style="margin:0 0 12px; font-size:12px; ${ar ? "" : "letter-spacing:3px; text-transform:uppercase; "}color:#ffffff;">${c.name}</p>
            <p style="margin:0 0 16px; font-size:13px; line-height:21px; color:#a3a3a3;">${c.address}</p>
            <p style="margin:0 0 20px; font-size:13px; line-height:21px; color:#a3a3a3;">
              ${footerLinks}
            </p>
            <p style="margin:0; font-size:11px; line-height:18px; color:#6b6b6b;">${c.member} &middot; &copy; ${year} ${c.name}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
