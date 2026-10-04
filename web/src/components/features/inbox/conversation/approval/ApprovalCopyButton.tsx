import { CopyIcon } from '@/components/shared/CopyIcon';
import { IconAction } from '@/components/shared/IconAction';
import { useCopied } from '@/hooks/useCopied';
import { type Approval, copyText } from '@/lib/approval';

export function ApprovalCopyButton({ approval }: { approval: Approval }) {
  const { copied, copy } = useCopied();

  return (
    <IconAction
      label={copied ? 'Copied' : `Copy ${approval.name}`}
      tip={copied ? 'Copied' : 'Copy'}
      onClick={() => void copy(copyText(approval))}
    >
      <CopyIcon copied={copied} />
    </IconAction>
  );
}
