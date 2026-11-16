import { type SubmitEvent, useId, useState } from 'react';
import { useNavigate } from 'react-router';

import { AutoGrowTextarea } from '@/components/shared/form/AutoGrowTextarea';
import { RadioRow } from '@/components/shared/form/RadioRow';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTakeOverTask } from '@/hooks/api/useTakeover';
import type { TakeoverVerdict } from '@/lib/api';
import { messageOf } from '@/lib/error';
import { runPath } from '@/lib/run';
import { TAKEOVER_VERDICTS } from '@/lib/takeover';

type TakeOverDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug?: string;
  teamId: string;
  taskId: string;
  station: string;
  working: boolean;
};

export function TakeOverDialog({
  open,
  onOpenChange,
  slug,
  teamId,
  taskId,
  station,
  working,
}: TakeOverDialogProps) {
  const id = useId();
  const navigate = useNavigate();
  const takeOver = useTakeOverTask();
  const [verdict, setVerdict] = useState<TakeoverVerdict>('not-right');
  const [body, setBody] = useState('');
  const ready = body.trim().length > 0 && !takeOver.isPending;

  const submit = (event?: SubmitEvent) => {
    event?.preventDefault();

    if (!ready) {
      return;
    }

    takeOver.mutate(
      { teamId, taskId, verdict, body: body.trim() },
      {
        onSuccess: (task) => {
          onOpenChange(false);
          setBody('');

          const runId = task.takeover?.runId;

          if (slug && runId) {
            void navigate(runPath(slug, teamId, runId));
          }
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Take over at {station}</DialogTitle>
          <DialogDescription>
            The line stops on this task until you hand it back. You become the
            assignee. You tell the agent what to do, one turn at a time.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div
            role="radiogroup"
            aria-labelledby={`${id}-why`}
            className="-mx-2 flex flex-col"
          >
            <p
              id={`${id}-why`}
              className="px-2 pb-1 text-muted-foreground text-xs"
            >
              Why
            </p>
            {TAKEOVER_VERDICTS.map((each) => (
              <RadioRow
                key={each.value}
                name={`${id}-verdict`}
                value={each.value}
                checked={verdict === each.value}
                disabled={takeOver.isPending}
                description={each.description}
                onChange={() => setVerdict(each.value)}
              >
                {each.label}
              </RadioRow>
            ))}
          </div>

          <p id={`${id}-first`} className="-mb-3 text-muted-foreground text-xs">
            First message to the agent
          </p>
          <AutoGrowTextarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                submit();
              }
            }}
            placeholder="Tell the agent what to do first…"
            aria-labelledby={`${id}-first`}
            className="max-h-60 min-h-20 rounded-md border border-border px-3 py-2 text-foreground text-sm leading-5"
          />

          {working && (
            <p role="status" className="text-muted-foreground text-sm">
              {station} is working on this task now. Taking over stops that run.
            </p>
          )}

          {takeOver.isError && (
            <p role="alert" className="text-destructive text-sm">
              {messageOf(
                takeOver.error,
                'Sorry, Spotlight could not take over the task. Please try again.',
              )}
            </p>
          )}

          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!ready}>
              Take over
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
