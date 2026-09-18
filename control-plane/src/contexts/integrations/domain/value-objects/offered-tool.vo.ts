import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { WORDS } from '@shared-kernel/domain/value-objects/identifier-shapes';

export const TOOL_INPUT_TYPES = ['string', 'number', 'boolean'] as const;

export type ToolInputType = (typeof TOOL_INPUT_TYPES)[number];

export const TOOL_INPUT_NAME = new RegExp(`^${WORDS}$`);

const TOOL_NAME = new RegExp(`^${WORDS}$`);

export interface OfferedToolInput {
  readonly name: string;
  readonly type: ToolInputType;
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
    readonly does: string,
  ) {}

  static of(input: {
    source: SourceKey;
    name: string;
    description: string;
    inputs?: readonly OfferedToolInput[];
    does: string;
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
          `takes ${JSON.stringify(each.name)}: name an input in lowercase words joined by dashes, as in issue`,
        );
      }
    }

    const names = inputs.map((each) => each.name);

    if (new Set(names).size !== names.length) {
      throw refuse('takes one input twice');
    }

    const piped = inputs.filter((each) => each.piped);

    if (piped.length > 1) {
      throw refuse(
        'has more than one input piped in, and only one thing can be piped in',
      );
    }

    if (piped.some((each) => each.type !== 'string')) {
      throw refuse(
        'has an input piped in that is not text, and text is what is piped',
      );
    }

    return new OfferedTool(input.source, name, description, inputs, input.does);
  }

  get tool(): string {
    return `${this.source.value}.${this.name}`;
  }

  equals(other: OfferedTool): boolean {
    return this.tool === other.tool;
  }
}
