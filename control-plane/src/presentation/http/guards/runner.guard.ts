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

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const runnerOnly = this.reflector.getAllAndOverride<boolean>(RUNNER_ONLY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!runnerOnly) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RunnerRequest>();

    const runner = await this.runners.identify(
      bearer(request.headers.authorization),
    );
    if (!runner) {
      throw new UnauthorizedException();
    }

    // The token said which runner this is. Handlers read it from here rather
    // than from anything the caller could have chosen.
    request.runnerId = runner.value;

    return true;
  }
}

export interface RunnerRequest {
  headers: Record<string, string | undefined>;
  runnerId?: string;
}

const bearer = (header: string | undefined): string | undefined =>
  header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
