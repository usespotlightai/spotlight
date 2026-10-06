import { useState } from 'react';
import { ApprovalAction } from '@/components/features/inbox/conversation/approval/ApprovalAction';
import { ApprovalDecision } from '@/components/features/inbox/conversation/approval/ApprovalDecision';
import { ApprovalEditControls } from '@/components/features/inbox/conversation/approval/ApprovalEditControls';
import { ApprovalFields } from '@/components/features/inbox/conversation/approval/ApprovalFields';
import { ApprovalHeader } from '@/components/features/inbox/conversation/approval/ApprovalHeader';
import { ApprovalRefusal } from '@/components/features/inbox/conversation/approval/ApprovalRefusal';
import { DecisionCard } from '@/components/shared/DecisionCard';
import {
  type Approval,
  type ApprovalAnswer,
  askedFor,
  blanked,
  differs,
} from '@/lib/approval';

type Mode = 'viewing' | 'editing' | 'refusing';

type ApprovalCardProps = {
  approval: Approval;
  pending: boolean;
  onDecide?: (answer: ApprovalAnswer) => void;
};

export function ApprovalCard({
  approval,
  pending,
  onDecide,
}: ApprovalCardProps) {
  const [mode, setMode] = useState<Mode>('viewing');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const deciding = approval.standing === 'asked' ? onDecide : undefined;
  const changed = differs(approval.inputs, edits);

  const approveEdited = () =>
    deciding?.({
      approve: true,
      said: '',
      inputs: changed
        ? approval.inputs.map((input) => ({
            name: input.name,
            value: edits[input.name] ?? input.value,
          }))
        : undefined,
    });

  return (
    <div className="flex flex-col gap-2">
      <p className="text-foreground text-sm leading-6">{askedFor(approval)}</p>

      <DecisionCard aria-label={approval.name}>
        <ApprovalHeader
          approval={approval}
          pending={pending}
          acting={!deciding || mode === 'viewing'}
          onEdit={deciding && (() => setMode('editing'))}
        />

        {deciding && mode === 'editing' ? (
          <ApprovalFields
            approval={approval}
            edits={edits}
            disabled={pending}
            onEdit={(name, value) =>
              setEdits((was) => ({ ...was, [name]: value }))
            }
          />
        ) : (
          <ApprovalAction approval={approval} />
        )}

        {!deciding ? (
          <ApprovalDecision approval={approval} pending={false} />
        ) : mode === 'editing' ? (
          <ApprovalEditControls
            approval={approval}
            pending={pending}
            blank={blanked(approval.inputs, edits)}
            onApprove={approveEdited}
            onCancel={() => {
              setEdits({});
              setMode('viewing');
            }}
          />
        ) : mode === 'refusing' ? (
          <ApprovalRefusal
            approval={approval}
            pending={pending}
            reason={reason}
            onReason={setReason}
            onRefuse={() => deciding({ approve: false, said: reason })}
            onCancel={() => {
              setReason('');
              setMode('viewing');
            }}
          />
        ) : (
          <ApprovalDecision
            approval={approval}
            pending={pending}
            onApprove={() => deciding({ approve: true, said: '' })}
            onDismiss={() => setMode('refusing')}
          />
        )}
      </DecisionCard>
    </div>
  );
}
