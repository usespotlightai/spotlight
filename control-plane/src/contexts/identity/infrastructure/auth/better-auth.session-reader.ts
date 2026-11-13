import type {
  SessionHeaders,
  SessionReaderPort,
  SessionUser,
} from '@identity/application/ports/session-reader.port';
import type { AppAuth } from '@identity/infrastructure/auth/auth';
import { AUTH } from '@identity/infrastructure/auth/auth.constants';
import { Inject, Injectable } from '@nestjs/common';
import { isAPIError } from 'better-auth/api';
import { fromNodeHeaders } from 'better-auth/node';

@Injectable()
export class BetterAuthSessionReader implements SessionReaderPort {
  constructor(@Inject(AUTH) private readonly auth: AppAuth) {}

  read(headers: SessionHeaders): Promise<SessionUser | null> {
    return this.userOf(fromNodeHeaders(headers));
  }

  readBearer(token: string): Promise<SessionUser | null> {
    return this.userOf(new Headers({ authorization: `Bearer ${token}` }));
  }

  private async userOf(headers: Headers): Promise<SessionUser | null> {
    const session = await this.auth.api
      .getSession({ headers })
      .catch((error: unknown) => {
        if (isAPIError(error) && error.statusCode === 401) {
          return null;
        }
        throw error;
      });

    if (!session) {
      return null;
    }

    const { id, email, name } = session.user;
    return { id, email, name };
  }
}
