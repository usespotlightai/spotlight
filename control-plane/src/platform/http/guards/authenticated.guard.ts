import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_ANONYMOUS } from '@platform/http/decorators/allow-anonymous.decorator';
import {
  REQUEST_USER,
  type RequestWithUser,
} from '@platform/http/decorators/current-user.decorator';
import { RUNNER_ONLY } from '@platform/http/decorators/runner-only.decorator';
import {
  type RequestHeaders,
  SESSION_READER,
  type SessionReaderPort,
} from '@shared-kernel/application/ports/session.port';

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SESSION_READER) private readonly sessions: SessionReaderPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = [ALLOW_ANONYMOUS, RUNNER_ONLY].some((marker) =>
      this.reflector.getAllAndOverride<boolean>(marker, [
        context.getHandler(),
        context.getClass(),
      ]),
    );

    if (skip) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ headers: RequestHeaders } & RequestWithUser>();

    const user = await this.sessions.read(request.headers);
    if (!user) {
      throw new UnauthorizedException();
    }

    request[REQUEST_USER] = user;

    return true;
  }
}
