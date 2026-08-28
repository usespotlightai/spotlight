import { MarkdownEditor } from '@/components/common/form/MarkdownEditor';

type AgentPromptFieldProps = {
  value: string;
  onChange: (prompt: string) => void;
  onBlur: () => void;
};

export function AgentPromptField({
  value,
  onChange,
  onBlur,
}: AgentPromptFieldProps) {
  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-baseline gap-2">
        <h2 className="font-medium text-foreground text-sm">Agent prompt</h2>
      </header>

      <MarkdownEditor
        initialValue={value}
        onChange={(markdown) => {
          if (markdown !== value) {
            onChange(markdown);
          }
        }}
        onBlur={onBlur}
        ariaLabel="Agent prompt"
        placeholder="This is the base prompt the agent will use"
        className="min-h-48"
      />
    </section>
  );
}
``;
