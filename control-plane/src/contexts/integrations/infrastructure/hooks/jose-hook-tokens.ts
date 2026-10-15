import {
  createHash,
  createPrivateKey,
  createPublicKey,
  type KeyObject,
} from 'node:crypto';
import type {
  HookTokenClaims,
  HookTokensPort,
  PublishedKeys,
} from '@integrations/application/ports/hook-tokens.port';
import { SignJWT } from 'jose';

const ALGORITHM = 'ES256';

const CURVE = 'prime256v1';

const LIFE_SECONDS = 5 * 60;

interface Signer {
  readonly key: KeyObject;
  readonly kid: string;
  readonly jwk: Readonly<Record<string, unknown>>;
}

const thumbprintOf = (jwk: { crv?: string; x?: string; y?: string }) =>
  createHash('sha256')
    .update(JSON.stringify({ crv: jwk.crv, kty: 'EC', x: jwk.x, y: jwk.y }))
    .digest('base64url');

const signerFrom = (pem: string): Signer => {
  const key = createPrivateKey(pem.replace(/\\n/g, '\n'));

  if (
    key.asymmetricKeyType !== 'ec' ||
    key.asymmetricKeyDetails?.namedCurve !== CURVE
  ) {
    throw new Error(
      'HOOK_SIGNING_KEY is not a P-256 private key; hooks sign their tokens with ES256',
    );
  }

  const jwk = createPublicKey(key).export({ format: 'jwk' });
  const kid = thumbprintOf(jwk);

  return {
    key,
    kid,
    jwk: {
      kty: 'EC',
      crv: jwk.crv,
      x: jwk.x,
      y: jwk.y,
      kid,
      alg: ALGORITHM,
      use: 'sig',
    },
  };
};

export class JoseHookTokens implements HookTokensPort {
  private readonly signer: Signer | null;

  constructor(
    pem: string | undefined,
    readonly issuer: string,
  ) {
    this.signer = pem ? signerFrom(pem) : null;
  }

  get signs(): boolean {
    return this.signer !== null;
  }

  async signed(claims: HookTokenClaims): Promise<string> {
    if (!this.signer) {
      throw new Error(
        'This deployment has no key to sign hook tokens with. Please set HOOK_SIGNING_KEY.',
      );
    }

    return new SignJWT({
      occurrence: claims.occurrence,
      webhook_id: claims.message,
      body_sha256: claims.bodyDigest,
    })
      .setProtectedHeader({ alg: ALGORITHM, kid: this.signer.kid, typ: 'JWT' })
      .setIssuer(this.issuer)
      .setAudience(claims.audience)
      .setSubject(claims.subject)
      .setIssuedAt()
      .setExpirationTime(`${LIFE_SECONDS}s`)
      .setJti(crypto.randomUUID())
      .sign(this.signer.key);
  }

  async keys(): Promise<PublishedKeys> {
    return { keys: this.signer ? [this.signer.jwk] : [] };
  }
}
