import type { ToolActingAsDto } from '@work/application/ports/integration-tool-calls.port';

export interface ToolAnswerDto {
  readonly output: unknown;
  readonly actingAs: ToolActingAsDto | null;
}
