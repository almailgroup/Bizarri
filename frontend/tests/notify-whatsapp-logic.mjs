// Verifies the CallMeBot logic in notify-booking/index.ts by mirroring the
// exact same functions (Deno-only globals stubbed) and running them under
// Node, since this sandbox has no Deno runtime to execute the function
// directly. This checks the algorithm and URL construction; it does not
// prove the deployed function behaves identically — that needs a real
// `supabase functions serve` run.
let fails = 0;
const ck = (n, c, d = "") => {
  if (!c) fails++;
  console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`);
};

function notifyWhatsAppFilter(value) {
  if (!Array.isArray(value)) return null;
  const recipients = value.filter(
    (v) =>
      !!v &&
      typeof v === "object" &&
      typeof v.phone === "string" &&
      typeof v.apikey === "string" &&
      v.phone.length > 0 &&
      v.apikey.length > 0,
  );
  return recipients.length > 0 ? recipients : null;
}

function renderWhatsApp(b) {
  const lines = [
    `*New booking request*`,
    `Ref: ${b.ref}`,
    `Chalet: Bizarri Chalet ${b.chalet_id}`,
    `Dates: ${b.start_date} → ${b.end_date} (${b.days} days)`,
    `Total: ${b.currency} ${b.total}`,
    `Guest: ${b.guest_name}`,
    `Phone: ${b.guest_phone}`,
    `Email: ${b.guest_email}`,
    `Guests: ${b.guests}`,
  ];
  if (b.notes) lines.push(`Notes: ${b.notes}`);
  return lines.join("\n");
}

function buildCallMeBotUrl(recipient, text) {
  return (
    `https://api.callmebot.com/whatsapp.php` +
    `?phone=${encodeURIComponent(recipient.phone)}` +
    `&text=${encodeURIComponent(text)}` +
    `&apikey=${encodeURIComponent(recipient.apikey)}`
  );
}

// ---- filtering: settings-row validation ----
ck("Rejects a non-array settings value", notifyWhatsAppFilter({ phone: "1" }) === null);
ck("Rejects an empty array", notifyWhatsAppFilter([]) === null);
ck("Drops an entry missing apikey", notifyWhatsAppFilter([{ phone: "96594040955" }]) === null);
ck(
  "Drops an entry with an empty phone",
  notifyWhatsAppFilter([{ phone: "", apikey: "x" }]) === null,
);
ck(
  "Keeps a valid entry",
  JSON.stringify(notifyWhatsAppFilter([{ phone: "96594040955", apikey: "123" }])) ===
    JSON.stringify([{ phone: "96594040955", apikey: "123" }]),
);
ck(
  "Filters out junk entries but keeps valid ones alongside them",
  notifyWhatsAppFilter([
    { phone: "1", apikey: "" },
    { phone: "96594040955", apikey: "123" },
  ]).length === 1,
);

// ---- message rendering ----
const booking = {
  ref: "BZR-AB12CD",
  chalet_id: 1,
  start_date: "2026-10-06",
  end_date: "2026-10-09",
  days: 4,
  total: 300,
  currency: "KWD",
  guest_name: "Aisha Al-Sabah",
  guest_phone: "+96594040955",
  guest_email: "aisha@example.com",
  guests: 4,
  notes: "Late check-in",
};
const msg = renderWhatsApp(booking);
ck("Message includes the booking reference", msg.includes("BZR-AB12CD"));
ck("Message includes the dates", msg.includes("2026-10-06 → 2026-10-09"));
ck("Message includes the total with currency", msg.includes("KWD 300"));
ck("Message includes notes when present", msg.includes("Late check-in"));
ck(
  "Message uses WhatsApp bold markup, not HTML",
  msg.includes("*New booking request*") && !msg.includes("<"),
);

const noNotes = renderWhatsApp({ ...booking, notes: null });
ck("Message omits the Notes line when there are none", !noNotes.includes("Notes:"));

// ---- URL construction: the actual CallMeBot contract ----
const url = buildCallMeBotUrl({ phone: "96594040955", apikey: "abc123" }, "hello *world*\nline2");
const parsed = new URL(url);
ck("Hits the real CallMeBot endpoint", url.startsWith("https://api.callmebot.com/whatsapp.php?"));
ck("Phone param round-trips exactly", parsed.searchParams.get("phone") === "96594040955");
ck("Apikey param round-trips exactly", parsed.searchParams.get("apikey") === "abc123");
ck(
  "Text param preserves newlines and formatting after decode",
  parsed.searchParams.get("text") === "hello *world*\nline2",
);

// A phone number typed with a leading + or spaces would be sent to CallMeBot
// as-is (it expects country-code digits only, no +) — confirm the function
// does NOT strip these, so the failure mode is visible in logs rather than
// silently mis-encoded.
const urlWithPlus = buildCallMeBotUrl({ phone: "+965 9404 0955", apikey: "k" }, "x");
ck(
  "Does not silently normalise a malformed phone (surfaces admin input errors instead of hiding them)",
  new URL(urlWithPlus).searchParams.get("phone") === "+965 9404 0955",
);

console.log("\n" + fails + " failing");
process.exit(fails ? 1 : 0);
