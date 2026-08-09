import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import type {
  EmailVerificationNotification,
  EmailVerificationNotifier
} from "./email-verification.notifier.js";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export class SesEmailVerificationNotifier implements EmailVerificationNotifier {
  private readonly client = new SESv2Client({});

  constructor(private readonly fromEmail: string) {}

  async send(notification: EmailVerificationNotification): Promise<void> {
    const name = escapeHtml(notification.recipientName);
    const verificationUrl = escapeHtml(notification.verificationUrl);
    const minutes = notification.expiresInMinutes;

    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.fromEmail,
        Destination: { ToAddresses: [notification.recipientEmail] },
        Content: {
          Simple: {
            Subject: { Data: "Verify your FormForge email" },
            Body: {
              Text: {
                Data: [
                  `Hello ${notification.recipientName},`,
                  "",
                  "Verify your email before publishing your first FormForge form:",
                  notification.verificationUrl,
                  "",
                  `This link expires in ${minutes} minutes and can only be used once.`,
                  "If you did not create this account, you can ignore this email."
                ].join("\n")
              },
              Html: {
                Data: `
                  <p>Hello ${name},</p>
                  <p>Verify your email before publishing your first FormForge form:</p>
                  <p><a href="${verificationUrl}">Verify your email</a></p>
                  <p>This link expires in ${minutes} minutes and can only be used once.</p>
                  <p>If you did not create this account, you can ignore this email.</p>
                `
              }
            }
          }
        }
      })
    );
  }
}
