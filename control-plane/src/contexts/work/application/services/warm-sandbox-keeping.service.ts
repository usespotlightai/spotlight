import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { WarmSandboxKeepingPort } from '@work/application/ports/warm-sandbox-keeping.port';
import type { WarmSandboxLinesPort } from '@work/application/ports/warm-sandbox-lines.port';
import { WarmSandboxDemands } from '@work/domain/services/warm-sandbox-demand';

export const WARM_SANDBOXES_EVERY_MS = 30_000;

export class WarmSandboxKeeping {
  constructor(
    private readonly lines: WarmSandboxLinesPort,
    private readonly sandboxes: WarmSandboxKeepingPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async keep(): Promise<void> {
    const now = this.clock.now();
    const demand = WarmSandboxDemands.of({
      lines: await this.lines.keepingWarmSandboxes(),
      kept: await this.sandboxes.kept(),
      lostRecently: await this.sandboxes.linesLostSince(
        WarmSandboxDemands.lostAfter(now),
      ),
    });

    for (const sandboxId of demand.retired) {
      await this.sandboxes.retire(sandboxId).catch((error: unknown) => {
        this.logger.error({ err: error, sandboxId }, 'Retiring a warm sandbox');
      });
    }

    for (const request of demand.requested) {
      await this.sandboxes.request(request, now).catch((error: unknown) => {
        this.logger.error(
          { err: error, lineId: request.line.id.value },
          'Requesting a warm sandbox',
        );
      });
    }
  }
}
