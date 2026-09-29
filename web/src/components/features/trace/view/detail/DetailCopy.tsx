import { CopyIcon } from '@/components/shared/CopyIcon';
import { useCopied } from '@/hooks/useCopied';

export function DetailCopy({ text, of }: { text: string; of: string }) {
  const { copied, copy } = useCopied();

  return (
    <button
      type="button"
      onClick={() => copy(text)}
      aria-label={copied ? `Copied ${of}` : `Copy ${of}`}
      className="rounded p-0.5 text-faint outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CopyIcon copied={copied} className="size-3" />
    </button>
  );
}
