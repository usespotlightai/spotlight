import { ViewPills } from '@/components/shared/ViewPills';
import type { ChangeStack } from '@/lib/change-stack';
import { repositoryOf } from '@/lib/stack-repository';

type StackRepositoryPillsProps = {
  stacks: readonly ChangeStack[];
  stack: ChangeStack;
  onChange: (repository: string) => void;
};

export function StackRepositoryPills({
  stacks,
  stack,
  onChange,
}: StackRepositoryPillsProps) {
  if (stacks.length <= 1) {
    return null;
  }

  return (
    <ViewPills
      views={stacks.map((each) => ({
        id: repositoryOf(each),
        label: repositoryOf(each),
      }))}
      current={repositoryOf(stack)}
      onChange={onChange}
    />
  );
}
