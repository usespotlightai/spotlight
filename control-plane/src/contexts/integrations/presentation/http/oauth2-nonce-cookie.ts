import { OAUTH2_CALLBACK_ROUTE } from '@integrations/application/ports/oauth2-linking.port';
import { API_PREFIX } from '@platform/http/routes';
import type { RequestHeaders } from '@shared-kernel/application/ports/session.port';

export interface CookieOptions {
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

export const OAUTH2_NONCE_COOKIE = 'spotlight_oauth2_nonce';

export class OAuth2NonceCookie {
  constructor(private readonly secure: boolean) {}

  static forPublicUrl(url: string): OAuth2NonceCookie {
    return new OAuth2NonceCookie(new URL(url).protocol === 'https:');
  }

  set(jar: CookieJar, nonce: string, expires: Date): void {
    jar.cookie(OAUTH2_NONCE_COOKIE, nonce, { ...this.options(), expires });
  }

  clear(jar: CookieJar): void {
    jar.clearCookie(OAUTH2_NONCE_COOKIE, this.options());
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

  private options(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: `/${API_PREFIX}/${OAUTH2_CALLBACK_ROUTE}`,
    };
  }
}
