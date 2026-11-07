import type { HookCallbackTokens } from '@integrations/application/services/hook-callback-tokens.service';
import { HookFiring } from '@integrations/domain/aggregates/hook-firing.aggregate';
import { HookFiringVersionConflictError } from '@integrations/domain/exceptions/hook-firing-version-conflict.error';
import type { HookFiringRepository } from '@integrations/domain/repositories/hook-firing.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

const PURGE_BATCH = 500;

export class PurgeHookFirings {
  constructor(
    private readonly firings: HookFiringRepository,
    private readonly callbacks: HookCallbackTokens,
    private readonly clock: ClockPort,
  ) {}

  async purge(): Promise<number> {
    const now = this.clock.now();
    const finished = await this.firings.finishedBefore(
      HookFiring.retentionCutoff(now),
      PURGE_BATCH,
    );

    for (const firing of finished) {
      try {
        await this.firings.save(firing.purge(now));
      } catch (error) {
        if (!(error instanceof HookFiringVersionConflictError)) {
          throw error;
        }
      }
    }

    await this.callbacks.purgeExpired();

    return finished.length;
  }
}
