import { useId, useState } from 'react';

import { FieldTextarea } from '@/components/shared/form/FieldTextarea';
import { Button } from '@/components/ui/button';
import {
  useClearRunVerdict,
  useRecordRunVerdict,
} from '@/hooks/api/useRunVerdict';
import { messageOf } from '@/lib/error';
import {
  MAX_VERDICT_REASON,
  type RunScores,
  VERDICT_CLEAR,
  VERDICT_QUESTION,
  VERDICT_REASON_LABEL,
  VERDICT_RIGHT,
  VERDICT_SAVE_REASON,
  VERDICT_WRONG,
  verdictTeachingNote,
} from '@/lib/judge';

type RunVerdictControlProps = {
  teamId: string;
  scores: RunScores;
};

export function RunVerdictControl({ teamId, scores }: RunVerdictControlProps) {
  const reasonId = useId();
  const recording = useRecordRunVerdict();
  const clearing = useClearRunVerdict();
  const verdict = scores.personVerdict;
  const saved = verdict?.reason ?? '';
  const [reason, setReason] = useState(saved);
  const [shownFor, setShownFor] = useState(saved);
  const pending = recording.isPending || clearing.isPending;
  const error = recording.error ?? clearing.error;
  const run = { teamId, runId: scores.runId };

  if (shownFor !== saved) {
    setShownFor(saved);
    setReason(saved);
  }

  const mark = (right: boolean, withReason: string | null = null) => {
    clearing.reset();
    recording.mutate({ ...run, right, reason: withReason });
  };

  return (
    <div data-slot="run-verdict-control" className="flex flex-col gap-2 pt-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">
          {VERDICT_QUESTION}
        </span>
        <Button
          type="button"
          size="xs"
          variant={verdict?.right === true ? 'secondary' : 'outline'}
          aria-pressed={verdict?.right === true}
          disabled={pending}
          onClick={() => mark(true)}
        >
          {VERDICT_RIGHT}
        </Button>
        <Button
          type="button"
          size="xs"
          variant={verdict?.right === false ? 'secondary' : 'outline'}
          aria-pressed={verdict?.right === false}
          disabled={pending}
          onClick={() => mark(false, reason.trim() || null)}
        >
          {VERDICT_WRONG}
        </Button>
        {verdict && (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              recording.reset();
              clearing.mutate(run);
            }}
          >
            {VERDICT_CLEAR}
          </Button>
        )}
      </div>

      {verdict?.right === false && (
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            mark(false, reason.trim() || null);
          }}
        >
          <label htmlFor={reasonId} className="text-muted-foreground text-xs">
            {VERDICT_REASON_LABEL}
          </label>
          <FieldTextarea
            id={reasonId}
            className="block"
            maxLength={MAX_VERDICT_REASON}
            disabled={pending}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {reason.trim() !== saved && (
            <Button
              type="submit"
              size="xs"
              variant="outline"
              className="self-start"
              disabled={pending}
            >
              {VERDICT_SAVE_REASON}
            </Button>
          )}
        </form>
      )}

      {error && (
        <p role="alert" className="text-destructive text-xs">
          {messageOf(error)}
        </p>
      )}

      <p
        data-slot="run-verdict-teaches"
        className="text-muted-foreground text-xs"
      >
        {verdictTeachingNote(scores.verdictTeaches)}
      </p>
    </div>
  );
}
