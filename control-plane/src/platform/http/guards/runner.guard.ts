import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUEST_RUNNER,
  type RequestWithRunner,
} from '@platform/http/decorators/current-runner.decorator';
import { RUNNER_ONLY } from '@platform/http/decorators/runner-only.decorator';
import {
  RUNNER_IDENTITY,
  type RunnerIdentityPort,
} from '@shared-kernel/application/ports/runner-identity.port';

@Injectable()
export class RunnerGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(RUNNER_IDENTITY) private readonly runners: RunnerIdentityPort,
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

    const runner = await this.runners.identify(
      bearer(request.headers.authorization),
    );
    if (!runner) {
      throw new UnauthorizedException();
    }

    request[REQUEST_RUNNER] = runner.value;

    return true;
  }
}

const bearer = (header: string | undefined): string | undefined =>
  header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
