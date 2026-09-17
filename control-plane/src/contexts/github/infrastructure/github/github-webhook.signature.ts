import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookSignaturePort } from '@github/application/ports/webhook-signature.port';
import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';

const PREFIX = 'sha256=';

@Injectable()
export class GitHubWebhookSignature implements WebhookSignaturePort {
  constructor(@Inject(ENV) private readonly env: Env) {}

  signs(payload: Uint8Array, signature: string | undefined): boolean {
    if (!this.env.GITHUB_WEBHOOK_SECRET || !signature?.startsWith(PREFIX)) {
      return false;
    }

    const expected = Buffer.from(
      PREFIX +
        createHmac('sha256', this.env.GITHUB_WEBHOOK_SECRET)
          .update(payload)
          .digest('hex'),
    );
    const given = Buffer.from(signature);

    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
