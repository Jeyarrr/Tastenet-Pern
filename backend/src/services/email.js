import nodemailer from "nodemailer";
import { HttpError } from "../lib/HttpError.js";
export function emailAvailable(config) {
  return Boolean(config.SMTP_HOST && config.SMTP_FROM);
}
export function emailSender(config) {
  const transport = emailAvailable(config)
    ? nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT || 587,
        secure: config.SMTP_SECURE === true,
        ...(config.SMTP_USER
          ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } }
          : {}),
        connectionTimeout: 10000,
        socketTimeout: 15000,
      })
    : null;
  return async ({ email, code, purpose }) => {
    if (!transport)
      throw new HttpError(
        503,
        "EMAIL_UNAVAILABLE",
        "Email verification is temporarily unavailable. Please contact the administrator.",
      );
    await transport.sendMail({
      from: config.SMTP_FROM,
      to: email,
      subject: `TasteNet ${purpose === "register" ? "email verification" : "password reset"}`,
      text: `Your TasteNet verification code is ${code}. It expires in 10 minutes. If you did not request this code, ignore this message.`,
    });
  };
}
