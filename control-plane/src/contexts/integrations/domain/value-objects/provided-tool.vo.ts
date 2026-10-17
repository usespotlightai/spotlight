import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import type { ApprovalNeeded } from '@integrations/domain/value-objects/approval-needed.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { APPROVAL_INTENT_INPUT } from '@shared-kernel/domain/value-objects/approval-intent-input';
import {
  INPUT_NAME,
  SLUG_SHAPE,
  WHOLE_CALL_INPUT,
} from '@shared-kernel/domain/value-objects/identifier-shapes';
import type { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';

export const TOOL_INPUT_NAME = new RegExp(`^${INPUT_NAME}$`);

const TOOL_NAME = new RegExp(`^${SLUG_SHAPE}$`);

export interface ProvidedToolInput {
  readonly name: string;
  readonly schema: InputSchema;
  readonly description: string | null;
  readonly required: boolean;
  readonly defaulted: boolean;
  readonly stdin: boolean;
}

export class ProvidedTool {
  private constructor(
    readonly integration: IntegrationKey,
    readonly name: string,
    readonly description: string,
    readonly inputs: readonly ProvidedToolInput[],
    readonly backing: ToolBacking,
    readonly approval: ApprovalNeeded | null,
  ) {}

  static of(input: {
    integration: IntegrationKey;
    name: string;
    description: string;
    inputs?: readonly ProvidedToolInput[];
    backing: ToolBacking;
    approval?: ApprovalNeeded | null;
  }): ProvidedTool {
    const name = input.name.trim();
    const description = input.description.trim();
    const inputs = input.inputs ?? [];
    const invalid = (because: string) =>
      new InvalidIntegrationError(
        input.integration.value,
        `tool ${input.integration.value}.${name} ${because}`,
      );

    if (!TOOL_NAME.test(name)) {
      throw invalid('must be named in lowercase words joined by dashes');
    }

    if (description.length === 0) {
      throw invalid('needs a description of when to use it');
    }

    for (const each of inputs) {
      if (!TOOL_INPUT_NAME.test(each.name)) {
        throw invalid(
          `input ${JSON.stringify(each.name)} must be letters, digits, dashes and underscores, as in issue or team_id`,
        );
      }

      if (each.name === WHOLE_CALL_INPUT) {
        throw invalid(
          `cannot take reserved input ${WHOLE_CALL_INPUT}. That input hands a tool every input at once`,
        );
      }
    }

    const names = inputs.map((each) => each.name);

    if (new Set(names).size !== names.length) {
      throw invalid('takes an input more than once');
    }

    if (input.approval && names.includes(APPROVAL_INTENT_INPUT)) {
      throw invalid(
        `needs approval and cannot take reserved input ${APPROVAL_INTENT_INPUT}`,
      );
    }

    const stdin = inputs.filter((each) => each.stdin);

    if (stdin.length > 1) {
      throw invalid('pipes in more than one input');
    }

    if (stdin.some((each) => !each.schema.takesText)) {
      throw invalid('pipes in an input that is not text');
    }

    return new ProvidedTool(
      input.integration,
      name,
      description,
      inputs,
      input.backing,
      input.approval ?? null,
    );
  }

  get tool(): string {
    return `${this.integration.value}.${this.name}`;
  }

  equals(other: ProvidedTool): boolean {
    return this.tool === other.tool;
  }
}
