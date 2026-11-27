import { AuthoredText } from '@/components/features/stations/config/AuthoredText';
import { TabSection } from '@/components/features/stations/TabSection';
import { ExpandableText } from '@/components/shared/ExpandableText';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { nonEmpty } from '@/lib/non-empty';

type PromptSectionProps = {
  stationId: string;
  prompt: string | null | undefined;
};

export function PromptSection({ stationId, prompt }: PromptSectionProps) {
  return (
    <TabSection title="Prompt">
      {nonEmpty(prompt) ? (
        <AuthoredText>
          <ExpandableText what="prompt" size="tall">
            <MarkdownEditor
              key={stationId}
              initialValue={prompt}
              readOnly
              ariaLabel="Agent prompt"
              placeholder=""
              className="border-0 bg-transparent p-0"
            />
          </ExpandableText>
        </AuthoredText>
      ) : (
        <p className="text-muted-foreground text-sm">No prompt.</p>
      )}
    </TabSection>
  );
}
