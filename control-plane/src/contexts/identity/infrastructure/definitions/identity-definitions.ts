import type {
  IdentityDefinitionsPort,
  ParsedTeam,
  ParsedWorkspace,
  ParsedWorkspaceToken,
  ParsedWorkspaceTokenTrust,
} from '@identity/application/ports/identity-definitions.port';
import {
  TEAM,
  WORKSPACE,
  WORKSPACE_TOKEN,
  WORKSPACE_TOKEN_TRUST,
} from '@identity/application/rendering/identity-problems';
import { InvalidTokenTrustError } from '@identity/domain/exceptions/invalid-token-trust.error';
import { ClaimPattern } from '@identity/domain/value-objects/claim-pattern.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { TokenDescription } from '@identity/domain/value-objects/token-description.vo';
import { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { TokenTrustKey } from '@identity/domain/value-objects/token-trust-key.vo';
import { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import {
  madeBy,
  problemsIn,
  refinedBy,
} from '@platform/definitions/definition-schema';
import { TokenScope } from '@shared-kernel/domain/value-objects/token-scope.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { z } from 'zod';

const workspaceSchema = z.object({
  name: madeBy(WorkspaceName.of),
  slug: madeBy(WorkspaceSlug.exactly),
});

const teamSchema = z.object({
  key: madeBy(TeamKey.of),
  name: madeBy(TeamName.of),
});

const scopes = z
  .array(madeBy(TokenScope.of), {
    error: 'lists what the token may do, as in ["configure", "secrets"]',
  })
  .pipe(z.array(z.string()).superRefine(refinedBy(TokenScopes.named)));

const workspaceTokenSchema = z.object({
  name: madeBy(TokenName.of),
  scopes,
  description: madeBy(TokenDescription.of).default(''),
  expiresAt: z.iso
    .datetime({
      offset: true,
      error: 'is an RFC 3339 date and time, as in 2026-12-31T23:59:59Z',
    })
    .nullable()
    .default(null),
});

const workspaceTokenTrustSchema = z
  .object({
    key: madeBy(TokenTrustKey.of),
    issuer: madeBy(WorkloadRule.issuerOf),
    audience: madeBy(WorkloadRule.audienceOf).default('spotlight'),
    subject: madeBy((raw) => ClaimPattern.of(raw)),
    claims: z
      .record(
        z.string().superRefine(refinedBy(WorkloadRule.claimNameOf)),
        z.string(),
        {
          error:
            'maps each claim the token must carry to the pattern it must match, as in { "ref": "refs/heads/main" }',
        },
      )
      .default({}),
    scopes,
    lifetimeMinutes: z
      .number({ error: 'is a whole number of minutes' })
      .superRefine(refinedBy(TokenLifetime.ofMinutes))
      .default(TokenLifetime.USUAL_MINUTES),
  })
  .superRefine((trust, context) => {
    try {
      WorkloadRule.of(trust);
    } catch (error) {
      if (!(error instanceof InvalidTokenTrustError)) {
        throw error;
      }

      context.addIssue({
        code: 'custom',
        path: error.field.split('.'),
        message: error.because,
      });
    }
  });

export class IdentityDefinitions implements IdentityDefinitionsPort {
  workspace(input: unknown): ParsedWorkspace {
    const read = workspaceSchema.safeParse(input);

    return read.success
      ? {
          ok: true,
          name: WorkspaceName.of(read.data.name),
          slug: WorkspaceSlug.exactly(read.data.slug),
        }
      : { ok: false, problems: problemsIn(WORKSPACE, read.error) };
  }

  team(input: unknown): ParsedTeam {
    const read = teamSchema.safeParse(input);

    return read.success
      ? {
          ok: true,
          key: TeamKey.of(read.data.key),
          name: TeamName.of(read.data.name),
        }
      : { ok: false, problems: problemsIn(TEAM, read.error) };
  }

  workspaceToken(input: unknown): ParsedWorkspaceToken {
    const read = workspaceTokenSchema.safeParse(input);

    return read.success
      ? {
          ok: true,
          spec: {
            name: TokenName.of(read.data.name),
            scopes: TokenScopes.named(read.data.scopes),
            description: TokenDescription.of(read.data.description),
            expiresAt:
              read.data.expiresAt === null
                ? null
                : new Date(read.data.expiresAt),
          },
        }
      : { ok: false, problems: problemsIn(WORKSPACE_TOKEN, read.error) };
  }

  workspaceTokenTrust(input: unknown): ParsedWorkspaceTokenTrust {
    const read = workspaceTokenTrustSchema.safeParse(input);

    return read.success
      ? {
          ok: true,
          spec: {
            key: TokenTrustKey.of(read.data.key),
            workload: WorkloadRule.of(read.data),
            scopes: TokenScopes.named(read.data.scopes),
            lifetime: TokenLifetime.ofMinutes(read.data.lifetimeMinutes),
          },
        }
      : {
          ok: false,
          problems: problemsIn(WORKSPACE_TOKEN_TRUST, read.error),
        };
  }
}
