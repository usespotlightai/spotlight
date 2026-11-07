import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { bearerIn } from '@platform/http/bearer';
import {
  REQUEST_RUNNER,
  type RequestWithRunner,
} from '@platform/http/decorators/current-runner.decorator';
import { RUNNER_HEARTBEAT } from '@platform/http/decorators/runner-heartbeat.decorator';
import { RUNNER_ONLY } from '@platform/http/decorators/runner-only.decorator';
import {
  RUNNER_HEARTBEATS,
  type RunnerHeartbeatsPort,
} from '@runners/application/ports/runner-heartbeats.port';
import {
  RUNNER_IDENTITY,
  type RunnerIdentityPort,
} from '@runners/application/ports/runner-identity.port';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';

@Injectable()
export class RunnerGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(RUNNER_IDENTITY) private readonly runners: RunnerIdentityPort,
    @Inject(RUNNER_HEARTBEATS)
    private readonly heartbeats: RunnerHeartbeatsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const runnerOnly = this.reflector.getAllAndOverride<boolean>(RUNNER_ONLY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!runnerOnly) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<
        { headers: Record<string, string | undefined> } & RequestWithRunner
      >();

    const runner = await this.runners.authenticate(
      bearerIn(request.headers.authorization),
    );
    if (!runner) {
      throw new UnauthorizedException(
        'The runner token is missing, no longer valid or wrong.',
      );
    }

    request[REQUEST_RUNNER] = runner.value;

    if (
      this.reflector.getAllAndOverride<boolean>(RUNNER_HEARTBEAT, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      await this.heartbeats.heartbeat(runner, this.clock.now());
    }

    return true;
  }
}
