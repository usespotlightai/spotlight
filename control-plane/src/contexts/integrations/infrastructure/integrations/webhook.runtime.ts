import {
  createHash,
  createHmac,
  createPublicKey,
  timingSafeEqual,
  verify as verifySignature,
} from 'node:crypto';
import type {
  Credentials,
  SigningSecrets,
} from '@integrations/application/ports/integration-runtime.port';
import type {
  Delivered,
  HappeningDeclaration,
  WebhookHeaders,
  WebhookProviderPort,
} from '@integrations/application/ports/webhook-provider.port';
import type { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import { readEvents } from '@integrations/infrastructure/integrations/happenings';
import type {
  AuthIR,
  EventIR,
  ReadableIntegration,
} from '@integrations/infrastructure/integrations/integration.compile';
import type { JwksResolver } from '@integrations/infrastructure/integrations/jwks';
import {
  type Templated,
  textOf,
} from '@integrations/infrastructure/integrations/templating';
import type { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import {
  type CelVariables,
  sanitizedForCel,
} from '@platform/expressions/cel-variables';
import { ExpressionFailedError } from '@platform/expressions/expression.errors';
import { evaluateText, isTrue, value } from '@platform/expressions/readings';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Happened } from '@work/application/contracts/happenings.contract';

const ED25519_SPKI = Buffer.from('302a300506032b6570032100', 'hex');

const headed = (headers: WebhookHeaders, name: string): string | undefined => {
  const value = headers[name.toLowerCase()];

  return Array.isArray(value) ? value[0] : value;
};

const DIGEST = { sha256: 'sha256', sha1: 'sha1', sha512: 'sha512' } as const;

export class WebhookRuntime implements WebhookProviderPort {
  constructor(
    private readonly readable: ReadableIntegration,
    private readonly workspaceId: WorkspaceId,
    private readonly signing: SigningSecrets,
    private readonly now: () => number = () => Date.now(),
    private readonly jwks: JwksResolver,
    private readonly outbound: HttpOutbound,
    private readonly credentials: Credentials,
  ) {}

  get key(): string {
    return this.readable.integration.key.value;
  }

  get happenings(): readonly HappeningDeclaration[] {
    return this.readable.integration.declares.map((each) => ({
      happening: each.happening,
      label: each.label,
      summary: each.summary,
      answers: each.answers,
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
      default:
        return false;
    }
  }

  private async token(
    auth: Extract<AuthIR, { kind: 'token' }>,
    delivered: Delivered,
  ): Promise<boolean> {
    const received = auth.header && headed(delivered.headers, auth.header);

    if (!received) {
      return false;
    }

    const secret = await this.signing.named(auth.secret);

    return equal(secret.revealed(), received);
  }

  private async hmac(
    auth: Extract<AuthIR, { kind: 'hmac' }>,
    delivered: Delivered,
  ): Promise<boolean> {
    const received = auth.header && headed(delivered.headers, auth.header);

    if (!received) {
      return false;
    }

    const secret = (await this.signing.named(auth.secret)).revealed();

    const material = auth.signed
      ? Buffer.from(evaluateText(auth.signed, this.bindings(delivered)) ?? '')
      : Buffer.from(delivered.raw as Uint8Array);

    const expected =
      auth.prefix +
      createHmac(DIGEST[auth.algorithm], secret)
        .update(material)
        .digest(auth.encoding);

    return equal(expected, received);
  }

  private asymmetric(
    auth: Extract<AuthIR, { kind: 'asymmetric' }>,
    delivered: Delivered,
  ): boolean {
    const raw = this.templated(auth.key, delivered);
    const received = auth.header && headed(delivered.headers, auth.header);

    if (!raw || !received) {
      return false;
    }

    const message = auth.signed
      ? Buffer.from(evaluateText(auth.signed, this.bindings(delivered)) ?? '')
      : Buffer.from(delivered.raw as Uint8Array);
    const signature = Buffer.from(received, auth.encoding);

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

    if (!token) {
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
      evaluateText(freshness.at, this.bindings(delivered)) ?? '',
      10,
    );

    if (Number.isNaN(at)) {
      return false;
    }

    return Math.abs(this.now() / 1000 - at) <= freshness.within;
  }

  private templated(template: Templated, delivered: Delivered): string | null {
    return textOf(template, this.bindings(delivered));
  }

  answer(delivered: Delivered): string | null {
    const respond = this.readable.webhook?.respond;

    if (!respond) {
      return null;
    }

    const against = this.bindings(delivered);

    return isTrue(respond.when, against)
      ? evaluateText(respond.body, against)
      : null;
  }

  delivery(delivered: Delivered): string {
    const named =
      this.readable.webhook?.delivery &&
      evaluateText(this.readable.webhook.delivery, this.bindings(delivered));

    return (
      named ??
      createHash('sha256')
        .update(delivered.raw ?? Buffer.from(''))
        .digest('hex')
    );
  }

  async routes(): Promise<WorkspaceId | null> {
    return this.workspaceId;
  }

  async read(delivered: Delivered): Promise<readonly Happened[]> {
    const ignoreWhen = this.readable.webhook?.ignoreWhen;

    return readEvents(
      this.readable.webhook?.events ?? [],
      (happening) => this.declaring(happening),
      this.bindings(delivered),
      (against) => (ignoreWhen ? isTrue(ignoreWhen, against) : false),
      (event, against) => this.enriched(event, against),
      (request, against) =>
        this.outbound.bytes(request, against, this.credentials),
    );
  }

  private async enriched(
    event: EventIR,
    against: CelVariables,
  ): Promise<CelVariables> {
    if (!event.lookup) {
      return against;
    }

    let result: Awaited<ReturnType<HttpOutbound['run']>>;

    try {
      result = await this.outbound.run(
        event.lookup.request,
        against,
        this.credentials,
      );
    } catch (error) {
      if (error instanceof ExpressionFailedError) {
        return against;
      }

      throw error;
    }

    if (!result.ok) {
      return against;
    }

    const beside = { ...against, response: sanitizedForCel(result.response) };
    const captured: Record<string, unknown> = {};

    for (const each of event.lookup.capture) {
      captured[each.name] = value(each.value, beside);
    }

    return { ...against, ...captured };
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
      body: sanitizedForCel(delivered.body ?? {}),
      headers: sanitizedForCel(delivered.headers ?? {}),
      raw: delivered.raw ? Buffer.from(delivered.raw).toString('utf8') : '',
    };
  }
}

const equal = (a: string, b: string): boolean => {
  const one = Buffer.from(a);
  const two = Buffer.from(b);

  return one.length === two.length && timingSafeEqual(one, two);
};

const within = (aud: unknown, wanted: string): boolean =>
  Array.isArray(aud) ? aud.includes(wanted) : aud === wanted;
