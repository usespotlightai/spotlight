import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class RecordToolOutputCommand {
  constructor(
    readonly teamId: TeamId,
    readonly tool: string,
    readonly answer: unknown,
  ) {}
}
