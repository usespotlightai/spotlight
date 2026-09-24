import type {
  CompiledTeam,
  CompiledWorkspace,
  CompiledWorkspaceToken,
  IdentityDefinitionsPort,
} from '@identity/application/ports/identity-definitions.port';
import {
  TEAM,
  WORKSPACE,
  WORKSPACE_TOKEN,
} from '@identity/application/rendering/identity-problems';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { TokenDescription } from '@identity/domain/value-objects/token-description.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
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

const workspaceTokenSchema = z.object({
  name: madeBy(TokenName.of),
  scopes: z
    .array(madeBy(TokenScope.of), {
      error: 'lists what the token may do, as in ["configure", "secrets"]',
    })
    .pipe(z.array(z.string()).superRefine(refinedBy(TokenScopes.named))),
  description: madeBy(TokenDescription.of).default(''),
  expiresAt: z.iso
    .datetime({
      offset: true,
      error: 'is an RFC 3339 date and time, as in 2026-12-31T23:59:59Z',
    })
    .nullable()
    .default(null),
});

export class IdentityDefinitions implements IdentityDefinitionsPort {
  workspace(held: unknown): CompiledWorkspace {
    const read = workspaceSchema.safeParse(held);

    return read.success
      ? {
          ok: true,
          name: WorkspaceName.of(read.data.name),
          slug: WorkspaceSlug.exactly(read.data.slug),
        }
      : { ok: false, problems: problemsIn(WORKSPACE, read.error) };
  }

  team(held: unknown): CompiledTeam {
    const read = teamSchema.safeParse(held);

    return read.success
      ? {
          ok: true,
          key: TeamKey.of(read.data.key),
          name: TeamName.of(read.data.name),
        }
      : { ok: false, problems: problemsIn(TEAM, read.error) };
  }

  workspaceToken(held: unknown): CompiledWorkspaceToken {
    const read = workspaceTokenSchema.safeParse(held);

    return read.success
      ? {
          ok: true,
          terms: {
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
}
