import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  repeatsSuggestionShown,
  type SearchWarning,
  warningShown,
} from '@/lib/search-words';

type SearchWarningsProps = {
  warnings: readonly SearchWarning[];
  repeats: number | null;
  onUseRepeats: (repeats: number) => void;
  disabled: boolean;
};

export function SearchWarnings({
  warnings,
  repeats,
  onUseRepeats,
  disabled,
}: SearchWarningsProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <ul aria-label="Warnings" className="flex flex-col gap-1.5">
      {warnings.map((warning) => {
        const suggested =
          warning.kind === 'noisy' ? warning.suggestedRepeats : null;

        return (
          <li
            key={warning.kind}
            data-slot="search-warning"
            data-kind={warning.kind}
            className="flex items-start gap-1.5 text-amber-700 text-xs leading-5 dark:text-amber-400"
          >
            <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="flex min-w-0 flex-col items-start gap-1">
              <span>{warningShown(warning)}</span>
              {suggested !== null && suggested !== repeats && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={disabled}
                  onClick={() => onUseRepeats(suggested)}
                >
                  {repeatsSuggestionShown(suggested)}
                </Button>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
