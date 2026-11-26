import type {
  AppHookDeliveriesPort,
  HookDeliveryAttempt,
  HookDeliveryPage,
} from '@github/application/ports/app-hook-deliveries.port';
import { appJwt } from '@github/infrastructure/github/app-jwt';
import { answered, call } from '@github/infrastructure/github/github.rest';
import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';

const PER_PAGE = 100;

interface DeliveryAnswer {
  readonly id: number;
  readonly guid: string;
  readonly delivered_at: string;
  readonly status_code?: number | null;
}

const NEXT = /<([^>]+)>;\s*rel="next"/;

const cursorIn = (link: string | null | undefined): string | null => {
  const next = link?.match(NEXT)?.[1];

  return next ? new URL(next).searchParams.get('cursor') : null;
};

const attemptOf = (answer: DeliveryAnswer): HookDeliveryAttempt => ({
  id: answer.id,
  guid: answer.guid,
  deliveredAt: new Date(answer.delivered_at),
  statusCode: answer.status_code ?? null,
});

@Injectable()
export class GitHubAppHookDeliveries implements AppHookDeliveriesPort {
  constructor(@Inject(ENV) private readonly env: Env) {}

  async page(cursor: string | null): Promise<HookDeliveryPage> {
    const query = new URLSearchParams({ per_page: `${PER_PAGE}` });

    if (cursor) {
      query.set('cursor', cursor);
    }

    const response = await call(
      `/app/hook/deliveries?${query}`,
      appJwt(this.env),
    );
    const answers = await answered<DeliveryAnswer[]>(
      response,
      'Could not list the webhook deliveries of the GitHub App',
    );

    return {
      attempts: answers.map(attemptOf),
      next: cursorIn(response.headers.get('link')),
    };
  }

  async redeliver(attemptId: number): Promise<void> {
    await answered(
      await call(
        `/app/hook/deliveries/${attemptId}/attempts`,
        appJwt(this.env),
        { method: 'POST' },
      ),
      'Could not redeliver a webhook delivery of the GitHub App',
    );
  }
}
