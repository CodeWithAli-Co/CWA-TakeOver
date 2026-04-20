# Offer-letter email send — setup

The **Send** button on the offer-letters dashboard calls a Supabase
Edge Function named `send-offer-email`. The function holds the Resend
API key server-side (never shipped to the client) and emails the
candidate a branded HTML message with the PDF attached + the signed
accept-link URL.

## Prerequisites

1. **Resend account** — https://resend.com. Free tier is fine.
2. **Verified sending domain** on Resend (e.g. `hire.codewithali.com`).
   Takes ~10 minutes — DNS TXT records. Without this, emails will go
   to spam or be rejected.
3. **Supabase CLI** installed locally: `bun add -g supabase` or
   `npm i -g supabase`.

## Step 1 — project secrets

In your Supabase dashboard → Project Settings → Edge Functions → Secrets:

```
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=Hiring at CodeWithAli <hiring@hire.codewithali.com>
```

`EMAIL_FROM` must be on a domain Resend has verified. The display name
is optional but recommended.

## Step 2 — create the Edge Function

From the repo root:

```bash
supabase functions new send-offer-email
```

Replace the generated `supabase/functions/send-offer-email/index.ts` with:

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "Hiring <hiring@example.com>";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  to: string;
  candidateName: string;
  positionTitle: string;
  employerLegalName: string;
  brand: "codeWithAli" | "simplicity";
  acceptUrl: string;
  pdfBase64: string;
  pdfName: string;
}

const BRAND_COLORS = {
  codeWithAli: { bg: "#DC2626", label: "CodeWithAli" },
  simplicity: { bg: "#0D9488", label: "Simplicity" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
  try {
    const body = (await req.json()) as Body;
    const brand = BRAND_COLORS[body.brand] ?? BRAND_COLORS.codeWithAli;

    const html = `
<!doctype html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;background:#f5f5f7;margin:0;padding:24px;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
    <tr><td style="height:6px;background:${brand.bg};"></td></tr>
    <tr><td style="padding:28px 28px 8px;">
      <div style="font-family:Helvetica,Arial,sans-serif;font-weight:700;font-size:20px;color:${brand.bg};">
        ${body.employerLegalName}
      </div>
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#6b7280;margin-top:2px;">
        ${brand.label} · Employment offer
      </div>
    </td></tr>
    <tr><td style="padding:18px 28px 6px;font-size:15px;line-height:1.6;color:#111;">
      <p>Hi ${escapeHtml(body.candidateName.split(" ")[0] || body.candidateName)},</p>
      <p>We're excited to extend an offer for the <b>${escapeHtml(body.positionTitle)}</b> role at ${escapeHtml(body.employerLegalName)}. The full offer letter is attached as a PDF.</p>
      <p>When you're ready, click the button below to review and sign:</p>
    </td></tr>
    <tr><td style="padding:8px 28px 28px;">
      <a href="${body.acceptUrl}" style="display:inline-block;padding:12px 22px;background:${brand.bg};color:#fff;text-decoration:none;font-weight:600;border-radius:8px;font-size:14px;">Review & sign offer →</a>
      <p style="font-size:12px;color:#6b7280;margin-top:16px;">Or paste this URL into your browser:<br/><a href="${body.acceptUrl}" style="color:${brand.bg};word-break:break-all;">${body.acceptUrl}</a></p>
    </td></tr>
    <tr><td style="padding:16px 28px;background:#f9fafb;font-size:11px;color:#6b7280;border-top:1px solid #e5e7eb;">
      Sent by ${escapeHtml(body.employerLegalName)}. If you weren't expecting this, please ignore this email.
    </td></tr>
  </table>
</body></html>`.trim();

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [body.to],
        subject: `Offer for ${body.positionTitle} — ${body.employerLegalName}`,
        html,
        attachments: [
          {
            filename: body.pdfName,
            content: body.pdfBase64,
          },
        ],
      }),
    });

    if (!resendRes.ok) {
      const txt = await resendRes.text();
      return new Response(JSON.stringify({ error: `Resend ${resendRes.status}: ${txt}` }), {
        status: 502,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }
    const data = await resendRes.json();
    return new Response(JSON.stringify({ ok: true, id: data?.id }), {
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

## Step 3 — deploy

```bash
supabase functions deploy send-offer-email --no-verify-jwt
```

`--no-verify-jwt` is important — the function is called from the
authenticated app with the anon key, and we don't need JWT validation
for this flow.

## Step 4 — test

In the offer-letters dashboard:

1. Save a draft.
2. Paste a test email (your own) in the **Email to candidate** row.
3. Click **Send**.
4. You should receive the branded email with the PDF attached within
   a few seconds.
5. Clicking the **Review & sign offer** button opens `/offer/accept/{token}`.

## Troubleshooting

- `Edge function 'send-offer-email' isn't deployed` → run the deploy command above.
- Email arrives but is in spam → make sure your sending domain is
  verified on Resend (SPF + DKIM + DMARC records).
- Resend rejects with "from not allowed" → the `EMAIL_FROM` address
  must be on a verified domain.
- Status never flips to `sent` → the update is ignored if RLS policy
  rejects anon UPDATE. Already handled in the phase-2 migration.
