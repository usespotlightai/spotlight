import { Tool } from '@work/domain/value-objects/tool.vo';
import {
  ToolInputs,
  type ToolInputValue,
} from '@work/domain/value-objects/tool-inputs.vo';

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

  equals(other: ToolCall): boolean {
    return (
      this.tool.equals(other.tool) &&
      canonical(this.inputs.values) === canonical(other.inputs.values)
    );
  }
}
