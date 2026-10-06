import { OutputShape } from '@integrations/domain/value-objects/output-shape.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { JsonValue } from '@shared-kernel/domain/services/json-value';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

interface State {
  readonly teamId: TeamId;
  readonly tool: ToolName;
  readonly shape: OutputShape;
  readonly calls: number;
  readonly learnedAt: Date;
  readonly version: number;
}

export class LearnedOutput {
  private constructor(private readonly state: State) {}

  static first(input: {
    teamId: TeamId;
    tool: ToolName;
    answer: JsonValue;
    at: Date;
  }): LearnedOutput {
    return new LearnedOutput({
      teamId: input.teamId,
      tool: input.tool,
      shape: OutputShape.of(input.answer),
      calls: 1,
      learnedAt: input.at,
      version: 0,
    });
  }

  static rehydrate(input: State): LearnedOutput {
    if (input.version < 1 || input.calls < 1) {
      throw new InconsistentStateError(
        'learned output',
        'was kept without a version or a call it was learned from',
      );
    }

    return new LearnedOutput(input);
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get tool(): ToolName {
    return this.state.tool;
  }

  get source(): SourceKey {
    return SourceKey.of(this.state.tool.value.split('.')[0] ?? '');
  }

  get shape(): OutputShape {
    return this.state.shape;
  }

  get calls(): number {
    return this.state.calls;
  }

  get learnedAt(): Date {
    return this.state.learnedAt;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }

  learnedFrom(answer: JsonValue, at: Date): LearnedOutput {
    return new LearnedOutput({
      ...this.state,
      shape: this.state.shape.mergedWith(OutputShape.of(answer)),
      calls: this.state.calls + 1,
      learnedAt: at,
    });
  }

  equals(other: LearnedOutput): boolean {
    return this.teamId.equals(other.teamId) && this.tool.equals(other.tool);
  }
}
