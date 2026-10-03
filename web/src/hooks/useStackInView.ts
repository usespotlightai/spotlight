import { useSearchParams } from 'react-router';
import { type ChangeStack, currentStacks } from '@/lib/change-stack';
import { repositoryOf } from '@/lib/stack-repository';

export function useStackInView(stacks: readonly ChangeStack[]) {
  const [params, setParams] = useSearchParams();

  const current = currentStacks(stacks);
  const repository = params.get('repository');
  const stack =
    current.find((each) => repositoryOf(each) === repository) ??
    current[0] ??
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
