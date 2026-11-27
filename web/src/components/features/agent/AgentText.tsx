import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { useRevealedText } from '@/hooks/useRevealedText';

export function AgentText({ text }: { text: string }) {
  const shown = useRevealedText(text);

  return (
    <MarkdownEditor
      readOnly
      initialValue={shown}
      placeholder=""
      ariaLabel="Agent message"
      className="border-none bg-transparent p-0"
    />
  );
}
