import type {
  AnnotationSide,
  DiffLineAnnotation,
  SelectedLineRange,
} from '@pierre/diffs';
import { PatchDiff } from '@pierre/diffs/react';
import type { ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useHighlighterReady } from '@/hooks/useHighlighterReady';
import { diffOptions, FLUSH_DIFF_METRICS } from '@/lib/diff';

export type HoveredLine = () =>
  | { lineNumber: number; side: AnnotationSide }
  | undefined;

type PatchCodeDiffProps<T> = {
  path: string;
  patch: string;
  annotations?: DiffLineAnnotation<T>[];
  renderAnnotation?: (annotation: DiffLineAnnotation<T>) => ReactNode;
  gutter?: (hovered: HoveredLine) => ReactNode;
  selected?: SelectedLineRange | null;
  onSelecting?: (range: SelectedLineRange | null) => void;
  onSelected?: (range: SelectedLineRange | null) => void;
};

export function PatchCodeDiff<T>({
  path,
  patch,
  annotations,
  renderAnnotation,
  gutter,
  selected,
  onSelecting,
  onSelected,
}: PatchCodeDiffProps<T>) {
  const ready = useHighlighterReady(path);

  return (
    <ScrollArea orientation="horizontal" contentClassName="text-xs">
      {ready && (
        <PatchDiff<T>
          patch={patch}
          metrics={FLUSH_DIFF_METRICS}
          lineAnnotations={annotations}
          renderAnnotation={renderAnnotation}
          renderGutterUtility={gutter}
          selectedLines={onSelected ? (selected ?? null) : undefined}
          options={{
            ...diffOptions(true, Boolean(gutter)),
            ...(gutter ? { enableGutterUtility: true } : {}),
            ...(onSelected
              ? {
                  enableLineSelection: true,
                  onLineSelectionChange: onSelecting,
                  onLineSelectionEnd: onSelected,
                }
              : {}),
          }}
        />
      )}
    </ScrollArea>
  );
}
