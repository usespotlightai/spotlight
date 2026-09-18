import {
  type Bindings,
  type Expression,
  reads,
  required,
  requiredText,
} from '@integrations/infrastructure/integrations/expression';

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

const lone = (held: Templated): Expression | null => {
  const [only] = held.parts;

  return held.parts.length === 1 &&
    only !== undefined &&
    typeof only !== 'string'
    ? only
    : null;
};

const joined = (
  held: Templated,
  read: (expression: Expression) => string | null,
): string =>
  held.parts
    .map((each) => (typeof each === 'string' ? each : (read(each) ?? '')))
    .join('');

export const requiredTextOf = (
  held: Templated,
  against: Bindings,
): string | null => {
  const only = lone(held);

  return only
    ? requiredText(only, against)
    : joined(held, (each) => requiredText(each, against));
};

export const textOf = (held: Templated, against: Bindings): string | null => {
  const only = lone(held);

  return only
    ? reads(only, against)
    : joined(held, (each) => reads(each, against));
};

export const requiredValueOf = (
  held: Structured,
  against: Bindings,
): unknown => {
  switch (held.kind) {
    case 'value':
      return held.value;
    case 'templated': {
      const only = lone(held.templated);

      return only
        ? required(only, against)
        : requiredTextOf(held.templated, against);
    }
    case 'list':
      return held.items.map((each) => requiredValueOf(each, against));
    case 'map':
      return Object.fromEntries(
        held.entries.map((each) => [
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
