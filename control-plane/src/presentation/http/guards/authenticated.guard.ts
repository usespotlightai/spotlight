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

    const { headers } = context
      .switchToHttp()
      .getRequest<{ headers: RequestHeaders }>();

    if (!(await this.sessions.read(headers))) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
