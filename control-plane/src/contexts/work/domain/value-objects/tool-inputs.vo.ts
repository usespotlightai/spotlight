export type ToolInputValue = string | number | boolean;

export class ToolInputs {
  private constructor(
    readonly values: Readonly<Record<string, ToolInputValue>>,
  ) {}

  static of(values: Readonly<Record<string, ToolInputValue>>): ToolInputs {
    return new ToolInputs({ ...values });
  }

  text(name: string): string | null {
    const value = this.values[name];

    return typeof value === 'string' ? value : null;
  }
}
