import { Button } from '@/components/ui/button';
import {
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { type InviteOutcome, OUTCOME_LABELS } from '@/lib/members';
import { cn } from '@/lib/utils';

type InviteOutcomesProps = {
  outcomes: readonly InviteOutcome[];
};

export function InviteOutcomes({ outcomes }: InviteOutcomesProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Invites sent</DialogTitle>
      </DialogHeader>

      <ul aria-label="What happened to each address" className="flex flex-col">
        {outcomes.map((each) => (
          <li
            key={each.email}
            className="flex min-h-8 items-center justify-between gap-3 text-sm"
          >
            <span className="min-w-0 truncate text-foreground">
              {each.email}
            </span>
            <span
              className={cn(
                'shrink-0',
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

      <DialogFooter>
        <DialogClose render={<Button size="sm" />}>Done</DialogClose>
      </DialogFooter>
    </>
  );
}
