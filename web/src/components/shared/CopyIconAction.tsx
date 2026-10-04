import { CopyIcon } from '@/components/shared/CopyIcon';
import { IconAction } from '@/components/shared/IconAction';
import { useCopied } from '@/hooks/useCopied';

type CopyIconActionProps = {
  text: string;
  label: string;
};

export function CopyIconAction({ text, label }: CopyIconActionProps) {
  const { copied, copy } = useCopied();

  return (
    <IconAction
      label={copied ? 'Copied' : label}
      tip={copied ? 'Copied' : 'Copy'}
      onClick={() => void copy(text)}
    >
      <CopyIcon copied={copied} />
    </IconAction>
  );
}
