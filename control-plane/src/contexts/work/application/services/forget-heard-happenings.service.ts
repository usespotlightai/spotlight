import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { HeardHappeningsPort } from '@work/application/ports/heard-happenings.port';

const KEPT_FOR_MS = 30 * 24 * 60 * 60 * 1000;

const FORGOTTEN_AT_ONCE = 1_000;

export class ForgetHeardHappenings {
  constructor(
    private readonly heard: HeardHappeningsPort,
    private readonly clock: ClockPort,
  ) {}

  async forget(): Promise<number> {
    const before = new Date(this.clock.now().getTime() - KEPT_FOR_MS);
    let forgotten = 0;

    for (;;) {
      const now = await this.heard.forgetBefore(before, FORGOTTEN_AT_ONCE);
      forgotten += now;

      if (now < FORGOTTEN_AT_ONCE) {
        return forgotten;
      }
    }
  }
}
