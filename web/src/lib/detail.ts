import type { TraceNode } from '@/lib/trace';

/**
 * One thing worth reading about a row, in the shape every kind of row is read
 * in. Uniformity is the point: a run, a phase, a command and a model call all
 * answer the same questions, and answer nothing where they have nothing.
 */
export interface Told {
  readonly title: string;
  readonly body: string;
  /** Prose wraps; what a machine wrote is kept as it was written. */
  readonly prose: boolean;
}

const SPOKEN: Record<string, string> = {
  said: 'Message',
  thought: 'Reasoning',
};

export const askedOf = (node: TraceNode): Told | null =>
  node.step?.given
    ? { title: 'Input', body: node.step.given, prose: false }
    : null;

export const answeredBy = (node: TraceNode): Told | null => {
  const step = node.step;

  if (!step) {
    return null;
  }

  // A row named for its kind rather than its words leaves the words with
  // nowhere else to be read.
  const spoken = SPOKEN[step.kind];

  if (spoken) {
    return step.text === node.name
      ? null
      : { title: spoken, body: step.text, prose: true };
  }

  const back = step.detail ?? step.returned;

  return back ? { title: 'Output', body: back, prose: false } : null;
};

/** One row of a shape: where it sits, and what is there. */
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

/**
 * What was written as JSON, read as the shape it is. A blob of braces says
 * less than the same thing laid out as paths and values, and every section
 * that holds a shape then reads the same way.
 */
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
  /** How many of each sort sit beneath it, by the name a reader knows. */
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

/** What the header says in its own words, and so does not list again. */
export const PROMOTED = [
  'gen_ai.request.model',
  'llm.model_name',
  'gen_ai.usage.input_tokens',
  'gen_ai.usage.output_tokens',
  'gen_ai.usage.prompt_tokens',
  'gen_ai.usage.completion_tokens',
];

/** Everything the harness reported that the header did not already say. */
export const restOf = (node: TraceNode) =>
  node.span?.attributes.filter((each) => !PROMOTED.includes(each.name)) ?? [];

/** The first of these a harness reported about itself, where it reported any. */
export const reported = (
  node: TraceNode,
  ...names: readonly string[]
): string | null => {
  for (const name of names) {
    const held = node.span?.attributes.find((each) => each.name === name);

    if (held) {
      return held.value;
    }
  }

  return null;
};
