export type EmailVerificationNotification = {
  recipientName: string;
  recipientEmail: string;
  verificationUrl: string;
  expiresInMinutes: number;
};

export interface EmailVerificationNotifier {
  send(notification: EmailVerificationNotification): Promise<void>;
}

export class DisabledEmailVerificationNotifier implements EmailVerificationNotifier {
  async send(): Promise<void> {
    throw new Error("Email-verification delivery is not configured.");
  }
}
