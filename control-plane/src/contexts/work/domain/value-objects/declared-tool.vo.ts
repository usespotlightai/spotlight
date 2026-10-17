import type {
  JsonObject,
  JsonValue,
} from '@shared-kernel/domain/services/json-value';
import { APPROVAL_INTENT_INPUT } from '@shared-kernel/domain/value-objects/approval-intent-input';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import {
  INPUT_NAME,
  WHOLE_CALL_INPUT,
} from '@shared-kernel/domain/value-objects/identifier-shapes';
import type { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { InvalidToolError } from '@work/domain/exceptions/invalid-tool.error';
import { InvalidToolInputError } from '@work/domain/exceptions/invalid-tool-input.error';
import { ApprovalIntent } from '@work/domain/value-objects/approval-intent.vo';
import type { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

const TOOL_INPUT_NAME = new RegExp(`^${INPUT_NAME}$`);

const MAX_SHOWN = 80;

export interface ToolInput {
  readonly name: string;
  readonly schema: InputSchema;
  readonly description: string | null;
  readonly required: boolean;
  readonly defaulted: boolean;
  readonly piped: boolean;
}

const absent = (read: unknown): boolean =>
  read === undefined ||
  read === null ||
  (typeof read === 'string' && read.trim() === '');

const shown = (value: unknown): string => {
  const written = JSON.stringify(value) ?? String(value);

  return written.length > MAX_SHOWN
    ? `${written.slice(0, MAX_SHOWN - 1)}…`
    : written;
};

export class DeclaredTool {
  private constructor(
    readonly tool: Tool,
    readonly description: string,
    readonly inputs: readonly ToolInput[],
    readonly approval: ApprovalNeeded | null,
    readonly offeredBy: string | null,
    readonly learnedOutput: JsonObject | null,
  ) {}

  static of(input: {
    tool: Tool;
    description: string;
    inputs?: readonly ToolInput[];
    approval?: ApprovalNeeded | null;
    offeredBy?: string | null;
    learnedOutput?: JsonObject | null;
  }): DeclaredTool {
    const description = input.description.trim();
    const inputs = input.inputs ?? [];

    if (description.length === 0) {
      throw new InvalidToolError(input.tool.value, 'must say when to use it');
    }

    for (const each of inputs) {
      if (!TOOL_INPUT_NAME.test(each.name)) {
        throw new InvalidToolError(
          input.tool.value,
          `input ${JSON.stringify(each.name)} must be letters, digits, dashes and underscores, as in issue or team_id`,
        );
      }

      if (each.name === WHOLE_CALL_INPUT) {
        throw new InvalidToolError(
          input.tool.value,
          `cannot take input ${WHOLE_CALL_INPUT}. That input is reserved for handing a tool every input at once`,
        );
      }
    }

    const names = inputs.map((each) => each.name);

    if (new Set(names).size !== names.length) {
      throw new InvalidToolError(input.tool.value, 'names an input twice');
    }

    if (input.approval && names.includes(APPROVAL_INTENT_INPUT)) {
      throw new InvalidToolError(
        input.tool.value,
        `needs approval, so it cannot take input ${APPROVAL_INTENT_INPUT}. That input is reserved for approvals`,
      );
    }

    const piped = inputs.filter((each) => each.piped);

    if (piped.length > 1) {
      throw new InvalidToolError(
        input.tool.value,
        'can pipe in only one input',
      );
    }

    if (piped.some((each) => !each.schema.takesText)) {
      throw new InvalidToolError(
        input.tool.value,
        'can pipe in only a text input',
      );
    }

    return new DeclaredTool(
      input.tool,
      description,
      inputs,
      input.approval ?? null,
      input.offeredBy?.trim() || null,
      input.learnedOutput ?? null,
    );
  }

  withApproval(needed: ApprovalNeeded): DeclaredTool {
    return new DeclaredTool(
      this.tool,
      this.description,
      this.inputs,
      needed,
      this.offeredBy,
      this.learnedOutput,
    );
  }

  intentIn(value: unknown): {
    readonly intent: ApprovalIntent | null;
    readonly rest: unknown;
  } {
    if (
      !this.approval ||
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      !(APPROVAL_INTENT_INPUT in value)
    ) {
      return { intent: null, rest: value };
    }

    const { [APPROVAL_INTENT_INPUT]: intent, ...rest } = value as Record<
      string,
      unknown
    >;

    return { intent: ApprovalIntent.from(intent), rest };
  }

  callWith(inputs: ToolInputs): ToolCall {
    return ToolCall.of(
      this.tool,
      inputs,
      Object.fromEntries(this.inputs.map((each) => [each.name, each.schema])),
    );
  }

  accept(
    value: unknown,
    defaultFor: (input: ToolInput) => unknown = () => undefined,
  ): ToolInputs {
    const handed = (
      value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value
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

    const values: Record<string, JsonValue> = {};

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

      const coerced = each.schema.coerce(read);
      const problem = each.schema.problemWith(coerced);

      if (problem) {
        throw new InvalidToolInputError(
          this.tool.value,
          `takes ${each.name}, and ${
            problem.at.isRoot
              ? shown(coerced)
              : FieldPath.of([each.name, ...problem.at.segments]).rendered
          } ${problem.why}`,
        );
      }

      values[each.name] = coerced as JsonValue;
    }

    return ToolInputs.of(values);
  }
}
