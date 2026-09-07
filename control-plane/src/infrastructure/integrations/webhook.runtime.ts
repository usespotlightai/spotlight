import {
  createHash,
  createHmac,
  createPublicKey,
  timingSafeEqual,
  verify as verifySignature,
} from 'node:crypto';
import type {
  Delivered,
  Happened,
  HappeningDeclaration,
  WebhookHeaders,
  WebhookSourcePort,
} from '@application/ports/webhook-source.port';
import type { DeclaredHappening } from '@domain/entities/declared-happening.entity';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { bound, holds, reads } from '@infrastructure/integrations/expression';
import { readEvents } from '@infrastructure/integrations/happenings';
import type {
  AuthIR,
  ReadableIntegration,
  Templated,
} from '@infrastructure/integrations/integration.compile';
import type { JwksResolver } from '@infrastructure/integrations/jwks';

/** The SPKI wrapper for a raw 32-byte ed25519 public key. */
const ED25519_SPKI = Buffer.from('302a300506032b6570032100', 'hex');

const headed = (headers: WebhookHeaders, name: string): string | undefined => {
  const value = headers[name.toLowerCase()];

  return Array.isArray(value) ? value[0] : value;
};

const DIGEST = { sha256: 'sha256', sha1: 'sha1', sha512: 'sha512' } as const;

/**
 * A host driven entirely by its compiled config: it verifies, answers a
 * handshake, names a delivery, and reads words off it by the file's expressions
 * and the generic primitives beside them. There is no host-specific code here —
 * a new host is a new file, not a new class.
 */
export class WebhookRuntime implements WebhookSourcePort {
  constructor(
    private readonly readable: ReadableIntegration,
    private readonly workspaceId: WorkspaceId,
    /** The values of the secrets the file names, by name; absent where unset. */
    private readonly secrets: ReadonlyMap<string, string>,
    private readonly now: () => number = () => Date.now(),
    private readonly jwks: JwksResolver | null = null,
  ) {}

  get key(): string {
    return this.readable.integration.source.value;
  }

  get happenings(): readonly HappeningDeclaration[] {
    return this.readable.integration.declares.map((each) => ({
      happening: each.happening,
      label: each.label,
      told: each.told,
      spoken: each.spoken,
    }));
  }

  async verifies(delivered: Delivered): Promise<boolean> {
    const webhook = this.readable.webhook;

    if (!webhook || delivered.raw === null) {
      return false;
    }

    if (!this.fresh(webhook.verify, delivered)) {
      return false;
    }

    return this.trusts(webhook.verify, delivered);
  }

  private async trusts(auth: AuthIR, delivered: Delivered): Promise<boolean> {
    switch (auth.kind) {
      case 'hmac':
        return this.hmac(auth, delivered);
      case 'token':
        return this.token(auth, delivered);
      case 'asymmetric':
        return this.asymmetric(auth, delivered);
      case 'jwt':
        return this.jwt(auth, delivered);
      // basic and oauth2 are credentials for outbound, not ways to be verified.
      default:
        return false;
    }
  }

  private token(
    auth: Extract<AuthIR, { kind: 'token' }>,
    delivered: Delivered,
  ): boolean {
    const secret = this.secrets.get(auth.secret);
    const given = auth.header && headed(delivered.headers, auth.header);

    return secret !== undefined && !!given && equal(secret, given);
  }

  private hmac(
    auth: Extract<AuthIR, { kind: 'hmac' }>,
    delivered: Delivered,
  ): boolean {
    const secret = this.secrets.get(auth.secret);
    const given = auth.header && headed(delivered.headers, auth.header);

    if (secret === undefined || !given) {
      return false;
    }

    // The body as it arrived, unless a base is named (Slack signs
    // `v0:<timestamp>:<body>`, not the body alone).
    const material = auth.signed
      ? Buffer.from(reads(auth.signed, this.bindings(delivered)) ?? '')
      : Buffer.from(delivered.raw as Uint8Array);

    const expected =
      auth.prefix +
      createHmac(DIGEST[auth.algorithm], secret)
        .update(material)
        .digest(auth.encoding);

    return equal(expected, given);
  }

  private asymmetric(
    auth: Extract<AuthIR, { kind: 'asymmetric' }>,
    delivered: Delivered,
  ): boolean {
    const raw = this.templated(auth.key, delivered);
    const given = auth.header && headed(delivered.headers, auth.header);

    if (!raw || !given) {
      return false;
    }

    const message = auth.signed
      ? Buffer.from(reads(auth.signed, this.bindings(delivered)) ?? '')
      : Buffer.from(delivered.raw as Uint8Array);
    const signature = Buffer.from(given, auth.encoding);

    try {
      const key =
        auth.algorithm === 'ed25519'
          ? createPublicKey({
              key: Buffer.concat([ED25519_SPKI, Buffer.from(raw, 'hex')]),
              format: 'der',
              type: 'spki',
            })
          : createPublicKey(raw);

      return verifySignature(
        auth.algorithm === 'ed25519' ? null : 'sha256',
        message,
        key,
        signature,
      );
    } catch {
      return false;
    }
  }

