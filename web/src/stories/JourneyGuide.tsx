import { type ReactNode, useState } from 'react';

import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';

type JourneyStep = {
  readonly story: string;
  readonly title: string;
};

type JourneyGuideProps = {
  journey: string;
  steps: readonly JourneyStep[];
  at: number;
  children: ReactNode;
};

const HIDDEN_KEY = 'storybook.journey-guide-hidden';

const storyHref = (story: string) => `./?path=/story/${story}`;

const storedHidden = () => {
  try {
    return sessionStorage.getItem(HIDDEN_KEY) === 'true';
  } catch {
    return false;
  }
};

const storeHidden = (hidden: boolean) => {
  try {
    sessionStorage.setItem(HIDDEN_KEY, String(hidden));
  } catch {}
};

export function JourneyGuide({
  journey,
  steps,
  at,
  children,
}: JourneyGuideProps) {
  const [hidden, setHidden] = useState(storedHidden);
  const step = steps[at];
  const back = steps[at - 1];
  const next = steps[at + 1];
  const hide = (value: boolean) => {
    storeHidden(value);
    setHidden(value);
  };

  if (!step) {
    return null;
  }

  const count = `Step ${at + 1} of ${steps.length}`;

  if (hidden) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => hide(false)}
        className="fixed right-4 bottom-4 z-[100] bg-popover shadow-lg"
      >
        {count}
      </Button>
    );
  }

  return (
    <aside
      aria-label="Journey guide"
      className="fixed right-4 bottom-4 z-[100] flex w-80 flex-col gap-3 rounded-lg border border-border bg-popover p-4 text-popover-foreground text-sm shadow-lg"
    >
      <div className="flex items-baseline justify-between gap-2 text-muted-foreground text-xs">
        <span className="truncate">{journey}</span>
        <span className="shrink-0 tabular-nums">{count}</span>
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-foreground">{step.title}</h2>
        <div className="flex flex-col gap-2 text-muted-foreground leading-5">
          {children}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => hide(true)}>
          Hide
        </Button>
        <span className="flex-1" />
        {back && (
          <a
            href={storyHref(back.story)}
            target="_top"
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            Back
          </a>
        )}
        {next && (
          <a
            href={storyHref(next.story)}
            target="_top"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Next
          </a>
        )}
      </div>
    </aside>
  );
}
