import { setTimeout as sleep } from 'node:timers/promises';
import { Injectable } from '@nestjs/common';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

@Injectable()
export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }

  sleep(ms: number): Promise<void> {
    return sleep(ms);
  }
}
