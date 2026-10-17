const MAX_TOOL_OUTPUT = 16_000;

const NOTHING = 'null';

const jsonOf = (answer: unknown): string | null => {
  try {
    return JSON.stringify(answer ?? null) ?? null;
  } catch {
    return null;
  }
};

export class ToolOutput {
  private constructor(readonly json: string) {}

  static answered(answer: unknown): ToolOutput {
    const json = jsonOf(answer);

    return new ToolOutput(
      json === null || json.length > MAX_TOOL_OUTPUT ? NOTHING : json,
    );
  }

  get answer(): unknown {
    return JSON.parse(this.json);
  }

  equals(other: ToolOutput): boolean {
    return this.json === other.json;
  }
}
