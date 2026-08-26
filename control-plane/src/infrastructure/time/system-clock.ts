import { setTimeout as sleep } from 'node:timers/promises';
import type { ClockPort } from '@application/ports/clock.port';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }

  sleep(ms: number): Promise<void> {
    return sleep(ms);
  }
}
