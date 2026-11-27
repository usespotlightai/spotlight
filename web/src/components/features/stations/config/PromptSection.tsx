import type { ReactElement } from 'react';

import { AuthoredText } from '@/components/features/stations/config/AuthoredText';
import { TabSection } from '@/components/features/stations/TabSection';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';

type PromptSectionProps = {
  stationId: string;
  prompt: string | null | undefined;
};

export function PromptSection({
  stationId,
  prompt,
}: PromptSectionProps): ReactElement {
  return (
    <TabSection title="Prompt">
      {prompt !== null && prompt !== undefined && prompt !== '' ? (
        <AuthoredText>
          <MarkdownEditor
            key={stationId}
            initialValue={prompt}
            readOnly
            ariaLabel="Agent prompt"
            placeholder=""
            className="border-0 bg-transparent p-0"
          />
        </AuthoredText>
      ) : (
        <p className="text-muted-foreground text-sm">No prompt.</p>
      )}
    </TabSection>
  );
}
