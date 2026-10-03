import { cn } from '@/lib/utils';

type ModelEffortSummaryProps = {
  model: string;
  modelName: string;
  effort: string;
  offersEffort: boolean;
};

export function ModelEffortSummary({
  model,
  modelName,
  effort,
  offersEffort,
}: ModelEffortSummaryProps) {
  const allDefault = !model && !(offersEffort && effort);

  if (allDefault) {
    return <span className="truncate text-muted-foreground">Default</span>;
  }

  return (
    <>
      <span
        className={cn(
          'truncate',
          model ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {modelName}
      </span>
      {offersEffort && (
        <>
          <span aria-hidden className="-mx-1 shrink-0 text-muted-foreground">
            ·
          </span>
          <span
            className={cn(
              'shrink-0',
              effort ? 'text-foreground capitalize' : 'text-muted-foreground',
            )}
          >
            {effort || 'Default'}
          </span>
        </>
      )}
    </>
  );
}
