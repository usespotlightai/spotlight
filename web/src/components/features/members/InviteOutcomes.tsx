import { Button } from '@/components/ui/button';
import {
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  type InviteOutcome,
  OUTCOME_LABELS,
  outcomesTold,
} from '@/lib/members';
import { cn } from '@/lib/utils';

type InviteOutcomesProps = {
  outcomes: readonly InviteOutcome[];
};

export function InviteOutcomes({ outcomes }: InviteOutcomesProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{outcomesTold(outcomes)}</DialogTitle>
      </DialogHeader>

      <div role="status">
        <ul
          aria-label="What happened to each address"
          className="flex flex-col"
        >
          {outcomes.map((each) => (
            <li
              key={each.email}
              className="flex min-h-8 items-center justify-between gap-3 py-1 text-sm"
            >
              <span className="min-w-0 truncate text-foreground">
                {each.email}
              </span>
              <span
                className={cn(
                  'min-w-0 text-right',
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
