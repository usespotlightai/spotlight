import { useState } from 'react';
import { AutoGrowTextarea } from '@/components/shared/form/AutoGrowTextarea';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useSubmitReview } from '@/hooks/api/useSubmitReview';
import { drafts, type ReviewVerdict, VERDICTS } from '@/lib/review';
import { useReviewing } from '@/lib/review-context';
import { cn } from '@/lib/utils';

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
      { teamId: reviewing.teamId, runId: reviewing.runId, verdict, body },
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
            Finish review
            {pending > 0 && (
              <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[11px] tabular-nums">
                {pending}
              </span>
            )}
          </Button>
        }
      />

      <PopoverContent align="end" className="flex w-96 flex-col gap-3 p-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-medium text-foreground text-sm">
            Finish your review
          </h2>
          <p className="text-muted-foreground text-xs">
            {reviewing.review?.pullRequest
              ? `Spotlight posts ${pending} ${pending === 1 ? 'comment' : 'comments'} to the pull request.`
              : `When the task opens its pull request, Spotlight posts ${pending} ${pending === 1 ? 'comment' : 'comments'}.`}
          </p>
        </div>

        <AutoGrowTextarea
          aria-label="Review summary"
          placeholder="Leave a summary (optional)"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="max-h-48 min-h-16 rounded-md border-[0.5px] border-border bg-background px-2 py-1.5 text-sm leading-5"
        />

        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">Verdict</legend>
          {VERDICTS.map((each) => (
            <label
              key={each.id}
              className={cn(
                'flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted',
                verdict === each.id && 'bg-muted',
              )}
            >
              <input
                type="radio"
                name="verdict"
                value={each.id}
                checked={verdict === each.id}
                onChange={() => setVerdict(each.id)}
                className="mt-1"
              />
              <span className="flex flex-col">
                <span className="text-foreground text-sm">{each.label}</span>
                <span className="text-muted-foreground text-xs">
                  {each.description}
                </span>
              </span>
            </label>
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
