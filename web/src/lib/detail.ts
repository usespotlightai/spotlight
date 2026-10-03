import type { TraceNode } from '@/lib/trace';

export interface Told {
  readonly title: string;
  readonly body: string;
  readonly prose: boolean;
  readonly command?: boolean;
}

const SPOKEN: Record<string, string> = {
  said: 'Message',
  thought: 'Reasoning',
};

export const askedOf = (node: TraceNode): Told | null => {
  const step = node.step;

  if (!step?.given) {
    return null;
  }

  const command = step.kind === 'hook' || step.tool === 'execute';

  return { title: 'Input', body: step.given, prose: false, command };
};

export const answeredBy = (node: TraceNode): Told | null => {
  const step = node.step;

  if (!step) {
    return null;
  }

  const spoken = SPOKEN[step.kind];

  if (spoken) {
    return step.text === node.name
      ? null
      : { title: spoken, body: step.text, prose: true };
  }

  const back = step.detail ?? step.returned;

  return back ? { title: 'Output', body: back, prose: false } : null;
};

export interface Field {
  readonly path: string;
  readonly value: string;
  readonly kind: 'string' | 'number' | 'boolean' | 'null';
}

const leaf = (path: string, held: unknown): Field => {
  if (held === null) {
    return { path, value: 'null', kind: 'null' };
  }
  if (typeof held === 'string') {
    return { path, value: `"${held}"`, kind: 'string' };
  }
  if (typeof held === 'boolean') {
    return { path, value: String(held), kind: 'boolean' };
  }
  return { path, value: String(held), kind: 'number' };
};

const walked = (held: unknown, at: string): Field[] => {
  if (Array.isArray(held)) {
    return held.length === 0
      ? [leaf(at, '[]')]
      : held.flatMap((each, i) => walked(each, `${at}[${i}]`));
  }

  if (held !== null && typeof held === 'object') {
    const entries = Object.entries(held);

    return entries.length === 0
      ? [leaf(at, '{}')]
      : entries.flatMap(([key, value]) =>
          walked(value, at ? `${at}.${key}` : key),
        );
  }

  return [leaf(at, held)];
};

export const shaped = (body: string): Field[] | null => {
  let held: unknown;

  try {
    held = JSON.parse(body);
  } catch {
    return null;
  }

  return held !== null && typeof held === 'object' ? walked(held, '') : null;
};

const LABELS: Record<string, string> = {
  said: 'Said',
  thought: 'Thoughts',
  tool: 'Tools',
  planned: 'Plans',
  hook: 'Hooks',
};

export interface Holding {
  readonly rows: number;
  readonly faults: number;
  readonly kinds: ReadonlyMap<string, number>;
}

export const holdings = (node: TraceNode): Holding => {
  const kinds = new Map<string, number>();
  let rows = 0;
  let faults = 0;

  const walk = (each: TraceNode) => {
    for (const child of each.children) {
      rows += 1;

      if (child.tone === 'failed') {
        faults += 1;
      }

      const label = child.step
        ? (LABELS[child.step.kind] ?? 'Tools')
        : child.span
          ? 'Reported'
          : null;

      if (label) {
        kinds.set(label, (kinds.get(label) ?? 0) + 1);
      }

      walk(child);
    }
  };

  walk(node);

  return { rows, faults, kinds };
};

const PROMOTED = new Set([
  'gen_ai.request.model',
  'llm.model_name',
  'gen_ai.usage.input_tokens',
  'gen_ai.usage.output_tokens',
  'gen_ai.usage.prompt_tokens',
  'gen_ai.usage.completion_tokens',
]);

export const restOf = (node: TraceNode) =>
  node.span?.attributes.filter((each) => !PROMOTED.has(each.name)) ?? [];

export const reported = (
  node: TraceNode,
  ...names: readonly string[]
): string | null => {
  const values = new Map(
    [...(node.span?.attributes ?? [])]
      .reverse()
      .map((each) => [each.name, each.value]),
  );

  for (const name of names) {
    const held = values.get(name);

    if (held !== undefined) {
      return held;
    }
  }

  return null;
};
