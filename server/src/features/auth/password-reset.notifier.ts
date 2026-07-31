export type PasswordResetNotification = {
  recipientName: string;
  recipientEmail: string;
  resetUrl: string;
  expiresInMinutes: number;
};

export interface PasswordResetNotifier {
  send(notification: PasswordResetNotification): Promise<void>;
}

export class DisabledPasswordResetNotifier implements PasswordResetNotifier {
  async send(): Promise<void> {
    throw new Error("Password-reset email delivery is not configured.");
  }
}
