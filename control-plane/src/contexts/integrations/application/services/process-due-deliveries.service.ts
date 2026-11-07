import { ReadDeliveryCommand } from '@integrations/application/commands/read-delivery.command';
import type { DeliveryWorkPort } from '@integrations/application/ports/delivery-work.port';
import type { InboundDelivery } from '@integrations/domain/aggregates/inbound-delivery.aggregate';
import { InboundDeliveryVersionConflictError } from '@integrations/domain/exceptions/inbound-delivery-version-conflict.error';
import type { InboundDeliveryRepository } from '@integrations/domain/repositories/inbound-delivery.repository';
import { DeliveryFailure } from '@integrations/domain/value-objects/delivery-failure.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';

const CLAIM_WINDOW = 20;

const because = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class ProcessDueDeliveries implements DeliveryWorkPort {
  constructor(
    private readonly deliveries: InboundDeliveryRepository,
    private readonly reading: CommandHandlerPort<
      ReadDeliveryCommand,
      DeliveryFailure | null
    >,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
    private readonly telemetry: TelemetryPort,
  ) {}

  async workOne(): Promise<boolean> {
    const claimed = await this.claimNext();

    if (!claimed) {
      return false;
    }

    const ids = {
      deliveryId: claimed.id.value,
      integration: claimed.integration.value,
      workspaceId: claimed.to?.workspaceId.value,
      teamId: claimed.to?.teamId.value,
    };

    await this.telemetry.inSpan('Reading a delivery', ids, async () => {
      const finished = await this.read(claimed, ids);

      try {
        await this.deliveries.save(finished);
      } catch (error) {
        if (!(error instanceof InboundDeliveryVersionConflictError)) {
          throw error;
        }

        this.logger.warn(
          { ...ids, err: error },
          'A delivery was claimed again before its read finished',
        );
      }
    });

    return true;
  }

  async processDue(limit = 100): Promise<number> {
    let worked = 0;

    while (worked < limit && (await this.workOne())) {
      worked += 1;
    }

    return worked;
  }

  private async claimNext(): Promise<InboundDelivery | null> {
    const now = this.clock.now();
    const candidates = await this.deliveries.claimCandidates(now, CLAIM_WINDOW);

    for (const candidate of candidates) {
      if (!candidate.isClaimableAt(now)) {
        continue;
      }

      try {
        await this.deliveries.save(candidate.claimed(now));
      } catch (error) {
        if (error instanceof InboundDeliveryVersionConflictError) {
          continue;
        }
        throw error;
      }

      return this.deliveries.current(candidate);
    }

    return null;
  }

  private async read(
    claimed: InboundDelivery,
    ids: Readonly<Record<string, string | undefined>>,
  ): Promise<InboundDelivery> {
    const failure = await this.reading
      .execute(
        new ReadDeliveryCommand({
          integration: claimed.integration,
          to: claimed.to,
          id: claimed.id,
          receivedAs: claimed.receivedAs,
          headers: claimed.headers,
          body: claimed.body,
          causeFiringId: claimed.causeFiringId,
        }),
      )
      .catch((error: unknown) => {
        this.logger.error(
          { ...ids, err: error },
          'A delivery failed in Spotlight',
        );

        return DeliveryFailure.permanent(because(error));
      });

    return failure
      ? this.failed(claimed, failure, ids)
      : claimed.worked(this.clock.now());
  }

  private failed(
    claimed: InboundDelivery,
    failure: DeliveryFailure,
    ids: Readonly<Record<string, string | undefined>>,
  ): InboundDelivery {
    const failed = claimed.failedWith(failure, this.clock.now());

    if (failed.gaveUp) {
      this.logger.error(
        { ...ids, reason: failure.reason, attempts: failed.attempts },
        'Gave up reading a delivery',
      );
    } else {
      this.logger.warn(
        { ...ids, reason: failure.reason, attempts: failed.attempts },
        'Reading a delivery',
      );
    }

    return failed;
  }
}
