import { timingSafeEqual } from 'node:crypto';
import type { RunnerAuthPort } from '@application/ports/runner-auth.port';
import { ENV } from '@infrastructure/config/config.constants';
import type { Env } from '@infrastructure/config/env.schema';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class EnrollmentTokenAuth implements RunnerAuthPort {
  constructor(@Inject(ENV) private readonly env: Env) {}

  admits(token: string | undefined): boolean {
    if (!token) {
      return false;
    }

    const offered = Buffer.from(token);
    const expected = Buffer.from(this.env.RUNNER_ENROLLMENT_TOKEN);

    // Constant time. How quickly a wrong token is rejected would otherwise
    // tell an attacker how much of it was right.
    return (
      offered.length === expected.length && timingSafeEqual(offered, expected)
    );
  }
}
