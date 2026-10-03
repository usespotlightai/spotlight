import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { CodeDiff } from '@/components/shared/CodeDiff';
import { type FileChange, type LineRange, repoRelative } from '@/lib/changes';
import type { JournalStep } from '@/lib/inbox';

export type Focus =
  | {
      readonly kind: 'file';
      readonly file: FileChange;
      readonly lines: LineRange | null;
    }
  | {
      readonly kind: 'step';
      readonly index: number;
      readonly step: JournalStep;
    };

type OutcomeFocusProps = {
  focus: Focus;
  onBack: () => void;
};

export function OutcomeFocus({ focus, onBack }: OutcomeFocusProps) {
  let shown: ReactNode;

  if (focus.kind === 'file') {
    shown = (
      <>
        <p className="truncate font-mono text-muted-foreground text-xs">
          {repoRelative(focus.file.path)}
        </p>
        <CodeDiff
          path={focus.file.path}
          before={focus.file.before}
          after={focus.file.after}
          lines={focus.lines}
        />
      </>
    );
  } else {
    shown = (
      <div
        data-slot="focused-step"
        className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2"
      >
        <span className="text-muted-foreground text-xs">
          Step {focus.index} · {focus.step.tool ?? focus.step.kind}
        </span>
        <p className="whitespace-pre-wrap break-words text-foreground text-xs leading-5">
          {focus.step.text}
        </p>
        {focus.step.detail && (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-muted-foreground text-xs leading-5">
            {focus.step.detail}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div data-slot="outcome-focus" className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 self-start rounded text-muted-foreground text-xs outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft aria-hidden className="size-3" />
        Back
      </button>
      {shown}
    </div>
  );
}
