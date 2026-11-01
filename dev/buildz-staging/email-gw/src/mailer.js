// Provider adapter.
// Replace sendEmail() with your actual SMTP/API provider implementation.
// Never put SMTP/API secrets in the browser.

import nodemailer from "nodemailer";

export async function sendEmail({from, to, subject, body, messageId}) {
  if (process.env.ENABLE_EMAIL_SEND !== "true") {
    throw new Error("Email sending is disabled. Set ENABLE_EMAIL_SEND=true after configuring a provider.");
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP provider is not configured.");
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  return transport.sendMail({
    from: process.env.MAIL_FROM || from,
    to,
    subject,
    text: body,
    messageId
  });
}
