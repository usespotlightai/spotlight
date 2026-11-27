import { type ReactElement, type SubmitEvent, useId, useState } from 'react';

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
import { useResumeLine } from '@/hooks/api/useHold';
import { useStopRun } from '@/hooks/api/useStopRun';
import type { HoldEnd, StationResponseDto, HoldVerdict } from '@/lib/api';
import { messageOf } from '@/lib/error';
import {
  resumeAction,
  resumeChoices,
  resumeNotePrompt,
  resumedTo,
  HOLD_VERDICTS,
  heldBecause,
} from '@/lib/hold';
import { toast } from '@/lib/toast';

type ResumeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  taskId: string;
  station: StationResponseDto;
  moveOn: readonly StationResponseDto[];
  held: StationResponseDto | null;
  working: boolean;
  turn: string | null;
};

export function ResumeDialog({
  open,
  onOpenChange,
  teamId,
  taskId,
  station,
  moveOn,
  held,
  working,
  turn,
}: ResumeDialogProps): ReactElement {
  const id = useId();
  const resume = useResumeLine();
  const stop = useStopRun();
  const choices = resumeChoices(station, moveOn, held);
  const [chosen, setNext] = useState<HoldEnd>('continue');
  const next = choices.some((each) => each.value === chosen)
    ? chosen
    : 'continue';
  const [picked, setTo] = useState(moveOn[0]?.id ?? '');
  const to = moveOn.some((each) => each.id === picked)
    ? picked
    : (moveOn[0]?.id ?? '');
  const target = moveOn.find((each) => each.id === to);
  const [verdict, setVerdict] = useState<HoldVerdict>('not-right');
  const [changingWhy, setChangingWhy] = useState(false);
  const [summary, setSummary] = useState('');
  const ready =
    !working && !resume.isPending && (next !== 'move-on' || to !== '');

  const submit = (event?: SubmitEvent) => {
    event?.preventDefault();

    if (!ready) {
      return;
    }

    resume.mutate(
      {
        teamId,
        taskId,
        next,
        ...(next === 'move-on' ? { stationId: to } : {}),
        verdict,
        ...(summary.trim() ? { summary: summary.trim() } : {}),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.add({
            type: 'success',
            title: 'Line resumed',
            description: resumedTo(next, station, target, held),
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Resume the line</DialogTitle>
          <DialogDescription>
            Your changes stay in the workspace. Spotlight records them as the
            work of {station.name}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div
            role="radiogroup"
            aria-labelledby={`${id}-next`}
            className="-mx-2 flex flex-col"
          >
            <p
              id={`${id}-next`}
              className="px-2 pb-1 text-muted-foreground text-xs"
            >
              Next
            </p>
            {choices.map((each) => (
              <RadioRow
                key={each.value}
                name={`${id}-next`}
                value={each.value}
                checked={next === each.value}
                disabled={resume.isPending}
                description={each.description}
                onChange={() => setNext(each.value)}
              >
                {each.label}
              </RadioRow>
            ))}
          </div>

          {next === 'move-on' && moveOn.length > 1 && (
            <div
              role="radiogroup"
              aria-labelledby={`${id}-to`}
              className="-mx-2 flex flex-col"
            >
              <p
                id={`${id}-to`}
                className="px-2 pb-1 text-muted-foreground text-xs"
              >
                To
              </p>
              {moveOn.map((each) => (
                <RadioRow
                  compact
                  key={each.id}
                  name={`${id}-to`}
                  value={each.id}
                  checked={to === each.id}
                  disabled={resume.isPending}
                  onChange={() => setTo(each.id)}
                >
                  {each.name}
                </RadioRow>
              ))}
            </div>
          )}

          {changingWhy ? (
            <div
              role="radiogroup"
              aria-labelledby={`${id}-why`}
              className="-mx-2 flex flex-col"
            >
              <p
                id={`${id}-why`}
                className="px-2 pb-1 text-muted-foreground text-xs"
              >
                Why you put it on hold
              </p>
              {HOLD_VERDICTS.map((each) => (
                <RadioRow
                  compact
                  key={each.value}
                  name={`${id}-verdict`}
                  value={each.value}
                  checked={verdict === each.value}
                  disabled={resume.isPending}
                  onChange={() => setVerdict(each.value)}
                >
                  {each.label}
                </RadioRow>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              {heldBecause(verdict)}{' '}
              <button
                type="button"
                onClick={() => setChangingWhy(true)}
                className="underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:underline"
              >
                Change
              </button>
            </p>
          )}

          <AutoGrowTextarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                submit();
              }
            }}
            placeholder={resumeNotePrompt(next, station, target, held)}
            aria-label="Note"
            className="max-h-60 min-h-16 rounded-md border border-border px-3 py-2 text-foreground text-sm leading-5"
          />

          {working && (
            <div
              role="status"
              className="flex items-center justify-between gap-3 text-muted-foreground text-sm"
            >
              <p>
                A turn is in progress. You can resume the line when it ends.
              </p>
              {turn !== null && turn !== '' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={stop.isPending}
                  onClick={() => stop.mutate({ teamId, runId: turn })}
                >
                  Stop the turn
                </Button>
              )}
            </div>
          )}

          {resume.isError && (
            <p role="alert" className="text-destructive text-sm">
              {messageOf(
                resume.error,
                'Sorry, Spotlight could not resume the line. Please try again.',
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
              {resumeAction(next)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
