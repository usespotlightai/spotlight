import { useVirtualizer } from '@pierre/diffs/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { LayerFileCard } from '@/components/features/changes/LayerFileCard';
import { LayerQuestions } from '@/components/features/changes/LayerQuestions';
import { Button } from '@/components/ui/button';
import {
  type ChangeStack,
  type CitedPlace,
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

interface CollapsedFiles {
  readonly layerId: string;
  readonly paths: ReadonlySet<string>;
}

const TOO_LARGE = 800;

const collapsedFilesFor = (
  located: LocatedLayer,
  files: readonly LayerFile[],
) => ({
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
  const content = useRef<HTMLDivElement>(null);
  const [collapsedFiles, setCollapsedFiles] = useState<CollapsedFiles>(() =>
    collapsedFilesFor(located, files),
  );
  const collapsed =
    collapsedFiles.layerId === layer.id
      ? collapsedFiles.paths
      : collapsedFilesFor(located, files).paths;

  // Because the pane remains mounted between layers, each layer must set its collapsed files again.
  if (collapsedFiles.layerId !== layer.id) {
    setCollapsedFiles(collapsedFilesFor(located, files));
  }

  useEffect(() => {
    virtualizer?.scrollTo({ top: 0 });
  }, [virtualizer, layer.id]);

  const allCollapsed =
    files.length > 0 &&
    files.every((placed) => collapsed.has(placed.file.path));

  const setCollapsedPaths = (paths: ReadonlySet<string>) =>
    setCollapsedFiles({ layerId: layer.id, paths });

  const toggle = (path: string) => {
    const next = new Set(collapsed);
    if (!next.delete(path)) {
      next.add(path);
    }
    setCollapsedPaths(next);
  };

  const reveal = (place: CitedPlace) => {
    if (place.layerId && place.layerId !== layer.id) {
      onPick(place.layerId);
      return;
    }

    const next = new Set(collapsed);
    next.delete(place.path);
    flushSync(() => setCollapsedPaths(next));

    content.current
      ?.querySelector(`article[aria-label="${CSS.escape(place.path)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      ref={content}
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-5 @md/pane:px-6 @xl/pane:px-8 @xl/pane:py-8"
    >
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
                setCollapsedPaths(
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

      <LayerQuestions stack={stack} layer={layer} onReveal={reveal} />

      <nav
        aria-label="Layers"
        className="flex items-center justify-between gap-2"
      >
        {previous ? (
          <Button
            variant="outline"
            size="sm"
            title={previous.layer.title}
            className="min-w-0 max-w-1/2 rounded-full bg-card"
            onClick={() => onPick(previous.layer.id)}
          >
            <ArrowLeft aria-hidden />
            <span className="truncate">{previous.layer.title}</span>
          </Button>
        ) : (
          <span />
        )}

        {next && (
          <Button
            variant="outline"
            size="sm"
            title={next.layer.title}
            className="min-w-0 max-w-1/2 rounded-full bg-card"
            onClick={() => onPick(next.layer.id)}
          >
            <span className="truncate">{next.layer.title}</span>
            <ArrowRight aria-hidden />
          </Button>
        )}
      </nav>
    </div>
  );
}
