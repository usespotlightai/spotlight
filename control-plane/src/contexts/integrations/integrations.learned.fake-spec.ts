import { LearnOutputShapes } from '@integrations/application/services/learn-output-shapes.service';
import { LearnedOutput } from '@integrations/domain/aggregates/learned-output.aggregate';
import { LearnedOutputVersionConflictError } from '@integrations/domain/exceptions/learned-output-version-conflict.error';
import type { LearnedOutputRepository } from '@integrations/domain/repositories/learned-output.repository';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const keyOf = (teamId: TeamId, tool: ToolName): string =>
  `${teamId.value}:${tool.value}`;

export class InMemoryLearnedOutputs implements LearnedOutputRepository {
  readonly held = new Map<string, LearnedOutput>();

  async of(teamId: TeamId, tool: ToolName): Promise<LearnedOutput | null> {
    return this.held.get(keyOf(teamId, tool)) ?? null;
  }

  async ofTools(
    teamId: TeamId,
    tools: readonly string[],
  ): Promise<readonly LearnedOutput[]> {
    return [...this.held.values()].filter(
      (each) => each.teamId.equals(teamId) && tools.includes(each.tool.value),
    );
  }

  async save(learned: LearnedOutput): Promise<void> {
    const key = keyOf(learned.teamId, learned.tool);
    const kept = this.held.get(key);

    if ((kept?.version ?? 0) !== learned.version) {
      throw new LearnedOutputVersionConflictError(learned.tool.value);
    }

    this.held.set(
      key,
      LearnedOutput.rehydrate({
        teamId: learned.teamId,
        tool: learned.tool,
        shape: learned.shape,
        calls: learned.calls,
        learnedAt: learned.learnedAt,
        version: learned.version + 1,
      }),
    );
  }

  async forgetSource(teamId: TeamId, source: SourceKey): Promise<void> {
    for (const [key, each] of this.held) {
      if (each.teamId.equals(teamId) && each.source.equals(source)) {
        this.held.delete(key);
      }
    }
  }

  async forgetTeam(teamId: TeamId): Promise<void> {
    for (const [key, each] of this.held) {
      if (each.teamId.equals(teamId)) {
        this.held.delete(key);
      }
    }
  }
}

const QUIET = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export const learningInto = (
  learned: LearnedOutputRepository = new InMemoryLearnedOutputs(),
): LearnOutputShapes =>
  new LearnOutputShapes(
    learned,
    {
      now: () => new Date('2026-10-05T12:00:00.000Z'),
      sleep: async () => undefined,
    },
    QUIET,
  );
