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
import { z } from 'zod';

const PER_PAGE = 100;

const DELIVERY_ANSWERS = z.array(
  z.object({
    id: z.string(),
    guid: z.string(),
    delivered_at: z.string(),
    status_code: z.number().nullish(),
  }),
);

type DeliveryAnswer = z.infer<typeof DELIVERY_ANSWERS>[number];

interface Parsed {
  readonly source?: string;
}

const LIST_FAILED = 'Could not list the webhook deliveries of the GitHub App';

// A delivery id is a 64-bit integer. As a JS number it would round to another
// id, so the id keeps the exact digits GitHub sent.
const exactIds = (key: string, value: unknown, parsed?: Parsed): unknown => {
  if (key !== 'id' || typeof value !== 'number') {
    return value;
  }

  if (parsed?.source === undefined) {
    throw new Error('Could not read the exact id of a webhook delivery');
  }

  return parsed.source;
};

const answersIn = async (response: Response): Promise<DeliveryAnswer[]> => {
  if (!response.ok) {
    await answered(response, LIST_FAILED);
  }

  return DELIVERY_ANSWERS.parse(JSON.parse(await response.text(), exactIds));
};

const NEXT = /<([^>]+)>;\s*rel="next"/;

const cursorIn = (link: string | null | undefined): string | null => {
  const next = link?.match(NEXT)?.[1];

  return next !== undefined ? new URL(next).searchParams.get('cursor') : null;
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

    if (cursor !== null) {
      query.set('cursor', cursor);
    }

    const response = await call(
      `/app/hook/deliveries?${query}`,
      appJwt(this.env),
    );
    const answers = await answersIn(response);

    return {
      attempts: answers.map(attemptOf),
      next: cursorIn(response.headers.get('link')),
    };
  }

  async redeliver(attemptId: string): Promise<void> {
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
