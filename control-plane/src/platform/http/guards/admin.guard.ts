import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { bearerIn } from '@platform/http/bearer';
import { ADMIN_ONLY } from '@platform/http/decorators/admin-only.decorator';
import type { RequestHeaders } from '@platform/http/request-headers';
import {
  TOKEN_ISSUER,
  type TokenIssuer,
} from '@shared-kernel/application/ports/token-issuer.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

@Injectable()
export class AdminGuard implements CanActivate {
  readonly #tokenHash: TokenHash | null;

  constructor(
    private readonly reflector: Reflector,
    @Inject(ENV) env: Env,
    @Inject(TOKEN_ISSUER) private readonly tokens: TokenIssuer,
  ) {
    this.#tokenHash =
      env.SPOTLIGHT_ADMIN_TOKEN !== undefined &&
      env.SPOTLIGHT_ADMIN_TOKEN !== ''
        ? TokenHash.of(tokens.hash(env.SPOTLIGHT_ADMIN_TOKEN))
        : null;
  }

  canActivate(context: ExecutionContext): boolean {
    const adminOnly = this.reflector.getAllAndOverride<boolean | undefined>(
      ADMIN_ONLY,
      [context.getHandler(), context.getClass()],
    );

    if (adminOnly !== true) {
      return true;
    }

    if (!this.#tokenHash) {
      throw new NotFoundException();
    }

    const { authorization } = context
      .switchToHttp()
      .getRequest<{ headers: RequestHeaders }>().headers;
    const presented = bearerIn(
      typeof authorization === 'string' ? authorization : undefined,
    );

    if (
      presented === undefined ||
      presented === '' ||
      !TokenHash.of(this.tokens.hash(presented)).equals(this.#tokenHash)
    ) {
      throw new UnauthorizedException('The admin token is missing or wrong.');
    }

    return true;
  }
}
