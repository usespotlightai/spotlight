import { createHmac, timingSafeEqual } from 'node:crypto';

const LIVES_MS = 10 * 60 * 1000;

interface Payload {
  readonly teamId: string;
  readonly source: string;
  readonly by: string;
  readonly exp: number;
}

// The callback must re-check that `by` may still connect.
export interface OAuth2Intent {
  readonly teamId: string;
  readonly source: string;
  readonly by: string;
}

export class OAuth2State {
  constructor(
    private readonly secret: string,
    private readonly now: () => number = Date.now,
  ) {}

  sign(intent: OAuth2Intent): string {
    const payload: Payload = {
      teamId: intent.teamId,
      source: intent.source,
      by: intent.by,
      exp: this.now() + LIVES_MS,
    };

    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');

    return `${body}.${this.mac(body)}`;
  }

  open(token: string): OAuth2Intent | null {
    const [body, mac] = token.split('.');

    if (!body || !mac || !this.holds(body, mac)) {
      return null;
    }

    let payload: Payload;

    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      return null;
    }

    if (typeof payload.exp !== 'number' || payload.exp < this.now()) {
      return null;
    }

    return {
      teamId: payload.teamId,
      source: payload.source,
      by: payload.by,
    };
  }

  private mac(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('base64url');
  }

  private holds(body: string, mac: string): boolean {
    const wanted = Buffer.from(this.mac(body));
    const given = Buffer.from(mac);

    return wanted.length === given.length && timingSafeEqual(wanted, given);
  }
}
