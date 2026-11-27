import { useSearchParams } from 'react-router';

import type { ChangeStackResponseDto } from '@/lib/api';
import { type ChangeStack, currentStacks } from '@/lib/change-stack';
import { repositoryOf } from '@/lib/stack-repository';

type StackInViewResult = {
  current: ChangeStackResponseDto[];
  stack: ChangeStackResponseDto | null;
  layerId: string | null;
  pick: (layerId: string) => void;
  switchTo: (named: string) => void;
};

export function useStackInView(
  stacks: readonly ChangeStack[],
): StackInViewResult {
  const [params, setParams] = useSearchParams();

  const current = currentStacks(stacks);
  const repository = params.get('repository');
  const stack =
    current.find((each) => repositoryOf(each) === repository) ??
    current.at(0) ??
    null;

  const pick = (layerId: string) =>
    setParams((now) => {
      const next = new URLSearchParams(now);
      next.set('layer', layerId);
      return next;
    });

  const switchTo = (named: string) =>
    setParams(new URLSearchParams({ repository: named }));

  return { current, stack, layerId: params.get('layer'), pick, switchTo };
}
