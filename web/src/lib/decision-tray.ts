import { createContext, type ReactNode } from 'react';

export type DockedDecision = {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly group: string;
  readonly content: ReactNode;
};

export type DecisionTray = {
  readonly decisions: readonly DockedDecision[];
  readonly shown: DockedDecision | null;
  readonly open: boolean;
  readonly cover: number;
  readonly measure: (cover: number) => void;
  readonly show: (id: string) => void;
  readonly collapse: () => void;
  readonly step: (by: 1 | -1) => void;
};

export type Docked = {
  readonly controls: HTMLElement | null;
  readonly active: boolean;
};

export const DecisionTrayContext = createContext<DecisionTray | null>(null);

export const DockedContext = createContext<Docked | null>(null);

export const dockedIn = (
  tray: DecisionTray | null,
  id: string,
): DockedDecision | null =>
  tray?.decisions.find((decision) => decision.id === id) ?? null;

export const dockedRuns = (
  tray: DecisionTray | null,
  ids: readonly string[],
): ReadonlyMap<string, number> => {
  const runs = new Map<string, number>();
  let first: DockedDecision | null = null;
  let length = 0;

  for (const id of ids) {
    const docked = dockedIn(tray, id);

    if (!docked) {
      first = null;
      continue;
    }

    if (first === null || first.group !== docked.group) {
      first = docked;
      length = 0;
    } else {
      runs.set(id, 0);
    }

    length += 1;
    runs.set(first.id, length);
  }

  return runs;
};

export const decisionGroups = (
  decisions: readonly DockedDecision[],
): readonly (readonly DockedDecision[])[] => {
  const groups = new Map<string, DockedDecision[]>();

  for (const decision of decisions) {
    groups.set(decision.group, [
      ...(groups.get(decision.group) ?? []),
      decision,
    ]);
  }

  return [...groups.values()];
};

export const pillLabel = (decisions: readonly DockedDecision[]): string =>
  decisions.length === 1 ? decisions[0].kind : decisions[0].group;
