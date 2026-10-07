import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import type { ApprovalNeeded } from '@integrations/domain/value-objects/approval-needed.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { APPROVAL_INTENT_INPUT } from '@shared-kernel/domain/value-objects/approval-intent-input';
import {
  INPUT_NAME,
  WHOLE_CALL_INPUT,
  WORDS,
} from '@shared-kernel/domain/value-objects/identifier-shapes';
import type { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';

export const TOOL_INPUT_NAME = new RegExp(`^${INPUT_NAME}$`);

const TOOL_NAME = new RegExp(`^${WORDS}$`);

export interface OfferedToolInput {
  readonly name: string;
  readonly schema: InputSchema;
  readonly description: string | null;
  readonly required: boolean;
  readonly defaulted: boolean;
  readonly piped: boolean;
}

export class OfferedTool {
  private constructor(
    readonly source: SourceKey,
    readonly name: string,
    readonly description: string,
    readonly inputs: readonly OfferedToolInput[],
    readonly backing: ToolBacking,
    readonly approval: ApprovalNeeded | null,
  ) {}

  static of(input: {
    source: SourceKey;
    name: string;
    description: string;
    inputs?: readonly OfferedToolInput[];
    backing: ToolBacking;
    approval?: ApprovalNeeded | null;
  }): OfferedTool {
    const name = input.name.trim();
    const description = input.description.trim();
    const inputs = input.inputs ?? [];
    const refuse = (because: string) =>
      new InvalidIntegrationError(
        input.source.value,
        `tool ${input.source.value}.${name} ${because}`,
      );

    if (!TOOL_NAME.test(name)) {
      throw refuse('must be named in lowercase words joined by dashes');
    }

    if (description.length === 0) {
      throw refuse('needs a description of when to use it');
    }

    for (const each of inputs) {
      if (!TOOL_INPUT_NAME.test(each.name)) {
        throw refuse(
          `input ${JSON.stringify(each.name)} must be letters, digits, dashes and underscores, as in issue or team_id`,
        );
      }

      if (each.name === WHOLE_CALL_INPUT) {
        throw refuse(
          `cannot take reserved input ${WHOLE_CALL_INPUT}, which hands a tool every input at once`,
        );
      }
    }

    const names = inputs.map((each) => each.name);

    if (new Set(names).size !== names.length) {
      throw refuse('takes an input more than once');
    }

    if (input.approval && names.includes(APPROVAL_INTENT_INPUT)) {
      throw refuse(
        `needs approval and cannot take reserved input ${APPROVAL_INTENT_INPUT}`,
      );
    }

    const piped = inputs.filter((each) => each.piped);

    if (piped.length > 1) {
      throw refuse('pipes in more than one input');
    }

    if (piped.some((each) => !each.schema.takesText)) {
      throw refuse('pipes in an input that is not text');
    }

    return new OfferedTool(
      input.source,
      name,
      description,
      inputs,
      input.backing,
      input.approval ?? null,
    );
  }

  get tool(): string {
    return `${this.source.value}.${this.name}`;
  }

  equals(other: OfferedTool): boolean {
    return this.tool === other.tool;
  }
}
