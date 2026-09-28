import { setTimeout as sleep } from 'node:timers/promises';
import { Injectable } from '@nestjs/common';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

@Injectable()
export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }

  async sleep(ms: number, cancelled?: AbortSignal): Promise<void> {
    try {
      await sleep(ms, undefined, { signal: cancelled });
    } catch (error) {
      if (!cancelled?.aborted) {
        throw error;
      }
    }
  }
}
