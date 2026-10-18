import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const LIVES_MS = 10 * 60 * 1000;

type ConnectionOwnerKind = 'team' | 'person';

interface Payload {
  readonly teamId: string;
  readonly integration: string;
  readonly by: string;
  readonly owner: ConnectionOwnerKind;
  readonly returnTo: string | null;
  readonly nonce: string;
  readonly exp: number;
}

export interface OAuth2Intent {
  readonly teamId: string;
  readonly integration: string;
  readonly by: string;
  readonly owner: ConnectionOwnerKind;
  readonly returnTo: string | null;
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
      integration: intent.integration,
      by: intent.by,
      owner: intent.owner,
      returnTo: intent.returnTo,
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
      (payload.owner !== 'team' && payload.owner !== 'person') ||
      (payload.returnTo !== null && typeof payload.returnTo !== 'string')
    ) {
      return null;
    }

    return {
      teamId: payload.teamId,
      integration: payload.integration,
      by: payload.by,
      owner: payload.owner,
      returnTo: payload.returnTo,
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
    const received = Buffer.from(mac);

    return (
      wanted.length === received.length && timingSafeEqual(wanted, received)
    );
  }
}
