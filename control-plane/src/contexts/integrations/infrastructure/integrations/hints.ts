import type { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

type Hint = string | { readonly [field: string]: Hint };

export type Shape = { readonly [field: string]: Hint };

const PRIMITIVES = new Set([
  'string',
  'int',
  'uint',
  'double',
  'bool',
  'bytes',
  'dyn',
]);

const MAP_KEYS = new Set(['string', 'int', 'uint', 'bool']);

const LIST = /^list<\s*(.+)\s*>$/;
const MAP = /^map<\s*([^,<>]+?)\s*,\s*(.+)\s*>$/;

export const typeProblem = (
  written: string,
  known: ReadonlySet<string>,
): string | null => {
  const type = written.trim();

  if (PRIMITIVES.has(type) || known.has(type)) {
    return null;
  }

  const list = LIST.exec(type);
  if (list) {
    return typeProblem(list[1] as string, known);
  }

  const map = MAP.exec(type);
  if (map) {
    return MAP_KEYS.has(map[1] as string)
      ? typeProblem(map[2] as string, known)
      : `keys a map by ${map[1]}. A map key must be string, int, uint or bool`;
  }

  return `is not a type that a check knows. Please write string, int, double, bool, bytes, dyn, list<…>, map<string, …> or a name under types`;
};

const namesIn = (hint: Hint, into: Set<string>): Set<string> => {
  if (typeof hint === 'string') {
    for (const found of hint.matchAll(/[A-Za-z][A-Za-z0-9]*/g)) {
      if (
        !PRIMITIVES.has(found[0]) &&
        found[0] !== 'list' &&
        found[0] !== 'map'
      ) {
        into.add(found[0]);
      }
    }
  } else {
    for (const each of Object.values(hint)) {
      namesIn(each, into);
    }
  }

  return into;
};

export const hintProblems = (
  shape: Shape,
  at: FieldPath,
  known: ReadonlySet<string>,
): { at: FieldPath; reason: string }[] =>
  Object.entries(shape).flatMap(([field, hint]) => {
    if (typeof hint !== 'string') {
      return hintProblems(hint, at.to(field), known);
    }

    const reason = typeProblem(hint, known);
    return reason ? [{ at: at.to(field), reason }] : [];
  });

export const orderedTypes = (
  types: Readonly<Record<string, Shape>>,
): { order: string[]; cycle: string | null } => {
  const order: string[] = [];
  const done = new Set<string>();
  const doing = new Set<string>();
  let cycle: string | null = null;

  const visit = (name: string): void => {
    if (done.has(name) || cycle) {
      return;
    }
    if (doing.has(name)) {
      cycle = name;
      return;
    }

    doing.add(name);
    for (const named of namesIn(types[name] as Shape, new Set())) {
      if (named in types) {
        visit(named);
      }
    }
    doing.delete(name);
    done.add(name);
    order.push(name);
  };

  for (const name of Object.keys(types)) {
    visit(name);
  }

  return { order, cycle };
};
