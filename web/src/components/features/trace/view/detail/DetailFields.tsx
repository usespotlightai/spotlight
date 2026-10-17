import type { Field } from '@/lib/detail';
import { cn } from '@/lib/utils';

const tones: Record<Field['kind'], string> = {
  string: 'text-foreground',
  number: 'text-foreground tabular-nums',
  boolean: 'text-foreground',
  null: 'text-faint',
};

export function DetailFields({ fields }: { fields: readonly Field[] }) {
  return (
    <dl className="flex flex-col">
      {fields.map((field) => (
        <div
          key={field.path}
          className="-mx-2 flex min-h-7 items-start gap-3 rounded-md px-2 py-1 transition-colors hover:bg-accent"
        >
          <dt
            className="w-28 shrink-0 truncate pt-0.5 text-muted-foreground text-xs"
            title={field.path}
          >
            {field.path}
          </dt>
          <dd
            className={cn(
              'min-w-0 flex-1 break-words text-sm leading-5',
              tones[field.kind],
            )}
          >
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
