import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { slugify } from '@shared-kernel/domain/value-objects/identifier-shapes';
import type { CalledTool } from '@work/domain/value-objects/called-tool.vo';

const PROSE = new Set(['description']);

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
  );
};

const withoutProse = (input: unknown): unknown =>
  typeof input === 'object' && input !== null && !Array.isArray(input)
    ? Object.fromEntries(
        Object.entries(input).filter(([key]) => !PROSE.has(key)),
      )
    : input;

export class HarnessPermission {
  private constructor(
    readonly harness: HarnessId,
    readonly kind: string,
    readonly title: string,
    readonly input: string,
    readonly tool: CalledTool | null,
  ) {}

  static asked(input: {
    harness: HarnessId;
    kind: string;
    title: string;
    input: unknown;
    tool: CalledTool | null;
  }): HarnessPermission {
    return new HarnessPermission(
      input.harness,
      slugify(input.kind) || 'other',
      input.title.trim(),
      input.input === undefined
        ? ''
        : JSON.stringify(canonical(withoutProse(input.input))),
      input.tool,
    );
  }

  static rehydrate(input: {
    harness: string;
    kind: string;
    title: string;
    input: string;
    tool: CalledTool | null;
  }): HarnessPermission {
    return new HarnessPermission(
      HarnessId.of(input.harness),
      input.kind,
      input.title,
      input.input,
      input.tool,
    );
  }

  get name(): string {
    return `${this.harness.value} ${this.kind}`;
  }

  get writtenInputs(): readonly {
    readonly name: string;
    readonly value: string;
  }[] {
    return [
      { name: 'title', value: this.title },
      ...(this.input ? [{ name: 'input', value: this.input }] : []),
    ];
  }

  equals(other: HarnessPermission): boolean {
    return (
      this.harness.equals(other.harness) &&
      this.kind === other.kind &&
      this.title === other.title &&
      this.input === other.input
    );
  }
}
