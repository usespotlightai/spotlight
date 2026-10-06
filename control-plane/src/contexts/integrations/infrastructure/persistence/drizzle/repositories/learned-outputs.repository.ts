import { LearnedOutput } from '@integrations/domain/aggregates/learned-output.aggregate';
import { LearnedOutputMovedOnError } from '@integrations/domain/exceptions/learned-output-moved-on.error';
import type { LearnedOutputRepository } from '@integrations/domain/repositories/learned-output.repository';
import { OutputShape } from '@integrations/domain/value-objects/output-shape.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { learnedOutput } from '@integrations/infrastructure/persistence/drizzle/schemas/integration.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { and, eq, inArray } from 'drizzle-orm';

type Row = typeof learnedOutput.$inferSelect;

const rehydrate = (row: Row): LearnedOutput =>
  LearnedOutput.rehydrate({
    teamId: TeamId.of(row.teamId),
    tool: ToolName.of(row.tool),
    shape: OutputShape.kept(row.shape),
    calls: row.calls,
    learnedAt: row.learnedAt,
    version: row.version,
  });

export class DrizzleLearnedOutputs implements LearnedOutputRepository {
  constructor(private readonly context: DrizzleContext) {}

  async of(teamId: TeamId, tool: ToolName): Promise<LearnedOutput | null> {
    const [found] = await this.context.db
      .select()
      .from(learnedOutput)
      .where(
        and(
          eq(learnedOutput.teamId, teamId.value),
          eq(learnedOutput.tool, tool.value),
        ),
      )
      .limit(1);

    return found ? rehydrate(found) : null;
  }

  async ofTools(
    teamId: TeamId,
    tools: readonly string[],
  ): Promise<readonly LearnedOutput[]> {
    if (tools.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(learnedOutput)
      .where(
        and(
          eq(learnedOutput.teamId, teamId.value),
          inArray(learnedOutput.tool, [...tools]),
        ),
      );

    return rows.map(rehydrate);
  }

  async save(learned: LearnedOutput): Promise<void> {
    const written = {
      shape: learned.shape.toJson(),
      calls: learned.calls,
      learnedAt: learned.learnedAt,
    };

    const kept = learned.isNew
      ? await this.context.db
          .insert(learnedOutput)
          .values({
            teamId: learned.teamId.value,
            tool: learned.tool.value,
            source: learned.source.value,
            ...written,
          })
          .onConflictDoNothing()
          .returning({ tool: learnedOutput.tool })
      : await this.context.db
          .update(learnedOutput)
          .set({ ...written, version: learned.version + 1 })
          .where(
            and(
              eq(learnedOutput.teamId, learned.teamId.value),
              eq(learnedOutput.tool, learned.tool.value),
              eq(learnedOutput.version, learned.version),
            ),
          )
          .returning({ tool: learnedOutput.tool });

    if (kept.length === 0) {
      throw new LearnedOutputMovedOnError(learned.tool.value);
    }
  }

  async forgetSource(teamId: TeamId, source: SourceKey): Promise<void> {
    await this.context.db
      .delete(learnedOutput)
      .where(
        and(
          eq(learnedOutput.teamId, teamId.value),
          eq(learnedOutput.source, source.value),
        ),
      );
  }

  async forgetTeam(teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(learnedOutput)
      .where(eq(learnedOutput.teamId, teamId.value));
  }
}
