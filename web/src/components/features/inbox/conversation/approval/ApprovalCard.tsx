import { useState } from 'react';
import { ApprovalAction } from '@/components/features/inbox/conversation/approval/ApprovalAction';
import { ApprovalControls } from '@/components/features/inbox/conversation/approval/ApprovalControls';
import { ApprovalFields } from '@/components/features/inbox/conversation/approval/ApprovalFields';
import { ApprovalHeader } from '@/components/features/inbox/conversation/approval/ApprovalHeader';
import { DecisionCard } from '@/components/shared/DecisionCard';
import {
  type Approval,
  type ApprovalAnswer,
  type ApprovalMode,
  approvedOnlyBy,
  askedFor,
  blanked,
  differs,
} from '@/lib/approval';

type ApprovalCardProps = {
  approval: Approval;
  viewerId?: string | null;
  pending: boolean;
  onDecide?: (answer: ApprovalAnswer) => void;
};

export function ApprovalCard({
  approval,
  viewerId = null,
  pending,
  onDecide,
}: ApprovalCardProps) {
  const [mode, setMode] = useState<ApprovalMode>('viewing');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const deciding = approval.status === 'asked' ? onDecide : undefined;
  const changed = differs(approval.inputs, edits);
  const onlyFor = approvedOnlyBy(approval, viewerId);

  const toMode = (next: ApprovalMode) => {
    if (next === 'viewing') {
      setEdits({});
      setReason('');
    }
    setMode(next);
  };

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
          onEdit={deciding && !onlyFor ? () => setMode('editing') : undefined}
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

        <ApprovalControls
          approval={approval}
          mode={mode}
          pending={pending}
          onlyFor={onlyFor}
          blank={blanked(approval.inputs, edits)}
          reason={reason}
          onReason={setReason}
          onMode={toMode}
          onApproveEdited={approveEdited}
          onDecide={deciding}
        />
      </DecisionCard>
    </div>
  );
}
