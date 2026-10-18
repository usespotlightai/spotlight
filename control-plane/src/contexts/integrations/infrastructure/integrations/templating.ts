import type { CelVariables } from '@platform/expressions/cel-variables';
import type { Expression } from '@platform/expressions/expression-engine.port';
import {
  evaluateText,
  required,
  requiredText,
} from '@platform/expressions/readings';

export interface Templated {
  readonly parts: readonly (string | Expression)[];
}

export type Structured =
  | { readonly kind: 'value'; readonly value: number | boolean | null }
  | { readonly kind: 'templated'; readonly templated: Templated }
  | { readonly kind: 'list'; readonly items: readonly Structured[] }
  | {
      readonly kind: 'map';
      readonly entries: readonly {
        readonly key: string;
        readonly value: Structured;
      }[];
    };

export const PIECE = /\$\{\{([\s\S]*?)\}\}/g;

const lone = (template: Templated): Expression | null => {
  const [only] = template.parts;

  return template.parts.length === 1 &&
    only !== undefined &&
    typeof only !== 'string'
    ? only
    : null;
};

const joined = (
  template: Templated,
  read: (expression: Expression) => string | null,
): string =>
  template.parts
    .map((each) => (typeof each === 'string' ? each : (read(each) ?? '')))
    .join('');

export const requiredTextOf = (
  template: Templated,
  against: CelVariables,
): string | null => {
  const only = lone(template);

  return only
    ? requiredText(only, against)
    : joined(template, (each) => requiredText(each, against));
};

export const textOf = (
  template: Templated,
  against: CelVariables,
): string | null => {
  const only = lone(template);

  return only
    ? evaluateText(only, against)
    : joined(template, (each) => evaluateText(each, against));
};

export const requiredValueOf = (
  structured: Structured,
  against: CelVariables,
): unknown => {
  switch (structured.kind) {
    case 'value':
      return structured.value;
    case 'templated': {
      const only = lone(structured.templated);

      return only
        ? required(only, against)
        : requiredTextOf(structured.templated, against);
    }
    case 'list':
      return structured.items.map((each) => requiredValueOf(each, against));
    case 'map':
      return Object.fromEntries(
        structured.entries.map((each) => [
          each.key,
          requiredValueOf(each.value, against),
        ]),
      );
  }
};

export const asJson = (value: unknown): string =>
  JSON.stringify(value, (_key, each) =>
    typeof each === 'bigint' ? Number(each) : each,
  );
