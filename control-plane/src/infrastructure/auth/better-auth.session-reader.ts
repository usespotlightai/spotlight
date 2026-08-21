import type {
  AuthenticatedUser,
  RequestHeaders,
  SessionReaderPort,
} from '@application/ports/session.port';
import type { AppAuth } from '@infrastructure/auth/auth';
import { AUTH } from '@infrastructure/auth/auth.constants';
import { Inject, Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';

@Injectable()
export class BetterAuthSessionReader implements SessionReaderPort {
  constructor(@Inject(AUTH) private readonly auth: AppAuth) {}

  async read(headers: RequestHeaders): Promise<AuthenticatedUser | null> {
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(headers),
    });

    if (!session) {
      return null;
    }

    const { id, email, name } = session.user;
    return { id, email, name };
  }
}
