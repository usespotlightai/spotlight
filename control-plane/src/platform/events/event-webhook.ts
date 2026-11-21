import { failureOf } from '@platform/outbound/outbound-failure';
import type { OutboundGuard } from '@platform/outbound/outbound-guard';
import { OutboundScope } from '@platform/outbound/outbound-scope';
import { keyOf, signatureOf } from '@platform/outbound/standard-webhooks';
import {
  type IntegrationEvent,
  isIntegrationEventKind,
} from '@shared-kernel/application/integration-events/integration-event';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import {
  type DomainEventSubscriber,
  type OutboxRecord,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';

const TIMEOUT_MS = 10_000;

const MAX_DETAIL = 500;

// The start of a response body, at most MAX_DETAIL bytes. It reads no more of the body than that.
const detailOf = async (answered: Response): Promise<string> => {
  const reader = answered.body?.getReader();

  if (!reader) {
    return '';
  }

  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (size < MAX_DETAIL) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      chunks.push(value);
      size += value.byteLength;
    }
  } catch {
    // The detail is only for the error message.
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return Buffer.concat(chunks).subarray(0, MAX_DETAIL).toString('utf8');
};

export const EVENT_WEBHOOK_SUBSCRIBER = 'platform.send-event-webhook';

// 24 attempts. The wait grows from 2 seconds to one hour, then stays at one hour.
export const EVENT_WEBHOOK_RETRY = Retry.backoff({
  maxAttempts: 24,
  initialDelayMs: 2_000,
  maxDelayMs: 60 * 60 * 1000,
});

// How long Spotlight tries before a delivery is a dead letter, in whole hours.
export const EVENT_WEBHOOK_RETRY_HOURS = Math.round(
  EVENT_WEBHOOK_RETRY.totalWaitMs() / 3_600_000,
);

export interface EventWebhookSettings {
  readonly url: string;
  readonly secret: string;
}

// The deployment event webhook (SPOTLIGHT_EVENT_WEBHOOK_URL). Each integration event is one POST, signed per Standard Webhooks. The order is not guaranteed, and an event can come again: a receiver drops repeats by webhook-id and reads the current state from the admin API.
export class EventWebhook {
  readonly #url: string;
  readonly #key: Buffer;

  constructor(
    settings: EventWebhookSettings,
    private readonly guard: OutboundGuard,
    private readonly clock: ClockPort,
  ) {
    this.#url = settings.url;
    this.#key = keyOf(settings.secret);
  }

  // The call goes out under the deployment's allow-list only, not the list of a workspace. It throws when the webhook does not answer 2xx, so that the outbox tries again.
  send(event: IntegrationEvent, record: OutboxRecord): Promise<void> {
    return OutboundScope.deployment(() => this.post(event, record));
  }

  private async post(
    event: IntegrationEvent,
    record: OutboxRecord,
  ): Promise<void> {
    const { kind, ...data } = event;
    const body = JSON.stringify({
      type: kind,
      timestamp: record.recordedAt.toISOString(),
      data,
    });
    const timestamp = Math.floor(this.clock.now().getTime() / 1000);

    let answered: Response;

    try {
      answered = await this.guard.fetch(this.#url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'webhook-id': record.id,
          'webhook-timestamp': String(timestamp),
          'webhook-signature': signatureOf(
            this.#key,
            record.id,
            timestamp,
            body,
          ),
        },
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(
        `Spotlight could not send the event to the event webhook: ${failureOf(error)}`,
      );
    }

    if (answered.status >= 200 && answered.status < 300) {
      await answered.body?.cancel().catch(() => undefined);
      return;
    }

    const response = await detailOf(answered);

    throw new Error(
      `The event webhook answered ${answered.status}.${response ? ` Response: ${response}` : ''}`,
    );
  }
}

export interface EventWebhookSubscription {
  readonly subscriber: DomainEventSubscriber;
  readonly prefixes: readonly string[];
}

// SPOTLIGHT_EVENT_WEBHOOK_KINDS names integration event kinds in full, such as runs.run-usage-recorded.v1, or contexts, such as identity. With no kinds, the subscriber hears every integration event. It never hears a domain event.
// Many integration events carry content, such as task text, pull request titles, review comments and run messages. The operator sends fewer kinds to send less of it.
export const eventWebhookSubscription = (
  webhook: EventWebhook,
  kinds: readonly string[],
): EventWebhookSubscription => ({
  subscriber: subscribing<IntegrationEvent>(
    EVENT_WEBHOOK_SUBSCRIBER,
    kinds.filter(isIntegrationEventKind),
    (event, record) => webhook.send(event, record),
    { callsOut: true, retry: EVENT_WEBHOOK_RETRY },
  ),
  prefixes:
    kinds.length === 0
      ? ['']
      : kinds.filter((each) => !isIntegrationEventKind(each)),
});
