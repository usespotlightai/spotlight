import type { ExpressionSpan } from '@platform/expressions/expression-engine.port';
import type { Scope } from '@platform/expressions/scope';

const UNKNOWN_VARIABLE = /^Unknown variable: (\S+)/;
const NO_SUCH_KEY = /^No such key: (\S+)/;
const RECEIVER = /([A-Za-z_]\w*(?:\s*\.\s*[A-Za-z_]\w*)*)\s*\.\s*$/;

const distance = (from: string, to: string): number => {
  const rows = Array.from({ length: from.length + 1 }, (_, at) =>
    Array.from({ length: to.length + 1 }, (_, across) =>
      at === 0 ? across : across === 0 ? at : 0,
    ),
  );

  for (let at = 1; at <= from.length; at += 1) {
    for (let across = 1; across <= to.length; across += 1) {
      const differs = from[at - 1] === to[across - 1] ? 0 : 1;
      const row = rows[at] as number[];
      const above = rows[at - 1] as number[];
      row[across] = Math.min(
        (above[across] as number) + 1,
        (row[across - 1] as number) + 1,
        (above[across - 1] as number) + differs,
      );

      if (
        at > 1 &&
        across > 1 &&
        from[at - 1] === to[across - 2] &&
        from[at - 2] === to[across - 1]
      ) {
        row[across] = Math.min(
          row[across] as number,
          ((rows[at - 2] as number[])[across - 2] as number) + 1,
        );
      }
    }
  }

  return (rows[from.length] as number[])[to.length] as number;
};

const closest = (
  word: string,
  candidates: readonly string[],
): string | null => {
  let nearest: string | null = null;
  let within = Math.min(
    word.length - 1,
    Math.max(2, Math.floor(word.length / 3)),
  );

  for (const candidate of candidates) {
    const apart = distance(word.toLowerCase(), candidate.toLowerCase());

    if (candidate !== word && apart <= within) {
      nearest = candidate;
      within = apart - 1;
    }
  }

  return nearest;
};

export const suggestionFor = (
  source: string,
  reason: string,
  span: ExpressionSpan | null,
  scope: Scope,
): string | null => {
  const unknown = UNKNOWN_VARIABLE.exec(reason)?.[1];

  if (unknown) {
    return closest(unknown, scope.names);
  }

  const missing = NO_SUCH_KEY.exec(reason)?.[1];
  const receiver = span
    ? RECEIVER.exec(source.slice(0, span.start))?.[1]
    : undefined;

  if (!missing || !receiver) {
    return null;
  }

  const path = receiver.split('.').map((each) => each.trim());
  const field = closest(missing, scope.fieldsAt(path));

  return field ? [...path, field].join('.') : null;
};
