import type { OutboundGuard } from '@platform/outbound/outbound-guard';
import { OutboundScope } from '@platform/outbound/outbound-scope';
import { signatureOf } from '@platform/outbound/standard-webhooks';
import {
  type IntegrationEvent,
  isIntegrationEventKind,
} from '@shared-kernel/application/integration-events/integration-event';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import {
  type DomainEventSubscriber,
  type EventEnvelope,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';

const TIMEOUT_MS = 10_000;

const MAX_DETAIL = 500;

const SECRET_PREFIX = 'whsec_';

export const EVENT_WEBHOOK_SUBSCRIBER = 'platform.send-event-webhook';

// 24 attempts. The wait grows from 2 seconds to one hour, so Spotlight tries for about 13 hours before the delivery is a dead letter.
export const EVENT_WEBHOOK_RETRY = Retry.backoff({
  maxAttempts: 24,
  initialDelayMs: 2_000,
  maxDelayMs: 60 * 60 * 1000,
});

export interface EventWebhookSettings {
  readonly url: string;
  readonly secret: string;
}

const described = (error: unknown): string => {
  const cause = (error as { cause?: unknown }).cause;

  return error instanceof Error
    ? cause instanceof Error
      ? `${error.message}: ${cause.message || (cause as { code?: string }).code || cause.name}`
      : error.message
    : String(error);
};

// The deployment event webhook (SPOTLIGHT_EVENTS_URL). Each integration event is one POST, signed per Standard Webhooks. The order is not guaranteed, and an event can come again: a receiver drops repeats by webhook-id and reads the current state from the admin API.
export class EventWebhook {
  readonly #key: Buffer;

  constructor(
    private readonly settings: EventWebhookSettings,
    private readonly guard: OutboundGuard,
    private readonly clock: ClockPort,
  ) {
    this.#key = Buffer.from(
      settings.secret.slice(SECRET_PREFIX.length),
      'base64',
    );
  }

  // The call goes out under the deployment's allow-list only, not the list of a workspace. It throws when the webhook does not answer 2xx, so that the outbox tries again.
  send(event: IntegrationEvent, envelope: EventEnvelope): Promise<void> {
    return OutboundScope.deployment(() => this.sent(event, envelope));
  }

  private async sent(
    event: IntegrationEvent,
    envelope: EventEnvelope,
  ): Promise<void> {
    const { kind, ...data } = event;
    const body = JSON.stringify({
      type: kind,
      timestamp: envelope.recordedAt.toISOString(),
      data,
    });
    const timestamp = Math.floor(this.clock.now().getTime() / 1000);

    let answered: Response;

    try {
      answered = await this.guard.fetch(this.settings.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'webhook-id': envelope.id,
          'webhook-timestamp': String(timestamp),
          'webhook-signature': signatureOf(
            this.#key,
            envelope.id,
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
        `Spotlight could not send the event to the event webhook: ${described(error)}`,
      );
    }

    const response = (await answered.text().catch(() => '')).slice(
      0,
      MAX_DETAIL,
    );

    if (answered.status < 200 || answered.status >= 300) {
      throw new Error(
        `The event webhook answered ${answered.status}.${response ? ` Response: ${response}` : ''}`,
      );
    }
  }
}

export interface EventWebhookSubscription {
  readonly subscriber: DomainEventSubscriber;
  readonly prefixes: readonly string[];
}

// SPOTLIGHT_EVENTS_KINDS names integration event kinds in full, such as runs.run-usage-recorded.v1, or contexts, such as identity. With no kinds, the subscriber hears every integration event. It never hears a domain event.
// Many integration events carry content, such as task text, pull request titles, review comments and run messages. The operator sends fewer kinds to send less of it.
export const eventWebhookSubscription = (
  webhook: EventWebhook,
  kinds: readonly string[],
): EventWebhookSubscription => ({
  subscriber: subscribing<IntegrationEvent>(
    EVENT_WEBHOOK_SUBSCRIBER,
    kinds.filter(isIntegrationEventKind),
    (event, envelope) => webhook.send(event, envelope),
    { callsOut: true, retry: EVENT_WEBHOOK_RETRY },
  ),
  prefixes:
    kinds.length === 0
      ? ['']
      : kinds.filter((each) => !isIntegrationEventKind(each)),
});
