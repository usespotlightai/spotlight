import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OutputShape } from '@integrations/domain/value-objects/output-shape.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { JsonValue } from '@shared-kernel/domain/services/json-value';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

interface State {
  readonly teamId: TeamId;
  readonly tool: ToolName;
  readonly shape: OutputShape;
  readonly calls: number;
  readonly inferredAt: Date;
  readonly version: number;
}

export class InferredOutputSchema {
  private constructor(private readonly state: State) {}

  static first(input: {
    teamId: TeamId;
    tool: ToolName;
    answer: JsonValue;
    at: Date;
  }): InferredOutputSchema {
    return new InferredOutputSchema({
      teamId: input.teamId,
      tool: input.tool,
      shape: OutputShape.of(input.answer),
      calls: 1,
      inferredAt: input.at,
      version: 0,
    });
  }

  static rehydrate(input: State): InferredOutputSchema {
    if (input.version < 1 || input.calls < 1) {
      throw new InconsistentStateError(
        'inferred output schema',
        'was stored without a version or a call it was inferred from',
      );
    }

    return new InferredOutputSchema(input);
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get tool(): ToolName {
    return this.state.tool;
  }

  get integration(): IntegrationKey {
    return IntegrationKey.of(this.state.tool.value.split('.')[0] ?? '');
  }

  get shape(): OutputShape {
    return this.state.shape;
  }

  get calls(): number {
    return this.state.calls;
  }

  get inferredAt(): Date {
    return this.state.inferredAt;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }

  inferFrom(answer: JsonValue, at: Date): InferredOutputSchema {
    return new InferredOutputSchema({
      ...this.state,
      shape: this.state.shape.mergedWith(OutputShape.of(answer)),
      calls: this.state.calls + 1,
      inferredAt: at,
    });
  }

  equals(other: InferredOutputSchema): boolean {
    return this.teamId.equals(other.teamId) && this.tool.equals(other.tool);
  }
}
