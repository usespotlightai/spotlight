import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCopied } from '@/hooks/useCopied';

type CopyButtonProps = {
  value: string;
  label: string;
};

export function CopyButton({ value, label }: CopyButtonProps) {
  const { copied, copy } = useCopied();

  return (
    <Button
      variant="outline"
      size="sm"
      type="button"
      onClick={() => copy(value)}
      aria-label={label}
      className="shrink-0 bg-card"
    >
      <span
        key={copied ? 'copied' : 'copy'}
        className="flex animate-in items-center gap-1 duration-150 fade-in zoom-in-95 ease-out-quad"
      >
        {copied ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
        {copied ? 'Copied' : 'Copy'}
      </span>
    </Button>
  );
}
