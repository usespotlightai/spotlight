import { useVirtualizer } from '@pierre/diffs/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
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

interface Folded {
  readonly layerId: string;
  readonly paths: ReadonlySet<string>;
}

const TOO_LARGE = 800;

const foldedFor = (located: LocatedLayer, files: readonly LayerFile[]) => ({
  layerId: located.layer.id,
  paths: new Set(
    files
      .filter(
        (placed) =>
          located.cohort.kind === 'incidental' ||
          linesOf(placed.hunks) > TOO_LARGE,
      )
      .map((placed) => placed.file.path),
  ),
});

export function LayerDetail({ stack, located, onPick }: LayerDetailProps) {
  const { layer } = located;
  const virtualizer = useVirtualizer();
  const layers = layersOf(stack);
  const at = layers.findIndex((each) => each.layer.id === layer.id);
  const previous = layers[at - 1];
  const next = layers[at + 1];
  const files = filesOf(stack, layer);
  const [folded, setFolded] = useState<Folded>(() => foldedFor(located, files));
  const collapsed =
    folded.layerId === layer.id
      ? folded.paths
      : foldedFor(located, files).paths;

  // Because the pane remains mounted between layers, each layer must set its folded files again.
  if (folded.layerId !== layer.id) {
    setFolded(foldedFor(located, files));
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new layer starts at the top
  useEffect(() => {
    virtualizer?.scrollTo({ top: 0 });
  }, [virtualizer, layer.id]);

  const allCollapsed =
    files.length > 0 &&
    files.every((placed) => collapsed.has(placed.file.path));

  const fold = (paths: ReadonlySet<string>) =>
    setFolded({ layerId: layer.id, paths });

  const toggle = (path: string) => {
    const next = new Set(collapsed);
    if (!next.delete(path)) {
      next.add(path);
    }
    fold(next);
  };

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
                fold(
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
