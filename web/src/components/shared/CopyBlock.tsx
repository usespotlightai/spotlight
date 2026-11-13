import { useEffect, useRef } from 'react';

import { CodeBlock } from '@/components/shared/CodeBlock';
import { CopyIcon } from '@/components/shared/CopyIcon';
import { Button } from '@/components/ui/button';
import { useCopied } from '@/hooks/useCopied';

type CopyBlockProps = {
  text: string;
  label: string;
  focused?: boolean;
  onCopy?: () => void;
};

export function CopyBlock({ text, label, focused, onCopy }: CopyBlockProps) {
  const { copied, copy } = useCopied();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focused) {
      button.current?.focus();
    }
  }, [focused]);

  return (
    <CodeBlock
      command={text}
      className="pr-1"
      trailing={
        <Button
          ref={button}
          variant="ghost"
          size="icon-xs"
          aria-label={copied ? 'Copied' : label}
          title={label}
          className="m-1.5 text-muted-foreground"
          onClick={() => {
            void copy(text);
            onCopy?.();
          }}
        >
          <CopyIcon copied={copied} />
        </Button>
      }
    />
  );
}
