import { ChoiceCard } from '@/components/shared/form/ChoiceCard';
import type { ReplaySet } from '@/lib/replay';
import { setProblemOf, tasksIn } from '@/lib/search';

type SetChoiceProps = {
  set: ReplaySet;
  checked: boolean;
  disabled: boolean;
  onChange: (setId: string) => void;
};

export function SetChoice({
  set,
  checked,
  disabled,
  onChange,
}: SetChoiceProps) {
  const problem = setProblemOf(set);
  const tasks = tasksIn(set);

  return (
    <ChoiceCard
      group="set"
      value={set.id}
      checked={checked}
      disabled={disabled || problem !== null}
      onChange={onChange}
      note={problem}
    >
      <span className="min-w-0 truncate text-foreground">{set.name}</span>
      <span className="ml-auto shrink-0 text-muted-foreground text-xs tabular-nums">
        {tasks === 1 ? '1 task' : `${tasks} tasks`}
      </span>
    </ChoiceCard>
  );
}
