import {
  RUNNER_AUTH,
  type RunnerAuthPort,
} from '@application/ports/runner-auth.port';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RUNNER_ONLY } from '@presentation/http/decorators/runner-only.decorator';

@Injectable()
export class RunnerGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(RUNNER_AUTH) private readonly runners: RunnerAuthPort,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const runnerOnly = this.reflector.getAllAndOverride<boolean>(RUNNER_ONLY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!runnerOnly) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();

    if (!this.runners.admits(bearer(request.headers.authorization))) {
      throw new UnauthorizedException();
    }

    return true;
  }
}

const bearer = (header: string | undefined): string | undefined =>
  header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
