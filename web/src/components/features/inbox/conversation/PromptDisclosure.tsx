import { useState } from 'react';

import { Collapsible } from '@/components/shared/Collapsible';
import { DisclosureToggle } from '@/components/shared/DisclosureToggle';
import { FadingScroll } from '@/components/shared/FadingScroll';

export function PromptDisclosure({ prompt }: { prompt: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="py-1.5">
      <DisclosureToggle
        open={open}
        onToggle={() => setOpen(!open)}
        className="pointer-coarse:min-h-8"
      >
        Prompt
      </DisclosureToggle>

      <Collapsible open={open} appear={false} lazy>
        <FadingScroll className="max-h-[min(18rem,50dvh)]">
          <p className="whitespace-pre-wrap break-words pt-1 pl-4.5 text-muted-foreground text-xs leading-5">
            {prompt}
          </p>
        </FadingScroll>
      </Collapsible>
    </div>
  );
}
