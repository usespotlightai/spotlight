import { Button } from '@/components/ui/button';
import {
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  describeOutcomes,
  type InviteOutcome,
  OUTCOME_LABELS,
} from '@/lib/members';
import { cn } from '@/lib/utils';

type InviteOutcomesProps = {
  outcomes: readonly InviteOutcome[];
};

export function InviteOutcomes({ outcomes }: InviteOutcomesProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{describeOutcomes(outcomes)}</DialogTitle>
      </DialogHeader>

      <div role="status">
        <ul
          aria-label="What happened to each address"
          className="flex flex-col"
        >
          {outcomes.map((each) => (
            <li
              key={each.email}
              className="flex min-h-8 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1 text-sm"
            >
              <span className="min-w-0 break-all text-foreground">
                {each.email}
              </span>
              <span
                className={cn(
                  'min-w-0',
                  each.outcome === 'not-sent'
                    ? 'text-destructive'
                    : 'text-muted-foreground',
                )}
              >
                {OUTCOME_LABELS[each.outcome]}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <DialogFooter>
        <DialogClose render={<Button size="sm" autoFocus />}>Done</DialogClose>
      </DialogFooter>
    </>
  );
}
