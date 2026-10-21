import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { bearerIn } from '@platform/http/bearer';
import { ALLOW_ANONYMOUS } from '@platform/http/decorators/allow-anonymous.decorator';
import { ALLOW_WORKSPACE_TOKENS } from '@platform/http/decorators/allow-workspace-tokens.decorator';
import {
  REQUEST_PRINCIPAL,
  type RequestWithPrincipal,
} from '@platform/http/decorators/current-principal.decorator';
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
import {
  WORKSPACE_TOKEN_IDENTITY,
  type WorkspaceTokenIdentityPort,
} from '@shared-kernel/application/ports/workspace-token-identity.port';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

type AuthenticatedRequest = { headers: RequestHeaders } & RequestWithUser &
  RequestWithPrincipal;

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SESSION_READER) private readonly sessions: SessionReaderPort,
    @Inject(WORKSPACE_TOKEN_IDENTITY)
    private readonly tokens: WorkspaceTokenIdentityPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const marked = (marker: symbol) =>
      this.reflector.getAllAndOverride<boolean>(marker, [
        context.getHandler(),
        context.getClass(),
      ]) === true;

    if (marked(ALLOW_ANONYMOUS) || marked(RUNNER_ONLY)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { authorization } = request.headers;
    const presented = typeof authorization === 'string' ? authorization : '';
    const bearer = bearerIn(presented);

    if (presented !== '' && !bearer) {
      throw new UnauthorizedException(
        'The Authorization header must use the Bearer scheme.',
      );
    }

    if (bearer && marked(ALLOW_WORKSPACE_TOKENS)) {
      const principal = await this.tokens.authenticate(bearer);

      if (principal) {
        request[REQUEST_PRINCIPAL] = principal;

        return true;
      }
    }

    const user = bearer
      ? await this.sessions.readBearer(bearer)
      : await this.sessions.read(request.headers);

    if (!user && bearer && marked(ALLOW_WORKSPACE_TOKENS)) {
      throw new UnauthorizedException(
        'The token is unknown, expired or revoked.',
      );
    }

    if (!user && bearer) {
      throw new UnauthorizedException(
        'The token is not a current login. Workspace tokens cannot call this route.',
      );
    }

    if (!user) {
      throw new UnauthorizedException(
        'Your session is missing or expired. Please sign in.',
      );
    }

    request[REQUEST_USER] = user;
    request[REQUEST_PRINCIPAL] = PersonPrincipal.of(UserId.of(user.id));

    return true;
  }
}
