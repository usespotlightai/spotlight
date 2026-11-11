import { OAUTH2_CALLBACK_ROUTE } from '@integrations/presentation/http/oauth2-callback-route';
import type { RequestHeaders } from '@platform/http/request-headers';
import { API_PREFIX } from '@platform/http/routes';

interface CookieOptions {
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: 'lax';
  readonly path: string;
  readonly expires?: Date;
}

export interface CookieJar {
  cookie(name: string, value: string, options: CookieOptions): void;
  clearCookie(name: string, options: CookieOptions): void;
}

const CALLBACK_PATH = `/${API_PREFIX}/${OAUTH2_CALLBACK_ROUTE}`;

export const OAUTH2_NONCE_COOKIE = 'spotlight_oauth2_nonce';

export class OAuth2NonceCookie {
  set(jar: CookieJar, nonce: string, expires: Date): void {
    jar.cookie(OAUTH2_NONCE_COOKIE, nonce, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: CALLBACK_PATH,
      expires,
    });
  }

  clear(jar: CookieJar): void {
    jar.clearCookie(OAUTH2_NONCE_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: CALLBACK_PATH,
    });
  }

  readFrom(headers: RequestHeaders): string | null {
    const header = headers.cookie;
    const cookies = Array.isArray(header) ? header.join('; ') : (header ?? '');

    for (const pair of cookies.split(';')) {
      const at = pair.indexOf('=');

      if (at > 0 && pair.slice(0, at).trim() === OAUTH2_NONCE_COOKIE) {
        const value = pair.slice(at + 1).trim();
        return value.length > 0 ? value : null;
      }
    }

    return null;
  }
}
