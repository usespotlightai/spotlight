export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export interface MailTransport {
  deliver(message: MailMessage): Promise<void>;
}
