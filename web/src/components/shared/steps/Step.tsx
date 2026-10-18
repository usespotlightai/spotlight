import { type ReactNode, useId } from 'react';
import { Collapsible } from '@/components/shared/Collapsible';

type StepProps = {
  title: string;
  id?: string;
  description?: string;
  open?: boolean;
  onOpen?: () => void;
  children?: ReactNode;
};

export function Step({
  title,
  id,
  description,
  open = true,
  onOpen,
  children,
}: StepProps) {
  const contentId = useId();

  return (
    <li
      id={id}
      className="relative flex scroll-mt-4 gap-3 pb-6 [counter-increment:step] before:flex before:size-5 before:shrink-0 before:items-center before:justify-center before:rounded-full before:bg-muted before:font-medium before:text-muted-foreground before:text-xs before:tabular-nums before:content-[counter(step)] after:absolute after:top-6 after:bottom-1 after:left-2.5 after:w-px after:bg-border last:pb-0 last:after:hidden"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-medium text-foreground text-sm leading-5">
          {onOpen ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={contentId}
              onClick={() => !open && onOpen()}
              className="text-left outline-none transition-opacity hover:opacity-70 focus-visible:underline aria-expanded:hover:opacity-100"
            >
              {title}
            </button>
          ) : (
            title
          )}
        </h3>

        <Collapsible open={open} appear={false}>
          <div id={contentId} className="flex flex-col gap-2 pt-1">
            {description && (
              <p className="text-muted-foreground text-xs">{description}</p>
            )}
            {children}
          </div>
        </Collapsible>
      </div>
    </li>
  );
}
