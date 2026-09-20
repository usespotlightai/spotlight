import { WORDS } from '@shared-kernel/domain/value-objects/identifier-shapes';
import { InvalidToolError } from '@work/domain/exceptions/invalid-tool.error';
import { InvalidToolInputError } from '@work/domain/exceptions/invalid-tool-input.error';
import type { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';
import {
  ToolInputs,
  type ToolInputValue,
} from '@work/domain/value-objects/tool-inputs.vo';

export const TOOL_INPUT_TYPES = ['string', 'number', 'boolean'] as const;

export type ToolInputType = (typeof TOOL_INPUT_TYPES)[number];

const TOOL_INPUT_NAME = new RegExp(`^${WORDS}$`);

export interface ToolInput {
  readonly name: string;
  readonly type: ToolInputType;
  readonly description: string | null;
  readonly required: boolean;
  readonly defaulted: boolean;
  readonly piped: boolean;
}

const absent = (read: unknown): boolean =>
  read === undefined ||
  read === null ||
  (typeof read === 'string' && read.trim() === '');

const asType = (
  type: ToolInputType,
  read: unknown,
): ToolInputValue | undefined => {
  switch (type) {
    case 'string':
      return typeof read === 'string'
        ? read
        : typeof read === 'number' || typeof read === 'boolean'
          ? String(read)
          : undefined;
    case 'number': {
      const number =
        typeof read === 'number'
          ? read
          : typeof read === 'string' && read.trim() !== ''
            ? Number(read)
            : Number.NaN;
      return Number.isFinite(number) ? number : undefined;
    }
    case 'boolean':
      return typeof read === 'boolean'
        ? read
        : read === 'true'
          ? true
          : read === 'false'
            ? false
            : undefined;
  }
};

export class DeclaredTool {
  private constructor(
    readonly tool: Tool,
    readonly description: string,
    readonly inputs: readonly ToolInput[],
    readonly approval: ApprovalNeeded | null,
  ) {}

  static of(input: {
    tool: Tool;
    description: string;
    inputs?: readonly ToolInput[];
    approval?: ApprovalNeeded | null;
  }): DeclaredTool {
    const description = input.description.trim();
    const inputs = input.inputs ?? [];

    if (description.length === 0) {
      throw new InvalidToolError(
        input.tool.value,
        'says nothing about when to use it, which is how an agent decides to',
      );
    }

    for (const each of inputs) {
      if (!TOOL_INPUT_NAME.test(each.name)) {
        throw new InvalidToolError(
          input.tool.value,
          `takes ${JSON.stringify(each.name)}: name an input in lowercase words joined by dashes, as in issue`,
        );
      }
    }

    const names = inputs.map((each) => each.name);

    if (new Set(names).size !== names.length) {
      throw new InvalidToolError(input.tool.value, 'takes one input twice');
    }

    const piped = inputs.filter((each) => each.piped);

    if (piped.length > 1) {
      throw new InvalidToolError(
        input.tool.value,
        'has more than one input piped in, and only one thing can be piped in',
      );
    }

    if (piped.some((each) => each.type !== 'string')) {
      throw new InvalidToolError(
        input.tool.value,
        'has an input piped in that is not text, and text is what is piped',
      );
    }

    return new DeclaredTool(
      input.tool,
      description,
      inputs,
      input.approval ?? null,
    );
  }

  accept(
    given: unknown,
    defaultFor: (input: ToolInput) => unknown = () => undefined,
  ): ToolInputs {
    const handed = (
      given !== null && typeof given === 'object' && !Array.isArray(given)
        ? given
        : {}
    ) as Record<string, unknown>;
    const takes = this.inputs.map((each) => each.name);
    const unknown = Object.keys(handed).filter((name) => !takes.includes(name));

    if (unknown.length > 0) {
      throw new InvalidToolInputError(
        this.tool.value,
        `takes no ${unknown.join(', ')}; it takes ${
          takes.length > 0 ? takes.join(', ') : 'nothing'
        }`,
      );
    }

    const values: Record<string, ToolInputValue> = {};

    for (const each of this.inputs) {
      const read =
        absent(handed[each.name]) && each.defaulted
          ? defaultFor(each)
          : handed[each.name];

      if (absent(read)) {
        if (each.required) {
          throw new InvalidToolInputError(
            this.tool.value,
            each.defaulted
              ? `needs ${each.name}, and this task has nothing to read it from`
              : `needs ${each.name}`,
          );
        }
        continue;
      }

      const typed = asType(each.type, read);

      if (typed === undefined) {
        throw new InvalidToolInputError(
          this.tool.value,
          `takes ${each.name} as a ${each.type}, and ${JSON.stringify(read)} is not one`,
        );
      }

      values[each.name] = typed;
    }

    return ToolInputs.of(values);
  }
}
