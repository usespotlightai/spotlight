import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookSignaturePort } from '@application/ports/webhook-signature.port';
import { ENV } from '@infrastructure/config/config.constants';
import type { Env } from '@infrastructure/config/env.schema';
import { Inject, Injectable } from '@nestjs/common';

const PREFIX = 'sha256=';

@Injectable()
export class GitHubWebhookSignature implements WebhookSignaturePort {
  constructor(@Inject(ENV) private readonly env: Env) {}

  signs(payload: Uint8Array, signature: string | undefined): boolean {
    // Nothing to check against is not the same as nothing to check: an
    // unconfigured webhook takes nobody's word for it.
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

    // Compared byte for byte in constant time, so a wrong signature gives
    // nothing away about how far along it went wrong.
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
