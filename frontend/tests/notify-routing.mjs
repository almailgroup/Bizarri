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
globalThis.Deno = { serve: () => {}, env: { get: () => undefined } };

const { classify, renderDecision } = await import(
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

console.log(`\n${fails} failing`);
process.exit(fails ? 1 : 0);
