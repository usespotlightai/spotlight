import { createHmac, timingSafeEqual } from 'node:crypto';

/** How long an authorization may sit half-done before the state goes stale. */
const LIVES_MS = 10 * 60 * 1000;

interface Payload {
  readonly teamId: string;
  readonly source: string;
  readonly by: string;
  readonly exp: number;
}

/**
 * What a verified state carries: which team is linking which host, and who was
 * allowed to start it. The callback re-checks `by` may still connect, so the
 * signed state is the whole authorization, not merely proof one once happened.
 */
export interface OAuth2Intent {
  readonly teamId: string;
  readonly source: string;
  readonly by: string;
}

/**
 * The `state` carried through an OAuth2 round trip: who is linking which host
 * for which team, signed so the callback can trust it without a session, and
 * dated so a link begun and abandoned cannot be finished much later. Signed with
 * the same secret the deployment signs sessions with.
 */
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
