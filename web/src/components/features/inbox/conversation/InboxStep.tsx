import { ExpandableStep } from '@/components/features/inbox/conversation/ExpandableStep';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import type { JournalStep } from '@/lib/inbox';
import { useStepAnchors } from '@/lib/step-anchors';
import { cn } from '@/lib/utils';

type InboxStepProps = {
  step: JournalStep;
  live?: boolean;
};

export function InboxStep({ step, live = false }: InboxStepProps) {
  const anchors = useStepAnchors();
  const anchor = anchors.anchorOf(step);
  const focused = anchor !== null && anchors.focused === anchor;

  const place = {
    id: anchor ?? undefined,
    'data-focused': focused || undefined,
    className: cn('scroll-mt-16 rounded-md', focused && 'bg-accent/60'),
  };

  if (step.kind === 'message') {
    return (
      <li {...place} className={cn(place.className, 'px-1 py-0.5')}>
        <MarkdownEditor
          readOnly
          initialValue={step.text}
          placeholder=""
          ariaLabel="Agent message"
          className="border-none bg-transparent p-0"
        />
      </li>
    );
  }

  return (
    <li {...place}>
      <ExpandableStep step={step} live={live} focused={focused} />
    </li>
  );
}
