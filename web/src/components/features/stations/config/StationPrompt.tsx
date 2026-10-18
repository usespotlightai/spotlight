import { useRef } from 'react';
import { ConfigCard } from '@/components/features/stations/config/ConfigCard';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { useOverflows } from '@/hooks/useOverflows';
import { cn } from '@/lib/utils';

type StationPromptProps = {
  stationId: string;
  prompt: string | null | undefined;
};

export function StationPrompt({ stationId, prompt }: StationPromptProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const scrolls = useOverflows(scroller, Boolean(prompt));

  return (
    <ConfigCard title="Prompt">
      {prompt ? (
        <div className="relative">
          <div
            ref={scroller}
            data-slot="prompt-text"
            className={cn(
              '-mr-3 max-h-60 overflow-y-auto overscroll-contain pr-3',
              scrolls && 'pb-12',
            )}
          >
            <MarkdownEditor
              key={stationId}
              initialValue={prompt}
              readOnly
              ariaLabel="Agent prompt"
              placeholder=""
              className="border-0 bg-transparent p-0"
            />
          </div>
          {scrolls && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-transparent to-card"
            />
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs leading-5">No prompt.</p>
      )}
    </ConfigCard>
  );
}
