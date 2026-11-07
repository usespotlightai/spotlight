import type { JsonValue } from '@shared-kernel/domain/json-value';
import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { InvalidToolInputError } from '@work/domain/exceptions/invalid-tool-input.error';

export class ToolInputs {
  private constructor(readonly values: Readonly<Record<string, JsonValue>>) {}

  static of(values: Readonly<Record<string, JsonValue>>): ToolInputs {
    return new ToolInputs({ ...values });
  }

  text(name: string): string | null {
    const value = this.values[name];

    return typeof value === 'string' ? value : null;
  }

  texts(name: string): string[] {
    const value = this.values[name];

    return Array.isArray(value)
      ? value.filter((each): each is string => typeof each === 'string')
      : [];
  }

  requiredText(tool: Tool, name: string): string {
    const value = this.text(name);

    if (value === null) {
      throw new InvalidToolInputError(tool.value, `needs ${name}`);
    }

    return value;
  }

  requiredNumber(tool: Tool, name: string): number {
    const value = this.number(name);

    if (value === null) {
      throw new InvalidToolInputError(tool.value, `needs ${name}`);
    }

    return value;
  }

  number(name: string): number | null {
    const value = this.values[name];

    return typeof value === 'number' ? value : null;
  }
}
