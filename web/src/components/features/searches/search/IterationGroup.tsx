import type { ReactNode } from 'react';
import { IterationReflection } from '@/components/features/searches/search/IterationReflection';
import { IterationRow } from '@/components/features/searches/search/IterationRow';
import { NothingProposed } from '@/components/features/searches/search/NothingProposed';
import type { ReplayedStation } from '@/lib/replay';
import type { IterationGroup as Group } from '@/lib/search';

type IterationGroupProps = {
  at: ReplayedStation;
  group: Group;
  children: ReactNode;
};

export function IterationGroup({ at, group, children }: IterationGroupProps) {
  const { iteration, candidates } = group;

  return (
    <>
      <IterationRow
        at={at}
        title={`Iteration ${group.number}`}
        iteration={iteration}
      />
      {iteration?.kind === 'reflect' ? (
        <IterationReflection iteration={iteration} />
      ) : candidates.length > 0 ? (
        children
      ) : (
        <NothingProposed iteration={iteration} />
      )}
    </>
  );
}
