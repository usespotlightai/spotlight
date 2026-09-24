import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { FieldInput } from '@/components/shared/form/FieldInput';
import { Button } from '@/components/ui/button';
import type { InboxApprovalResponseDto } from '@/lib/api';

type ApprovalDecisionProps = {
  approval: InboxApprovalResponseDto;
  pending: boolean;
  onDecide?: (approve: boolean, said: string) => void;
};

const SETTLED: Record<string, string> = {
  granted: 'You approved this.',
  refused: 'You rejected this.',
};

export function ApprovalDecision({
  approval,
  pending,
  onDecide,
}: ApprovalDecisionProps) {
  const [said, setSaid] = useState('');
  const settled = SETTLED[approval.standing];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-3 py-3">
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <ShieldAlert
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
          <p className="min-w-0 font-medium text-foreground text-sm leading-5">
            {approval.name} needs your approval
          </p>
        </div>
        <p className="pl-6 text-muted-foreground text-xs leading-5">
          {approval.because}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {approval.inputs.length > 0 && (
          <dl className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/60 px-3 py-2">
            {approval.inputs.map((input) => (
              <div key={input.name} className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs first-letter:uppercase">
                  {input.name}
                </dt>
                <dd className="whitespace-pre-wrap break-words text-foreground text-xs leading-5">
                  {input.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {settled ? (
          <p className="text-muted-foreground text-sm leading-6">{settled}</p>
        ) : !onDecide ? (
          <p className="text-muted-foreground text-sm leading-6">
            Waiting on a decision in the inbox.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <FieldInput
              value={said}
              disabled={pending}
              onChange={(event) => setSaid(event.target.value)}
              placeholder="Reasoning"
              className="rounded-lg border border-border bg-muted/60"
              aria-label={`What to say about ${approval.name}`}
            />

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() => onDecide(true, said)}
                aria-label={`Approve ${approval.name}`}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onDecide(false, said)}
                aria-label={`Reject ${approval.name}`}
              >
                Reject
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
