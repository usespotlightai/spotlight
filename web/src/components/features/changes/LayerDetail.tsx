import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { LayerFileCard } from '@/components/features/changes/LayerFileCard';
import { Button } from '@/components/ui/button';
import {
  type ChangeStack,
  filesOf,
  type LayerFile,
  type LocatedLayer,
  layersOf,
  linesOf,
} from '@/lib/change-stack';

type LayerDetailProps = {
  stack: ChangeStack;
  located: LocatedLayer;
  onPick: (layerId: string) => void;
};

const LINE_BUDGET = 1_500;

const shownWithin = (
  files: readonly LayerFile[],
  budget: number,
): ReadonlySet<string> => {
  const collapsed = new Set<string>();
  let shown = 0;

  for (const placed of files) {
    if (shown > budget) {
      collapsed.add(placed.file.path);
    }
    shown += linesOf(placed.hunks);
  }

  return collapsed;
};

export function LayerDetail({ stack, located, onPick }: LayerDetailProps) {
  const { cohort, layer } = located;
  const layers = layersOf(stack);
  const at = layers.findIndex((each) => each.layer.id === layer.id);
  const previous = layers[at - 1];
  const next = layers[at + 1];
  const files = filesOf(stack, layer);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() =>
    cohort.kind === 'incidental'
      ? new Set(files.map((placed) => placed.file.path))
      : shownWithin(files, LINE_BUDGET),
  );
  const allCollapsed =
    files.length > 0 &&
    files.every((placed) => collapsed.has(placed.file.path));

  const toggle = (path: string) =>
    setCollapsed((now) => {
      const next = new Set(now);
      if (!next.delete(path)) {
        next.add(path);
      }
      return next;
    });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-8 py-8">
      <header className="flex flex-col gap-2">
        <h2 className="font-medium text-foreground text-lg">{layer.title}</h2>
        <p className="text-muted-foreground text-sm">{layer.summary}</p>
      </header>

      <section aria-label="Files in this layer" className="flex flex-col gap-3">
        {files.length > 1 && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-muted-foreground text-xs"
              onClick={() =>
                setCollapsed(
                  new Set(
                    allCollapsed ? [] : files.map((placed) => placed.file.path),
                  ),
                )
              }
            >
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </Button>
          </div>
        )}

        {files.map((placed) => (
          <LayerFileCard
            key={placed.file.path}
            placed={placed}
            open={!collapsed.has(placed.file.path)}
            onToggle={() => toggle(placed.file.path)}
          />
        ))}
      </section>

      <nav
        aria-label="Layers"
        className="flex items-center justify-between gap-2"
      >
        {previous ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full bg-card"
            onClick={() => onPick(previous.layer.id)}
          >
            <ArrowLeft aria-hidden />
            {previous.layer.title}
          </Button>
        ) : (
          <span />
        )}

        {next && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full bg-card"
            onClick={() => onPick(next.layer.id)}
          >
            {next.layer.title}
            <ArrowRight aria-hidden />
          </Button>
        )}
      </nav>
    </div>
  );
}
