import type {
  MailMessage,
  MailTransport,
} from '@identity/infrastructure/mail/mail.transport';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export class WrittenDownMail implements MailTransport {
  constructor(private readonly logger: LoggerPort) {}

  async deliver(message: MailMessage): Promise<void> {
    this.logger.warn(
      { to: message.to, subject: message.subject, body: message.text },
      'No mail server configured, so this message was only written down',
    );
  }
}
