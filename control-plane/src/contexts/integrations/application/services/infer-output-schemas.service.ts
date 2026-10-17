import { InferredOutputSchema } from '@integrations/domain/aggregates/inferred-output-schema.aggregate';
import { InferredOutputSchemaVersionConflictError } from '@integrations/domain/exceptions/inferred-output-schema-version-conflict.error';
import type { InferredOutputSchemaRepository } from '@integrations/domain/repositories/inferred-output-schema.repository';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import {
  isJsonValue,
  type JsonValue,
} from '@shared-kernel/domain/services/json-value';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const ATTEMPTS = 3;

export class InferOutputSchemas {
  constructor(
    private readonly schemas: InferredOutputSchemaRepository,
    private readonly clock: ClockPort,
    private readonly log: LoggerPort,
  ) {}

  async infer(teamId: TeamId, tool: string, answer: unknown): Promise<void> {
    if (!isJsonValue(answer)) {
      return;
    }

    try {
      await this.saveInferred(teamId, ToolName.of(tool), answer);
    } catch (error) {
      this.log.debug(
        { tool, error: error instanceof Error ? error.name : 'unknown' },
        'could not infer what a tool answers',
      );
    }
  }

  private async saveInferred(
    teamId: TeamId,
    tool: ToolName,
    answer: JsonValue,
  ): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      const at = this.clock.now();
      const existing = await this.schemas.of(teamId, tool);

      try {
        await this.schemas.save(
          existing
            ? existing.inferFrom(answer, at)
            : InferredOutputSchema.first({ teamId, tool, answer, at }),
        );
        return;
      } catch (error) {
        if (
          !(error instanceof InferredOutputSchemaVersionConflictError) ||
          attempt >= ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
