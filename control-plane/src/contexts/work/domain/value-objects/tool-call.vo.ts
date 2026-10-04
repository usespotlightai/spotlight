import { Tool } from '@work/domain/value-objects/tool.vo';
import {
  ToolInputs,
  type ToolInputValue,
} from '@work/domain/value-objects/tool-inputs.vo';

const typedAs = (
  asked: ToolInputValue,
  edit: string,
): ToolInputValue | undefined => {
  if (edit.trim() === '' && String(asked).trim() !== '') {
    return undefined;
  }

  if (typeof asked === 'string') {
    return edit;
  }

  if (typeof asked === 'number') {
    const number = edit.trim() === '' ? Number.NaN : Number(edit);
    return Number.isFinite(number) ? number : undefined;
  }

  return edit === 'true' ? true : edit === 'false' ? false : undefined;
};

const canonical = (values: Readonly<Record<string, ToolInputValue>>): string =>
  JSON.stringify(
    Object.keys(values)
      .sort()
      .map((name) => [name, values[name]]),
  );

export class ToolCall {
  private constructor(
    readonly tool: Tool,
    readonly inputs: ToolInputs,
  ) {}

  static of(tool: Tool, inputs: ToolInputs): ToolCall {
    return new ToolCall(tool, inputs);
  }

  static rehydrate(input: {
    tool: string;
    inputs: Readonly<Record<string, ToolInputValue>>;
  }): ToolCall {
    return new ToolCall(Tool.of(input.tool), ToolInputs.of(input.inputs));
  }

  get parts(): {
    tool: string;
    inputs: Readonly<Record<string, ToolInputValue>>;
  } {
    return { tool: this.tool.value, inputs: this.inputs.values };
  }

  get given(): readonly { readonly name: string; readonly value: string }[] {
    return Object.keys(this.inputs.values)
      .sort()
      .map((name) => ({ name, value: String(this.inputs.values[name]) }));
  }

  editedTo(edits: Readonly<Record<string, string>>): ToolCall | null {
    const asked = this.inputs.values;
    const names = Object.keys(asked);
    const edited = new Set(Object.keys(edits));

    if (
      names.length !== edited.size ||
      names.some((name) => !edited.has(name))
    ) {
      return null;
    }

    const typed: Record<string, ToolInputValue> = {};

    for (const name of names) {
      const value = typedAs(asked[name] as ToolInputValue, edits[name] ?? '');

      if (value === undefined) {
        return null;
      }

      typed[name] = value;
    }

    return new ToolCall(this.tool, ToolInputs.of(typed));
  }

  equals(other: ToolCall): boolean {
    return (
      this.tool.equals(other.tool) &&
      canonical(this.inputs.values) === canonical(other.inputs.values)
    );
  }
}
