import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class RecordToolOutputCommand {
  constructor(
    readonly teamId: TeamId,
    readonly tool: ToolName,
    readonly answer: unknown,
  ) {}
}
