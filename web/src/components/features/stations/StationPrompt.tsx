import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';

type StationPromptProps = {
  stationId: string;
  prompt: string | null | undefined;
};

export function StationPrompt({ stationId, prompt }: StationPromptProps) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium text-foreground text-sm">Agent prompt</h2>

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
        <p className="text-muted-foreground text-sm">No agent prompt.</p>
      )}
    </section>
  );
}
