import type {
  CompiledTeam,
  CompiledWorkspace,
  IdentityDefinitionsPort,
} from '@identity/application/ports/identity-definitions.port';
import {
  TEAM,
  WORKSPACE,
} from '@identity/application/rendering/identity-problems';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { madeBy, problemsIn } from '@platform/definitions/definition-schema';
import { z } from 'zod';

const workspaceSchema = z.object({
  name: madeBy(WorkspaceName.of),
  slug: madeBy(WorkspaceSlug.exactly),
});

const teamSchema = z.object({
  key: madeBy(TeamKey.of),
  name: madeBy(TeamName.of),
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
}
