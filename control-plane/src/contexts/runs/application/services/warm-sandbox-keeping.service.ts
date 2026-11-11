import type { WarmLinesPort } from '@runs/application/ports/warm-lines.port';
import type { WarmSandboxKeepingPort } from '@runs/application/ports/warm-sandbox-keeping.port';
import { WarmSandboxDemands } from '@runs/domain/services/warm-sandbox-demand';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export const WARM_SANDBOXES_EVERY_MS = 30_000;

export class WarmSandboxKeeping {
  constructor(
    private readonly lines: WarmLinesPort,
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
