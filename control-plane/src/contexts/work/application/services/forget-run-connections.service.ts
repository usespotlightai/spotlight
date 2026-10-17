import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunConnectionsPort } from '@work/application/ports/run-connections.port';

const KEPT_FOR_MS = 30 * 24 * 60 * 60 * 1000;

const FORGOTTEN_AT_ONCE = 5_000;

export class ForgetRunConnections {
  constructor(
    private readonly connections: RunConnectionsPort,
    private readonly clock: ClockPort,
  ) {}

  async forget(): Promise<number> {
    const before = new Date(this.clock.now().getTime() - KEPT_FOR_MS);
    let forgotten = 0;

    for (;;) {
      const now = await this.connections.forgetBefore(
        before,
        FORGOTTEN_AT_ONCE,
      );
      forgotten += now;

      if (now < FORGOTTEN_AT_ONCE) {
        return forgotten;
      }
    }
  }
}
