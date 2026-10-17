import { Inject, Injectable } from '@nestjs/common';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import type {
  ExpectedWorkload,
  WorkloadTokensPort,
} from '@shared-kernel/application/ports/workload-tokens.port';
import type { WorkloadClaims } from '@shared-kernel/domain/value-objects/workload-claims.vo';
import {
  createRemoteJWKSet,
  type JWTPayload,
  type JWTVerifyGetKey,
  jwtVerify,
} from 'jose';

const DISCOVERY_PATH = '/.well-known/openid-configuration';

const KEYS_KEPT_MS = 60 * 60_000;

const TIMEOUT_MS = 5_000;

const CLOCK_TOLERANCE_S = 30;

const ALGORITHMS = ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'PS256'];

const REGISTERED = new Set(['iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti']);

const namedIn = (payload: JWTPayload): Record<string, string> =>
  Object.fromEntries(
    Object.entries(payload).filter(
      (entry): entry is [string, string] =>
        !REGISTERED.has(entry[0]) && typeof entry[1] === 'string',
    ),
  );

interface Discovered {
  readonly keys: JWTVerifyGetKey;
  readonly until: number;
}

@Injectable()
export class JoseWorkloadTokens implements WorkloadTokensPort {
  readonly #discovered = new Map<string, Discovered>();

  constructor(@Inject(LOGGER) private readonly logger: LoggerPort) {}

  async verify(
    token: string,
    expected: ExpectedWorkload,
  ): Promise<WorkloadClaims | null> {
    try {
      const { payload } = await jwtVerify(
        token,
        await this.keysOf(expected.issuer),
        {
          issuer: expected.issuer,
          audience: expected.audience,
          algorithms: ALGORITHMS,
          clockTolerance: CLOCK_TOLERANCE_S,
          requiredClaims: ['sub', 'exp'],
        },
      );

      return {
        issuer: String(payload.iss),
        subject: String(payload.sub),
        audiences: [payload.aud ?? []].flat(),
        named: namedIn(payload),
      };
    } catch (error) {
      this.logger.warn(
        {
          issuer: expected.issuer,
          reason: error instanceof Error ? error.message : String(error),
        },
        'Refused a workload token',
      );

      return null;
    }
  }

  private async keysOf(issuer: string): Promise<JWTVerifyGetKey> {
    const cached = this.#discovered.get(issuer);

    if (cached && cached.until > Date.now()) {
      return cached.keys;
    }

    const answer = await fetch(
      `${issuer.replace(/\/+$/, '')}${DISCOVERY_PATH}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'error' },
    );

    if (!answer.ok) {
      throw new Error(`${issuer} answered discovery with ${answer.status}`);
    }

    const document = (await answer.json()) as {
      issuer?: unknown;
      jwks_uri?: unknown;
    };

    if (document.issuer !== issuer || typeof document.jwks_uri !== 'string') {
      throw new Error(`${issuer} does not describe itself as that issuer`);
    }

    const keys = createRemoteJWKSet(new URL(document.jwks_uri), {
      timeoutDuration: TIMEOUT_MS,
    });

    this.#discovered.set(issuer, { keys, until: Date.now() + KEYS_KEPT_MS });

    return keys;
  }
}
