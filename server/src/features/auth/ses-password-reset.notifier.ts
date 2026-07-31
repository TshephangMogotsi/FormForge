import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import type {
  PasswordResetNotification,
  PasswordResetNotifier
} from "./password-reset.notifier.js";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export class SesPasswordResetNotifier implements PasswordResetNotifier {
  private readonly client = new SESv2Client({});

  constructor(private readonly fromEmail: string) {}

  async send(notification: PasswordResetNotification): Promise<void> {
    const name = escapeHtml(notification.recipientName);
    const resetUrl = escapeHtml(notification.resetUrl);
    const minutes = notification.expiresInMinutes;

    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.fromEmail,
        Destination: {
          ToAddresses: [notification.recipientEmail]
        },
        Content: {
          Simple: {
            Subject: {
              Data: "Reset your FormForge password"
            },
            Body: {
              Text: {
                Data: [
                  `Hello ${notification.recipientName},`,
                  "",
                  "Use the link below to choose a new FormForge password:",
                  notification.resetUrl,
                  "",
                  `This link expires in ${minutes} minutes and can only be used once.`,
                  "If you did not request this change, you can ignore this email."
                ].join("\n")
              },
              Html: {
                Data: `
                  <p>Hello ${name},</p>
                  <p>Use the link below to choose a new FormForge password:</p>
                  <p><a href="${resetUrl}">Reset your password</a></p>
                  <p>This link expires in ${minutes} minutes and can only be used once.</p>
                  <p>If you did not request this change, you can ignore this email.</p>
                `
              }
            }
          }
        }
      })
    );
  }
}
