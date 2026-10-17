import { LearnedOutput } from '@integrations/domain/aggregates/learned-output.aggregate';
import { LearnedOutputVersionConflictError } from '@integrations/domain/exceptions/learned-output-version-conflict.error';
import type { LearnedOutputRepository } from '@integrations/domain/repositories/learned-output.repository';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import {
  isJsonValue,
  type JsonValue,
} from '@shared-kernel/domain/services/json-value';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const ATTEMPTS = 3;

export class LearnOutputShapes {
  constructor(
    private readonly learned: LearnedOutputRepository,
    private readonly clock: ClockPort,
    private readonly log: LoggerPort,
  ) {}

  async learn(teamId: TeamId, tool: string, answer: unknown): Promise<void> {
    if (!isJsonValue(answer)) {
      return;
    }

    try {
      await this.saveLearned(teamId, ToolName.of(tool), answer);
    } catch (error) {
      this.log.debug(
        { tool, error: error instanceof Error ? error.name : 'unknown' },
        'could not learn what a tool answers',
      );
    }
  }

  private async saveLearned(
    teamId: TeamId,
    tool: ToolName,
    answer: JsonValue,
  ): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      const at = this.clock.now();
      const existing = await this.learned.of(teamId, tool);

      try {
        await this.learned.save(
          existing
            ? existing.learnFrom(answer, at)
            : LearnedOutput.first({ teamId, tool, answer, at }),
        );
        return;
      } catch (error) {
        if (
          !(error instanceof LearnedOutputVersionConflictError) ||
          attempt >= ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
