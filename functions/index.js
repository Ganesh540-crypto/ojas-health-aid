const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

// Config via environment variables
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false') === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'Ojas <no-reply@ojas.ai>';
const OTP_TTL_MS = Number(process.env.OTP_TTL_MS || 10 * 60 * 1000);
const OTP_SECRET = process.env.OTP_SECRET || 'dev-secret-change-me';
const APP_NAME = process.env.APP_NAME || 'Ojas';

function hmac(email, code) {
  return crypto.createHmac('sha256', OTP_SECRET).update(`${email}:${code}`).digest('hex');
}

function verifyEmailHtml(link, email) {
  const color = '#ea580c';
  return `
  <div style="font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;background:#0b0b0b;padding:24px;color:#e5e7eb;">
    <div style="max-width:560px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:12px;padding:28px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <img src="https://ojas.ai/logo-jas.svg" alt="${APP_NAME}" width="28" height="28" style="display:block"/>
        <span style="font-weight:600;font-size:16px;letter-spacing:0.2px;">${APP_NAME}</span>
      </div>
      <h1 style="margin:10px 0 6px;font-size:22px;line-height:1.3;color:#f9fafb;">Verify your email</h1>
      <p style="margin:0 0 18px;font-size:14px;color:#9ca3af">Hi${email ? ` ${email}` : ''}, click the button below to verify your email for ${APP_NAME}.</p>
      <a href="${link}" style="display:inline-block;background:${color};color:white;font-weight:700;letter-spacing:0.4px;padding:12px 16px;border-radius:10px;font-size:16px;text-decoration:none">Verify email</a>
      <p style="margin:18px 0 0;font-size:12px;color:#9ca3af">If the button doesn’t work, copy and paste this link into your browser:</p>
      <p style="word-break:break-all;color:#9ca3af;font-size:12px;">${link}</p>
    </div>
    <p style="max-width:560px;margin:12px auto 0;text-align:center;font-size:11px;color:#6b7280">© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
  </div>`;
}

function otpEmailHtml(code) {
  const color = '#ea580c'; // Tailwind orange-600, aligns with primary
  return `
  <div style="font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;background:#0b0b0b;padding:24px;color:#e5e7eb;">
    <div style="max-width:560px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:12px;padding:28px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <img src="https://ojas.ai/logo-jas.svg" alt="${APP_NAME}" width="28" height="28" style="display:block"/>
        <span style="font-weight:600;font-size:16px;letter-spacing:0.2px;">${APP_NAME}</span>
      </div>
      <h1 style="margin:10px 0 6px;font-size:22px;line-height:1.3;color:#f9fafb;">Verify your email</h1>
      <p style="margin:0 0 18px;font-size:14px;color:#9ca3af">Use the code below to finish setting up your account. This code expires in 10 minutes.</p>
      <div style="display:inline-block;background:${color};color:white;font-weight:700;letter-spacing:6px;padding:12px 16px;border-radius:10px;font-size:22px;">${code}</div>
      <p style="margin:18px 0 0;font-size:12px;color:#9ca3af">Didn’t request this? You can ignore this email.</p>
    </div>
    <p style="max-width:560px;margin:12px auto 0;text-align:center;font-size:11px;color:#6b7280">© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
  </div>`;
}

function createTransport() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('SMTP env missing; emails will not be sent (dev mode).');
    return null;
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

// Azure Translator proxy over Firebase Functions (replaces Netlify function)
const AZURE_TRANSLATOR_KEY = process.env.AZURE_TRANSLATOR_KEY || '';
const AZURE_TRANSLATOR_REGION = process.env.AZURE_TRANSLATOR_REGION || '';
const AZURE_TRANSLATOR_ENDPOINT = process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com';

function buildTranslateUrl(base) {
  try {
    const u = new URL(base);
    const host = u.host.toLowerCase();
    const hasVersionPath = /\/translator\/text\/v3\.0/i.test(u.pathname);
    if (hasVersionPath) {
      const pathname = u.pathname.replace(/\/?$/, '/');
      return new URL(pathname + 'translate', u.origin);
    }
    if (host === 'api.cognitive.microsofttranslator.com') {
      return new URL('/translate', u.origin);
    }
    return new URL('/translator/text/v3.0/translate', u.origin);
  } catch {
    return new URL('/translate', 'https://api.cognitive.microsofttranslator.com');
  }
}

exports.translateText = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  if (!AZURE_TRANSLATOR_KEY || !AZURE_TRANSLATOR_REGION) {
    res.status(500).send('Server missing AZURE_TRANSLATOR_KEY or AZURE_TRANSLATOR_REGION');
    return;
  }
  try {
    const { texts, to, from } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!Array.isArray(texts) || typeof to !== 'string' || !to) {
      res.status(400).send('Invalid payload. Expected { texts: string[], to: string, from?: string }');
      return;
    }
    const url = buildTranslateUrl(AZURE_TRANSLATOR_ENDPOINT);
    url.searchParams.set('api-version', '3.0');
    url.searchParams.set('to', to);
    if (from) url.searchParams.set('from', from);

    const chunkSize = 90;
    const results = [];
    for (let i = 0; i < texts.length; i += chunkSize) {
      const slice = texts.slice(i, i + chunkSize);
      const r = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_TRANSLATOR_KEY,
          'Ocp-Apim-Subscription-Region': AZURE_TRANSLATOR_REGION,
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify(slice.map((t) => ({ Text: t || '' })))
      });
      if (!r.ok) {
        res.status(r.status).send(await r.text());
        return;
      }
      const data = await r.json();
      const translated = (data || []).map((row, idx) => row?.translations?.[0]?.text ?? slice[idx] ?? '');
      results.push(...translated);
    }
    res.status(200).json(results);
  } catch (e) {
    res.status(500).send(`Translator proxy error: ${e?.message || 'unknown'}`);
  }
});
// Legacy OTP functions removed

// HTTP endpoint to generate Firebase email verification link and send via SMTP
exports.sendVerifyLink = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const email = String(payload?.data?.email || '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const actionCodeSettings = {
      url: 'https://app.ojasai.co.in/email-action',
      handleCodeInApp: false,
    };
    const link = await admin.auth().generateEmailVerificationLink(email, actionCodeSettings);

    const transporter = createTransport();
    if (transporter) {
      await transporter.sendMail({
        from: SMTP_FROM,
        to: email,
        subject: `${APP_NAME} – Verify your email`,
        html: verifyEmailHtml(link, email),
      });
    } else {
      console.log(`[DEV] Verification link for ${email}: ${link}`);
    }

    return res.json({ result: { ok: true } });
  } catch (err) {
    console.error('sendVerifyLink failed', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});
