import { StationSection } from '@/components/features/stations/StationSection';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';

type StationPromptProps = {
  stationId: string;
  prompt: string | null | undefined;
};

export function StationPrompt({ stationId, prompt }: StationPromptProps) {
  return (
    <StationSection title="Prompt">
      {prompt ? (
        <MarkdownEditor
          key={stationId}
          initialValue={prompt}
          readOnly
          ariaLabel="Agent prompt"
          placeholder=""
          className="bg-card"
        />
      ) : (
        <p className="text-muted-foreground text-sm">No prompt.</p>
      )}
    </StationSection>
  );
}
