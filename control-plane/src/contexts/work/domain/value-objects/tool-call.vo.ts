import {
  isJsonObject,
  isJsonValue,
  type JsonObject,
  type JsonValue,
  sameJson,
} from '@shared-kernel/domain/services/json-value';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

const parsed = (edit: string): JsonValue | undefined => {
  try {
    const read: unknown = JSON.parse(edit);

    return isJsonValue(read) ? read : undefined;
  } catch {
    return undefined;
  }
};

const typedAs = (asked: JsonValue, edit: string): JsonValue | undefined => {
  if (edit.trim() === '' && writtenOf(asked).trim() !== '') {
    return undefined;
  }

  if (typeof asked === 'string') {
    return edit;
  }

  if (typeof asked === 'number') {
    const number = edit.trim() === '' ? Number.NaN : Number(edit);
    return Number.isFinite(number) ? number : undefined;
  }

  if (typeof asked === 'boolean') {
    return edit === 'true' ? true : edit === 'false' ? false : undefined;
  }

  const read = parsed(edit);

  if (Array.isArray(asked)) {
    return Array.isArray(read) ? read : undefined;
  }

  if (isJsonObject(asked)) {
    return isJsonObject(read) ? read : undefined;
  }

  return read;
};

const writtenOf = (value: JsonValue): string =>
  typeof value === 'string'
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : JSON.stringify(value, null, 2);

export type EditedCall =
  | { readonly call: ToolCall }
  | { readonly refused: string | null };

type Shapes = Readonly<Record<string, InputSchema>>;

export class ToolCall {
  private constructor(
    readonly tool: Tool,
    readonly inputs: ToolInputs,
    private readonly shapes: Shapes,
  ) {}

  static of(tool: Tool, inputs: ToolInputs, shapes: Shapes = {}): ToolCall {
    return new ToolCall(tool, inputs, shapes);
  }

  static rehydrate(input: {
    tool: string;
    inputs: Readonly<Record<string, JsonValue>>;
    shapes: Readonly<Record<string, JsonObject>>;
  }): ToolCall {
    return new ToolCall(
      Tool.of(input.tool),
      ToolInputs.of(input.inputs),
      Object.fromEntries(
        Object.entries(input.shapes).map(([name, written]) => [
          name,
          InputSchema.of(written),
        ]),
      ),
    );
  }

  get parts(): {
    tool: string;
    inputs: Readonly<Record<string, JsonValue>>;
    shapes: Readonly<Record<string, JsonObject>>;
  } {
    return {
      tool: this.tool.value,
      inputs: this.inputs.values,
      shapes: Object.fromEntries(
        Object.entries(this.shapes).map(([name, shape]) => [
          name,
          shape.written,
        ]),
      ),
    };
  }

  get given(): readonly { readonly name: string; readonly value: string }[] {
    return Object.keys(this.inputs.values)
      .sort()
      .map((name) => ({
        name,
        value: writtenOf(this.inputs.values[name] as JsonValue),
      }));
  }

  editedTo(edits: Readonly<Record<string, string>>): EditedCall {
    const asked = this.inputs.values;
    const names = Object.keys(asked);
    const edited = new Set(Object.keys(edits));

    if (
      names.length !== edited.size ||
      names.some((name) => !edited.has(name))
    ) {
      return { refused: null };
    }

    const typed: Record<string, JsonValue> = {};

    for (const name of names) {
      const value = typedAs(asked[name] as JsonValue, edits[name] ?? '');

      if (value === undefined) {
        return { refused: null };
      }

      const problem = this.shapes[name]?.problemWith(value);

      if (problem) {
        return {
          refused: `${FieldPath.of([name, ...problem.at.segments]).rendered} ${problem.why}`,
        };
      }

      typed[name] = value;
    }

    return {
      call: new ToolCall(this.tool, ToolInputs.of(typed), this.shapes),
    };
  }

  equals(other: ToolCall): boolean {
    const mine = this.inputs.values;
    const theirs = other.inputs.values;

    return (
      this.tool.equals(other.tool) &&
      Object.keys(mine).length === Object.keys(theirs).length &&
      Object.keys(mine).every(
        (name) =>
          name in theirs &&
          sameJson(mine[name] as JsonValue, theirs[name] as JsonValue),
      )
    );
  }
}
