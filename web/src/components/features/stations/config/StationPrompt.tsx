import { Instrument } from '@/components/features/stations/config/Instrument';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { OverflowFade } from '@/components/shared/OverflowFade';

type StationPromptProps = {
  stationId: string;
  prompt: string | null | undefined;
};

export function StationPrompt({ stationId, prompt }: StationPromptProps) {
  return (
    <Instrument title="Prompt">
      {prompt ? (
        <OverflowFade slot="prompt-text" className="max-h-60">
          <MarkdownEditor
            key={stationId}
            initialValue={prompt}
            readOnly
            ariaLabel="Agent prompt"
            placeholder=""
            className="border-0 bg-transparent p-0"
          />
        </OverflowFade>
      ) : (
        <p className="text-muted-foreground text-xs leading-5">No prompt.</p>
      )}
    </Instrument>
  );
}
