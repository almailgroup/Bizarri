/**
 * Which webhook deliveries cause an email.
 *
 * An UPDATE hook fires on every column, so the decision notification is one
 * misjudged condition away from emailing a guest each time an admin types a
 * character into an internal note. That routing is the risk, so this runs the
 * real classify() out of notify-booking/index.ts rather than a copy of it —
 * a mirrored version would keep passing after the original changed.
 *
 * There is no Deno here, so the function is extracted and run under Node.
 * That checks the decision logic; it does not prove the deployed function
 * behaves identically, which needs `supabase functions serve`.
 */
import { build } from "esbuild";

let fails = 0;
const ck = (n, c, d = "") => {
  if (!c) fails++;
  console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`);
};

const entry = new URL("../../backend/supabase/functions/notify-booking/index.ts", import.meta.url)
  .pathname;

// Bundled with esbuild and imported, rather than sliced out of the file with
// a regex: a hand-rolled extractor breaks on the first type annotation it was
// not written for, and quietly testing nothing is worse than failing.
const built = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
  target: "es2022",
});

// The module calls Deno.serve at the top level, so importing it starts a
// server unless Deno is stubbed. Nothing here needs a real one.
// The handler is captured rather than discarded, so the delivery as a whole
// can be exercised too; env is a map a test can fill in.
let handler = null;
const env = {};
globalThis.Deno = { serve: (h) => (handler = h), env: { get: (k) => env[k] } };

const { classify, renderDecision, renderGuest, render, renderWhatsApp, checkOutDate } =
  await import(
    "data:text/javascript;base64," + Buffer.from(built.outputFiles[0].text).toString("base64")
  );

ck("The real classify() was imported, not a copy", typeof classify === "function");

const booking = (over = {}) => ({
  ref: "BZR-TEST01",
  chalet_id: 1,
  start_date: "2027-01-07",
  end_date: "2027-01-09",
  days: 3,
  total: 350,
  currency: "KWD",
  guest_name: "Guest",
  guest_phone: "+96594040955",
  guest_email: "guest@example.com",
  guests: 2,
  notes: null,
  status: "pending",
  ...over,
});

// ------------------------------------------------------------- a new request
ck("An insert is a new request", classify({ type: "INSERT", record: booking() }).action === "new");
ck(
  "A bare record, with no webhook envelope, still is",
  classify({ record: booking() }).action === "new",
);
ck(
  "Nothing at all is ignored rather than crashing",
  classify(null).action === "ignore",
  classify(null).reason,
);
ck(
  "A payload with no booking in it is ignored",
  classify({ type: "INSERT", record: {} }).action === "ignore",
);

// ----------------------------------------------------------------- decisions
for (const status of ["accepted", "rejected", "cancelled"]) {
  ck(
    `Moving a booking to ${status} tells the guest`,
    classify({
      type: "UPDATE",
      old_record: booking({ status: "pending" }),
      record: booking({ status }),
    }).action === "decision",
  );
}

// ------------------------------------------- everything else must stay quiet
{
  // The one that matters: an admin editing a phone number or writing an
  // internal note updates the row without deciding anything.
  const r = classify({
    type: "UPDATE",
    old_record: booking({ status: "pending" }),
    record: booking({ status: "pending", admin_note: "called them" }),
  });
  ck("Editing a booking without deciding sends nothing", r.action === "ignore", r.reason);
}
{
  const r = classify({
    type: "UPDATE",
    old_record: booking({ status: "accepted" }),
    record: booking({ status: "accepted" }),
  });
  ck("…even on an already-accepted booking", r.action === "ignore", r.reason);
}
{
  // An admin who accepted and then reconsidered leaves the guest holding a
  // confirmation that is no longer true. That is worth an email.
  const r = classify({
    type: "UPDATE",
    old_record: booking({ status: "accepted" }),
    record: booking({ status: "pending" }),
  });
  ck(
    "Putting an accepted booking back on the waiting list tells the guest",
    r.action === "decision",
  );
}
{
  const r = classify({
    type: "UPDATE",
    old_record: booking({ status: "rejected" }),
    record: booking({ status: "pending" }),
  });
  ck("…and so does reopening a rejected one", r.action === "decision");
}
{
  // A brand-new booking is pending too, but it arrives as an INSERT.
  const r = classify({ type: "INSERT", record: booking({ status: "pending" }) });
  ck("A new pending booking is still a new request, not a status change", r.action === "new");
}
{
  const r = classify({ type: "DELETE", old_record: booking(), record: booking() });
  ck("A delete sends nothing", r.action === "ignore", r.reason);
}
{
  // An UPDATE with no old_record cannot be shown to be a change.
  const r = classify({ type: "UPDATE", record: booking({ status: "accepted" }) });
  ck("An update with no previous row is ignored", r.action === "ignore", r.reason);
}

// ------------------------------------------- bookings the admin typed in
// The team made it, so the team is not emailed about it; the guest hears
// only if the admin left "email the guest" on.
{
  const admin = (over = {}) =>
    classify({ type: "INSERT", record: booking({ source: "admin", ...over }) });
  ck(
    "An admin's accepted booking goes to the guest",
    admin({ status: "accepted" }).action === "admin",
  );
  ck("…and so does a pending one", admin({ status: "pending" }).action === "admin");
  ck(
    "Not when the admin said not to email the guest",
    admin({ status: "accepted", notify_guest: false }).action === "ignore",
    admin({ status: "accepted", notify_guest: false }).reason,
  );
  ck(
    "A guest's own request is still a new request",
    classify({ type: "INSERT", record: booking({ source: "guest" }) }).action === "new",
  );
  ck(
    "…as is a row from before the column existed",
    classify({ type: "INSERT", record: booking() }).action === "new",
  );
}

// A decision must never be mistaken for a new request: that would email the
// team a second time and send the guest another "we have your request".
ck(
  "A decision is never treated as a new request",
  classify({
    type: "UPDATE",
    old_record: booking({ status: "pending" }),
    record: booking({ status: "accepted" }),
  }).action !== "new",
);

// ================================================== what the guest is sent
{
  const withNote = (status) =>
    renderDecision(
      { ...booking({ status }), admin_note: "haggled, gave 50 off", notes: "late arrival" },
      "en",
    );

  ck("An acceptance says so", /confirmed/i.test(withNote("accepted")));
  ck("A refusal reads as an apology, not a status code", /sorry/i.test(withNote("rejected")));
  ck("A cancellation says so", /cancelled/i.test(withNote("cancelled")));
  ck(
    "Going back to pending explains the wait",
    /under review|waiting list/i.test(withNote("pending")),
  );

  for (const status of ["accepted", "rejected", "cancelled", "pending"]) {
    // The admin panel calls that field internal. An admin writing
    // "haggled, gave 50 off" does not expect the guest to read it back.
    ck(
      `The internal note never reaches the guest (${status})`,
      !withNote(status).includes("haggled"),
    );
    ck(`…and the reference always does (${status})`, withNote(status).includes("BZR-TEST01"));
  }

  // The price of a stay that is not happening is noise at best.
  ck("A confirmed stay shows the total", withNote("accepted").includes("350"));
  ck("…as does one back under review", withNote("pending").includes("350"));
  ck("A refusal does not", !withNote("rejected").includes("350"));
  ck("Nor does a cancellation", !withNote("cancelled").includes("350"));

  // Guests are never sent WhatsApp messages, so the way back to a
  // conversation is a link they tap. A number they have to retype is not one.
  const linked = renderDecision(booking({ status: "accepted" }), "en", "96594040955");
  ck("The email offers a tappable way into WhatsApp", linked.includes("https://wa.me/96594040955"));
  ck(
    "…and only the one published number",
    (linked.match(/wa\.me\/(\d+)/g) ?? []).every((m) => m.endsWith("96594040955")),
  );
  ck(
    "No number configured means no dead button",
    !renderDecision(booking({ status: "accepted" }), "en", "").includes("wa.me"),
  );

  const ar = renderDecision(booking({ status: "accepted", lang: "ar" }), "ar");
  ck("The Arabic email is laid out right to left", ar.includes('dir="rtl"'));
  ck("…and is actually in Arabic", /[\u0600-\u06FF]/.test(ar));
}

// ============================================= check-in and check-out times
// The site and every message say the same thing: in at 2 PM on the first
// booked day, out at noon the morning after the last.
{
  ck(
    "Check-out is the morning after the last booked day",
    checkOutDate("2027-01-09") === "2027-01-10",
  );
  ck("…across a month end", checkOutDate("2027-01-31") === "2027-02-01");
  ck("…and a year end", checkOutDate("2026-12-31") === "2027-01-01");

  // Thu 7 Jan to Sat 9 Jan: in Thursday 2 PM, out Sunday noon.
  const b = booking({ status: "accepted" });
  const text = (html) =>
    html
      .replace(/<\/td>/g, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&middot;/g, "·")
      .replace(/\s+/g, " ");
  // Written out the way a person would say it, not as a database date.
  const inEn = "Check-in Thu, 7 Jan 2027 · 2:00 PM";
  const outEn = "Check-out Sun, 10 Jan 2027 · 12:00 PM";
  for (const [name, html] of [
    ["The team's email", render(b)],
    ["The guest's request email", renderGuest(b, "en")],
    ["The confirmation email", renderDecision(b, "en")],
    ["The under-review email", renderDecision({ ...b, status: "pending" }, "en")],
  ]) {
    ck(`${name} gives the check-in time`, text(html).includes(inEn));
    ck(`…and the check-out time`, text(html).includes(outEn));
  }

  const ar = text(renderGuest(b, "ar"));
  ck(
    "The Arabic email says it in Arabic, digits Latin like the site",
    ar.includes("الوصول الخميس، 7 يناير 2027 · 2:00 م") &&
      ar.includes("المغادرة الأحد، 10 يناير 2027 · 12:00 م"),
    ar.match(/الوصول[^م]*م/)?.[0],
  );
  // A bare 2027-01-07 in a right-to-left line is the thing that gets
  // scrambled; a date in words reads the same in either direction.
  ck("…with no bare ISO date for right-to-left to reorder", !ar.includes("2027-01-07"));

  // A refusal or a cancellation is not a stay to turn up for.
  ck(
    "A rejection gives no arrival time",
    !text(renderDecision({ ...b, status: "rejected" }, "en")).includes("Check-in"),
  );

  const wa = renderWhatsApp(b);
  ck(
    "The team's WhatsApp gives both times",
    wa.includes("Check-in: 2027-01-07 2:00 PM") && wa.includes("Check-out: 2027-01-10 12:00 PM"),
    wa
      .split("\n")
      .filter((l) => l.startsWith("Check"))
      .join(" | "),
  );
}

// ======================================== one design for every email sent
// The confirmation once went out as plain text in a box while the code email
// and the Resend template looked like Bizarri. Every message now goes through
// the same layout, so this checks the brand on each one rather than on one.
{
  const codeEntry = new URL(
    "../../backend/supabase/functions/send-email-code/index.ts",
    import.meta.url,
  ).pathname;
  const codeBuilt = await build({
    entryPoints: [codeEntry],
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    target: "es2022",
  });
  // That module calls Deno.serve too; keep the booking handler it would replace.
  const bookingHandler = handler;
  const { render: renderCode } = await import(
    "data:text/javascript;base64," + Buffer.from(codeBuilt.outputFiles[0].text).toString("base64")
  );
  handler = bookingHandler;
  ck("The code email's renderer was imported", typeof renderCode === "function");

  const b = booking({ status: "accepted" });
  const all = [
    ["team", render(b)],
    ["guest en", renderGuest(b, "en")],
    ["guest ar", renderGuest(b, "ar")],
    ...["accepted", "rejected", "cancelled", "pending"].flatMap((status) => [
      [`${status} en`, renderDecision({ ...b, status }, "en")],
      [`${status} ar`, renderDecision({ ...b, status }, "ar")],
    ]),
    ["code en", renderCode("004821", "en")],
    ["code ar", renderCode("004821", "ar")],
  ];
  for (const [name, html] of all) {
    ck(
      `Branded: ${name}`,
      html.includes("https://bizarri.com/email/bizarri-logo-white.png") &&
        /Almail Group|مجموعة الميل/.test(html) &&
        html.startsWith("<!DOCTYPE html>"),
    );
  }
  ck(
    "Arabic ones are right to left, English ones are not",
    all.every(([name, html]) => html.includes('dir="rtl"') === name.endsWith(" ar")),
  );
  ck("The code keeps its leading zeros", renderCode("004821", "en").includes("004821"));

  // Guests write their own name and notes; neither may become markup in an
  // email the team opens.
  const hostile = booking({ guest_name: "<img src=x onerror=alert(1)>", notes: "<b>hi</b>" });
  for (const [name, html] of [
    ["team", render(hostile)],
    ["guest", renderGuest(hostile, "en")],
    ["decision", renderDecision({ ...hostile, status: "accepted" }, "en")],
  ]) {
    ck(`Guest input is escaped (${name})`, !html.includes("<img src=x") && !html.includes("<b>hi"));
  }

  // The photo is the chalet's front, on the guest's copies; the team needs
  // the details, not a picture of a building they own.
  ck("The guest's email shows the chalet", renderGuest(b, "en").includes("/email/front.jpg"));
  ck("The team's does not", !render(b).includes("/email/front.jpg"));
}

// ===================================== the refundable insurance deposit
// The emails say what the booking page said: the stay, the deposit on top,
// a total that includes it, and that the deposit comes back.
{
  const flat = (html) =>
    html
      .replace(/<\/td>/g, " ")
      .replace(/<br\s*\/?>/g, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&middot;/g, "·")
      .replace(/\s+/g, " ");
  const withDeposit = booking({ status: "accepted", deposit: 100 });
  const NOTE =
    "A refundable insurance deposit of 100 KD is included in the total and will be fully refunded upon completion of your stay at the Chalet.";
  for (const [name, html] of [
    ["The guest's request email", renderGuest(withDeposit, "en")],
    ["The confirmation", renderDecision(withDeposit, "en")],
  ]) {
    const t = flat(html);
    ck(
      `${name} breaks the price down`,
      t.includes("Booking subtotal KD 350") &&
        t.includes("Refundable insurance deposit KD 100") &&
        t.includes("Total KD 450"),
    );
    ck(`…and says the deposit comes back`, t.includes(NOTE));
  }
  const team = flat(render(withDeposit));
  ck(
    "The team's email shows it too",
    team.includes("Refundable insurance deposit KD 100") && team.includes("Total KD 450"),
  );
  ck(
    "…and so does the team's WhatsApp",
    renderWhatsApp(withDeposit).includes("Deposit (refundable): KWD 100") &&
      renderWhatsApp(withDeposit).includes("Total: KWD 450"),
  );
  const ar = flat(renderGuest(withDeposit, "ar"));
  ck(
    "The Arabic email says it in Arabic",
    ar.includes("تأمين مسترد 100 د.ك") &&
      ar.includes("الإجمالي 450 د.ك") &&
      ar.includes("يشمل الإجمالي تأميناً مسترداً بقيمة 100 د.ك"),
  );
  const none = flat(renderGuest(booking({ status: "accepted", deposit: 0 }), "en"));
  ck(
    "A booking without one (older, or waived) is the stay alone",
    none.includes("Total KD 350") && !none.includes("deposit"),
  );
  ck(
    "A refusal names no price, deposit or otherwise",
    !flat(renderDecision({ ...withDeposit, status: "rejected" }, "en")).includes("deposit"),
  );
}

// ===================================== one failed send does not sink the rest
// The team's email let a network error escape: it rejected the Promise.all
// in the handler, the delivery became a 500, and the guest's copy went with
// it. Each send now fails alone.
{
  ck("The handler was captured", typeof handler === "function");
  env.RESEND_API_KEY = "re_test";
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init?.body ?? "{}");
    // The team's copy goes to the notification list, the guest's to them.
    if (String(url).includes("resend.com") && !body.to?.includes("guest@example.com")) {
      throw new TypeError("error sending request: connection reset");
    }
    sent.push(body.to);
    return new Response(JSON.stringify({ id: "x" }), { status: 200 });
  };
  const res = await handler(
    new Request("http://local/", {
      method: "POST",
      body: JSON.stringify({
        type: "INSERT",
        table: "bookings",
        record: booking(),
        old_record: null,
      }),
    }),
  );
  const out = await res.json();
  globalThis.fetch = realFetch;
  delete env.RESEND_API_KEY;
  ck(
    "A failed team email does not fail the delivery",
    res.status === 200,
    `${res.status} ${JSON.stringify(out)}`,
  );
  ck(
    "…and the guest's copy still goes",
    out.guestEmail?.delivered === true && sent.some((t) => t?.includes("guest@example.com")),
  );
  ck(
    "…with the team's reported as not delivered",
    out.email?.attempted === true && out.email?.delivered === false,
  );
}

// ================================ an admin booking, delivered end to end
{
  env.RESEND_API_KEY = "re_test";
  const deliver = async (record) => {
    const sent = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      if (String(url).includes("resend.com")) sent.push(JSON.parse(init?.body ?? "{}"));
      return new Response(JSON.stringify({ id: "x" }), { status: 200 });
    };
    const res = await handler(
      new Request("http://local/", {
        method: "POST",
        body: JSON.stringify({ type: "INSERT", table: "bookings", record, old_record: null }),
      }),
    );
    globalThis.fetch = realFetch;
    return { status: res.status, out: await res.json(), sent };
  };

  const accepted = await deliver(booking({ source: "admin", status: "accepted" }));
  ck(
    "An admin's accepted booking emails only the guest",
    accepted.sent.length === 1 && accepted.sent[0].to?.[0] === "guest@example.com",
    JSON.stringify(accepted.sent.map((m) => m.to)),
  );
  ck(
    '…and it is the confirmation, not "we have your request"',
    /Confirmed/.test(accepted.sent[0]?.subject ?? "") &&
      /Your booking is confirmed/.test(accepted.sent[0]?.html ?? ""),
    accepted.sent[0]?.subject,
  );

  const pending = await deliver(booking({ source: "admin", status: "pending" }));
  ck(
    "A pending one sends the guest the request copy",
    pending.sent.length === 1 && /booking request/i.test(pending.sent[0]?.subject ?? ""),
    pending.sent[0]?.subject,
  );

  const quiet = await deliver(
    booking({ source: "admin", status: "accepted", notify_guest: false }),
  );
  ck(
    '"Don\'t email the guest" sends nothing at all',
    quiet.sent.length === 0 && quiet.status === 200,
  );
  delete env.RESEND_API_KEY;
}

console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
