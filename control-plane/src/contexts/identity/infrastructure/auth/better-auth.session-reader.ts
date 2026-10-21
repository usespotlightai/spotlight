import type { AppAuth } from '@identity/infrastructure/auth/auth';
import { AUTH } from '@identity/infrastructure/auth/auth.constants';
import { Inject, Injectable } from '@nestjs/common';
import type {
  AuthenticatedUser,
  RequestHeaders,
  SessionReaderPort,
} from '@shared-kernel/application/ports/session.port';
import { fromNodeHeaders } from 'better-auth/node';

@Injectable()
export class BetterAuthSessionReader implements SessionReaderPort {
  constructor(@Inject(AUTH) private readonly auth: AppAuth) {}

  read(headers: RequestHeaders): Promise<AuthenticatedUser | null> {
    return this.userOf(fromNodeHeaders(headers));
  }

  readBearer(token: string): Promise<AuthenticatedUser | null> {
    return this.userOf(new Headers({ authorization: `Bearer ${token}` }));
  }

  private async userOf(headers: Headers): Promise<AuthenticatedUser | null> {
    const session = await this.auth.api.getSession({ headers });

    if (!session) {
      return null;
    }

    const { id, email, name } = session.user;
    return { id, email, name };
  }
}
