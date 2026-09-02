import { Check, Copy } from 'lucide-react';
import { useCopied } from '@/hooks/useCopied';

export function DetailCopy({ text, of }: { text: string; of: string }) {
  const { copied, copy } = useCopied();
  const Icon = copied ? Check : Copy;

  return (
    <button
      type="button"
      onClick={() => copy(text)}
      aria-label={copied ? `Copied ${of}` : `Copy ${of}`}
      className="rounded p-0.5 text-faint outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="size-3" aria-hidden />
    </button>
  );
}