  private async jwt(
    auth: Extract<AuthIR, { kind: 'jwt' }>,
    delivered: Delivered,
  ): Promise<boolean> {
    const carried = headed(delivered.headers, auth.header ?? 'authorization');
    const token = carried?.replace(/^Bearer\s+/i, '');

    if (!token || !this.jwks) {
      return false;
    }

    const [head, claims, signature] = token.split('.');

    if (!head || !claims || !signature) {
      return false;
    }

    let header: { alg?: string; kid?: string };
    let payload: { exp?: number; aud?: unknown; iss?: unknown };

    try {
      header = JSON.parse(Buffer.from(head, 'base64url').toString('utf8'));
      payload = JSON.parse(Buffer.from(claims, 'base64url').toString('utf8'));
    } catch {
      return false;
    }

    if (header.alg !== 'RS256') {
      return false;
    }

    const keys = await this.jwks.keys(auth.jwks);
    const key = header.kid ? keys.get(header.kid) : [...keys.values()][0];

    if (!key) {
      return false;
    }

    const signed = verifySignature(
      'RSA-SHA256',
      Buffer.from(`${head}.${claims}`),
      key,
      Buffer.from(signature, 'base64url'),
    );

    if (!signed) {
      return false;
    }

    if (typeof payload.exp === 'number' && this.now() / 1000 >= payload.exp) {
      return false;
    }

    if (auth.audience && !within(payload.aud, auth.audience)) {
      return false;
    }

    return !auth.issuer || payload.iss === auth.issuer;
  }

  private fresh(auth: AuthIR, delivered: Delivered): boolean {
    const freshness =
      auth.kind === 'hmac' || auth.kind === 'asymmetric'
        ? auth.freshness
        : null;

    if (!freshness) {
      return true;
    }

    const at = Number.parseInt(
      reads(freshness.at, this.bindings(delivered)) ?? '',
      10,
    );

    if (Number.isNaN(at)) {
      return false;
    }

    return Math.abs(this.now() / 1000 - at) <= freshness.within;
  }

  private templated(held: Templated, delivered: Delivered): string | null {
    if (held.literal !== null) {
      return held.literal;
    }

    return held.expression
      ? reads(held.expression, this.bindings(delivered))
      : null;
  }

  /** A handshake, answered from the delivery: the body the host wants echoed. */
  answer(delivered: Delivered): string | null {
    const respond = this.readable.webhook?.respond;

    if (!respond) {
      return null;
    }

    const against = this.bindings(delivered);

    return holds(respond.when, against) ? reads(respond.body, against) : null;
  }

  delivery(delivered: Delivered): string {
    const named =
      this.readable.webhook?.delivery &&
      reads(this.readable.webhook.delivery, this.bindings(delivered));

    return (
      named ??
      createHash('sha256')
        .update(delivered.raw ?? Buffer.from(''))
        .digest('hex')
    );
  }

  /** The door it arrived at said whose it was; nothing is looked up. */
  async routes(): Promise<WorkspaceId | null> {
    // route.by (shared-door resolution by a connection) is a later primitive;
    // a team-addressed door already knows whose delivery this is.
    return this.workspaceId;
  }

  read(delivered: Delivered): readonly Happened[] {
    const mine = this.readable.webhook?.mine;

    return readEvents(
      this.readable.webhook?.events ?? [],
      (happening) => this.declaring(happening),
      this.bindings(delivered),
      (against) => (mine ? holds(mine, against) : false),
    );
  }

  private declaring(happening: string): DeclaredHappening | null {
    return (
      this.readable.integration.declares.find(
        (each) => each.happening.value === happening,
      ) ?? null
    );
  }

  private bindings(delivered: Delivered): Record<string, unknown> {
    return {
      body: bound(delivered.body ?? {}),
      headers: bound(delivered.headers ?? {}),
      raw: delivered.raw ? Buffer.from(delivered.raw).toString('utf8') : '',
    };
  }
}

const equal = (a: string, b: string): boolean => {
  const one = Buffer.from(a);
  const two = Buffer.from(b);

  return one.length === two.length && timingSafeEqual(one, two);
};

/** A JWT `aud` is one string or a list; the wanted audience must be among it. */
const within = (aud: unknown, wanted: string): boolean =>
  Array.isArray(aud) ? aud.includes(wanted) : aud === wanted;
