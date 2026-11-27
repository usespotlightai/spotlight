import type { ChangeStack } from '@/lib/change-stack';

export function StackNavRemoved({ stack }: { stack: ChangeStack }) {
  if (stack.removed.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Removed since the previous stack"
      className="flex flex-col gap-2.5"
    >
      <h3 className="px-2 py-1 font-medium text-muted-foreground text-xs">
        Removed since the previous stack
      </h3>
      <ul className="flex flex-col gap-1">
        {stack.removed.map((each) => (
          <li key={each.previous} className="flex flex-col px-2 py-1 text-sm">
            <span className="text-muted-foreground leading-5 line-through">
              {each.title}
            </span>
            <span className="text-faint text-xs">{each.cohort}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
