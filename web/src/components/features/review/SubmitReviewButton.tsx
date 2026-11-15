import { useState } from 'react';

import { FieldTextarea } from '@/components/shared/form/FieldTextarea';
import { RadioRow } from '@/components/shared/form/RadioRow';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useSubmitReview } from '@/hooks/api/useSubmitReview';
import {
  drafts,
  type PullRequestRoute,
  type ReviewVerdict,
  routeOf,
  VERDICTS,
} from '@/lib/review';
import { useReviewing } from '@/lib/review-context';

const LANDS_ON: Record<PullRequestRoute, (comments: string) => string> = {
  routed: (comments) => `Spotlight posts ${comments} to the pull request.`,
  waiting: (comments) =>
    `When the task opens its pull request, Spotlight posts ${comments}.`,
  ambiguous: () =>
    'The task has more than one pull request. The review names no repository.',
};

export function SubmitReviewButton() {
  const reviewing = useReviewing();
  const [open, setOpen] = useState(false);
  const [verdict, setVerdict] = useState<ReviewVerdict>('comment');
  const [body, setBody] = useState('');
  const submit = useSubmitReview();

  if (!reviewing) {
    return null;
  }

  const pending = drafts(reviewing.review);
  const written = body.trim().length > 0 || pending > 0;
  const ready = !submit.isPending && (verdict === 'approve' || written);

  const send = () =>
    submit.mutate(
      {
        teamId: reviewing.teamId,
        runId: reviewing.runId,
        repository: reviewing.repository,
        verdict,
        body,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setBody('');
          setVerdict('comment');
        },
      },
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button size="sm" className="rounded-full">
            <span>
              Finish <span className="@max-2xl/pane:sr-only">review</span>
            </span>
            {pending > 0 && (
              <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[11px] tabular-nums">
                {pending}
              </span>
            )}
          </Button>
        }
      />

      <PopoverContent
        align="end"
        className="flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 p-3"
      >
        <div className="flex flex-col gap-0.5">
          <h2 className="font-medium text-foreground text-sm">
            Finish your review
          </h2>
          <p className="text-muted-foreground text-xs">
            {LANDS_ON[routeOf(reviewing.review, reviewing.repository)](
              `${pending} ${pending === 1 ? 'comment' : 'comments'}`,
            )}
          </p>
        </div>

        <FieldTextarea
          aria-label="Review summary"
          placeholder="Leave a summary (optional)"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />

        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">Verdict</legend>
          {VERDICTS.map((each) => (
            <RadioRow
              key={each.id}
              name="verdict"
              value={each.id}
              checked={verdict === each.id}
              onChange={() => setVerdict(each.id)}
              description={each.description}
            >
              {each.label}
            </RadioRow>
          ))}
        </fieldset>

        <div className="flex items-center justify-end gap-2">
          <Button size="sm" disabled={!ready} onClick={send}>
            Submit review
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
