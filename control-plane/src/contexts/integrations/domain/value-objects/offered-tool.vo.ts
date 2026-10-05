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
        `offers ${input.source.value}.${name}, which ${because}`,
      );

    if (!TOOL_NAME.test(name)) {
      throw refuse('is not named in lower case words joined by dashes');
    }

    if (description.length === 0) {
      throw refuse(
        'says nothing about when to use it, which is how an agent decides to',
      );
    }

    for (const each of inputs) {
      if (!TOOL_INPUT_NAME.test(each.name)) {
        throw refuse(
          `takes ${JSON.stringify(each.name)}: name an input in letters, digits, dashes and underscores, as in issue or team_id`,
        );
      }

      if (each.name === WHOLE_CALL_INPUT) {
        throw refuse(
          `takes ${WHOLE_CALL_INPUT}, which Spotlight keeps for handing a tool every input at once`,
        );
      }
    }

    const names = inputs.map((each) => each.name);

    if (new Set(names).size !== names.length) {
      throw refuse('takes one input twice');
    }

    if (input.approval && names.includes(APPROVAL_INTENT_INPUT)) {
      throw refuse(
        `needs approval and takes ${APPROVAL_INTENT_INPUT}, which Spotlight keeps for the agent to say what it wants to do`,
      );
    }

    const piped = inputs.filter((each) => each.piped);

    if (piped.length > 1) {
      throw refuse(
        'has more than one input piped in, and only one thing can be piped in',
      );
    }

    if (piped.some((each) => !each.schema.takesText)) {
      throw refuse(
        'has an input piped in that is not text, and text is what is piped',
      );
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
