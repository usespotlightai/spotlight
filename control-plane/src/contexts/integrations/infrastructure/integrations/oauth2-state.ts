import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const LIVES_MS = 10 * 60 * 1000;

type OAuth2Holder = 'team' | 'person';

interface Payload {
  readonly teamId: string;
  readonly source: string;
  readonly by: string;
  readonly holder: OAuth2Holder;
  readonly back: string | null;
  readonly nonce: string;
  readonly exp: number;
}

export interface OAuth2Intent {
  readonly teamId: string;
  readonly source: string;
  readonly by: string;
  readonly holder: OAuth2Holder;
  readonly back: string | null;
  readonly nonce: string;
}

export interface OpenedOAuth2Intent extends OAuth2Intent {
  readonly expiresAt: Date;
}

export interface SignedOAuth2State {
  readonly token: string;
  readonly expiresAt: Date;
}

export class OAuth2State {
  constructor(
    private readonly secret: string,
    private readonly now: () => number = Date.now,
  ) {}

  sign(intent: OAuth2Intent): SignedOAuth2State {
    const payload: Payload = {
      teamId: intent.teamId,
      source: intent.source,
      by: intent.by,
      holder: intent.holder,
      back: intent.back,
      nonce: intent.nonce,
      exp: this.now() + LIVES_MS,
    };

    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');

    return {
      token: `${body}.${this.mac(body)}`,
      expiresAt: new Date(payload.exp),
    };
  }

  open(token: string): OpenedOAuth2Intent | null {
    const [body, mac] = token.split('.');

    if (!body || !mac || !this.isAuthentic(body, mac)) {
      return null;
    }

    let payload: Payload;

    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      return null;
    }

    if (
      typeof payload.exp !== 'number' ||
      payload.exp < this.now() ||
      typeof payload.nonce !== 'string' ||
      payload.nonce.length === 0 ||
      (payload.holder !== 'team' && payload.holder !== 'person') ||
      (payload.back !== null && typeof payload.back !== 'string')
    ) {
      return null;
    }

    return {
      teamId: payload.teamId,
      source: payload.source,
      by: payload.by,
      holder: payload.holder,
      back: payload.back,
      nonce: payload.nonce,
      expiresAt: new Date(payload.exp),
    };
  }

  verifierFor(nonce: string): string {
    return createHmac('sha256', this.secret)
      .update(`pkce:${nonce}`)
      .digest('base64url');
  }

  static challengeOf(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
  }

  private mac(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }

  private isAuthentic(body: string, mac: string): boolean {
    const wanted = Buffer.from(this.mac(body));
    const given = Buffer.from(mac);

    return wanted.length === given.length && timingSafeEqual(wanted, given);
  }
}
