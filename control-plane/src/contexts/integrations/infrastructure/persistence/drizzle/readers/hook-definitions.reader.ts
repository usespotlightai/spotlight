import type {
  HookTools,
  HookToolsPort,
} from '@integrations/application/ports/hook-tools.port';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { hookDefinition } from '@integrations/infrastructure/persistence/drizzle/schemas/hook.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, asc, eq } from 'drizzle-orm';

export interface StoredHookDefinition {
  readonly id: HookDefinitionId;
  readonly key: HookKey;
  readonly teamId: TeamId;
  readonly document: Readonly<Record<string, unknown>>;
  readonly blocks: boolean;
  readonly version: number;
}

type Row = typeof hookDefinition.$inferSelect;

const storedOf = (row: Row): StoredHookDefinition => ({
  id: HookDefinitionId.of(row.id),
  key: HookKey.of(row.key),
  teamId: TeamId.of(row.teamId),
  document: row.definition,
  blocks: row.blocks,
  version: row.version,
});

@Injectable()
export class DrizzleHookDefinitionsReader implements HookToolsPort {
  constructor(private readonly context: DrizzleContext) {}

  async listening(
    teamId: TeamId,
    on: HookEventName,
  ): Promise<readonly StoredHookDefinition[]> {
    const rows = await this.context.db
      .select()
      .from(hookDefinition)
      .where(
        and(eq(hookDefinition.teamId, teamId.value), eq(hookDefinition.on, on)),
      )
      .orderBy(asc(hookDefinition.key));

    return rows.map(storedOf);
  }

  async withId(id: HookDefinitionId): Promise<StoredHookDefinition | null> {
    const [row] = await this.context.db
      .select()
      .from(hookDefinition)
      .where(eq(hookDefinition.id, id.value))
      .limit(1);

    return row ? storedOf(row) : null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly HookTools[]> {
    const rows = await this.context.db
      .select({ key: hookDefinition.key, tools: hookDefinition.tools })
      .from(hookDefinition)
      .where(eq(hookDefinition.teamId, teamId.value))
      .orderBy(asc(hookDefinition.key));

    return rows.map((row) => ({
      hook: HookKey.of(row.key),
      tools: row.tools.map((tool) => ToolName.of(tool)),
    }));
  }
}
