import { useCommands } from '@/hooks/useCommands';
import { useFocusWithin } from '@/hooks/useFocusWithin';
import type { ApprovalMode } from '@/lib/approval';

type ApproveKey = {
  mode: ApprovalMode;
  ready: boolean;
  blank: boolean;
  onlyFor: string | null;
  onApprove: () => void;
  onApproveEdited: () => void;
};

const approvalOf = ({
  mode,
  ready,
  blank,
  onlyFor,
  onApprove,
  onApproveEdited,
}: ApproveKey): (() => void) | null => {
  if (!ready) {
    return null;
  }
  if (mode === 'editing') {
    return blank ? null : onApproveEdited;
  }

  return mode === 'viewing' && !onlyFor ? onApprove : null;
};

export function useApproveKey(key: ApproveKey) {
  const { focused, handlers } = useFocusWithin();
  const approve = approvalOf(key);

  const keyed = focused && approve !== null;

  useCommands(
    keyed && approve ? [{ id: 'approval.approve', run: approve }] : [],
  );

  return { handlers, keyed };
}
