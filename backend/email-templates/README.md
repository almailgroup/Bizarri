# Bizarri email templates

`bizarri-en.html` and `bizarri-ar.html` (right to left) are the branded
layout for Bizarri's emails, made for Resend's template editor
(resend.com → Templates → HTML code editor). Paste the whole file in.

Images are served by the website, so the site must be deployed for them to
show: `https://bizarri.com/email/bizarri-logo-white.png` and
`https://bizarri.com/email/hero.jpg` (from `frontend/public/email/`).

## Variables

Written `{{{NAME}}}`, Resend's template syntax. The editor lists them once
the HTML is pasted; give each a fallback value there.

| Variable        | Example                                   |
|-----------------|-------------------------------------------|
| `TITLE`         | Your booking is confirmed                 |
| `GUEST_NAME`    | Fatima                                    |
| `MESSAGE`       | We are delighted to confirm your stay…    |
| `BOOKING_REF`   | BZR-4K2M9X                                |
| `CHALET`        | Bizarri Chalet 1                          |
| `CHECK_IN`      | Thu 5 Nov 2026 (2:00 PM is in the layout) |
| `CHECK_OUT`     | Sun 8 Nov 2026 (12:00 PM is in the layout)|
| `GUESTS`        | 8                                         |
| `TOTAL`         | KWD 350                                   |

Check-out is the morning after the last booked day, as on the website.
