import {
  type RequestHeaders,
  SESSION_READER,
  type SessionReaderPort,
} from '@application/ports/session.port';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_ANONYMOUS } from '@presentation/http/decorators/allow-anonymous.decorator';
import {
  REQUEST_USER,
  type RequestWithUser,
} from '@presentation/http/decorators/current-user.decorator';

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SESSION_READER) private readonly sessions: SessionReaderPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowAnonymous = this.reflector.getAllAndOverride<boolean>(
      ALLOW_ANONYMOUS,
      [context.getHandler(), context.getClass()],
    );

    if (allowAnonymous) {
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
