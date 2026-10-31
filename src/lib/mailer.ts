/**
 * Minimal email delivery — no extra dependencies.
 *
 * Transport selection:
 *  1. RESEND_API_KEY set  → sends via the Resend REST API (fetch, no SDK)
 *  2. otherwise           → dev fallback: logs the message (with any
 *                           sensitive link) to the server console
 *
 * Adding real email in production is therefore just:
 *   RESEND_API_KEY=re_...  MAIL_FROM="KnightForge <no-reply@yourdomain>"
 */

export interface MailMessage {
  to: string
  subject: string
  text: string
}

export function mailerMode(): 'resend' | 'console' {
  return process.env.RESEND_API_KEY ? 'resend' : 'console'
}

async function sendViaResend(msg: MailMessage): Promise<boolean> {
  const from = process.env.MAIL_FROM || 'KnightForge <onboarding@resend.dev>'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
      }),
    })
    if (!res.ok) {
      console.error('[mailer] resend error:', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error('[mailer] resend request failed:', (err as Error).message)
    return false
  }
}

/** Send an email. Returns the transport used; never throws. */
export async function sendMail(msg: MailMessage): Promise<'resend' | 'console'> {
  const mode = mailerMode()
  if (mode === 'resend') {
    const ok = await sendViaResend(msg)
    if (ok) return 'resend'
    // fall through to console so the flow is never silently lost
  }
  console.info(
    `[mailer:console] to=${msg.to} subject="${msg.subject}"\n${msg.text}`
  )
  return 'console'
}

/** Password reset email — contains the 1-hour token. */
export function sendPasswordResetEmail(email: string, token: string) {
  return sendMail({
    to: email,
    subject: 'KnightForge — reset your password',
    text: [
      'Someone requested a password reset for your KnightForge account.',
      '',
      `Your reset token (valid for 1 hour): ${token}`,
      '',
      'Open KnightForge, click "Sign in" → "Forgot password?", paste the token',
      'and choose a new password. If you did not request this, ignore this email.',
    ].join('\n'),
  })
}
