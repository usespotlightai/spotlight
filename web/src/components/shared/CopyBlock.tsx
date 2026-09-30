import { useEffect, useRef } from 'react';
import { CodeBlock } from '@/components/shared/CodeBlock';
import { CopyIcon } from '@/components/shared/CopyIcon';
import { Button } from '@/components/ui/button';
import { useCopied } from '@/hooks/useCopied';

type CopyBlockProps = {
  text: string;
  label: string;
  focused?: boolean;
};

export function CopyBlock({ text, label, focused }: CopyBlockProps) {
  const { copied, copy } = useCopied();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focused) {
      button.current?.focus();
    }
  }, [focused]);

  return (
    <div className="flex flex-col items-start gap-2">
      <CodeBlock command={text} className="w-full" />

      <Button
        ref={button}
        variant="outline"
        size="sm"
        onClick={() => copy(text)}
      >
        <CopyIcon copied={copied} />
        {copied ? 'Copied' : label}
      </Button>
    </div>
  );
}
