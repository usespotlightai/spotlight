import { ArrowRight } from 'lucide-react';
import { type ChangeStack, layerAt, type StackLayer } from '@/lib/change-stack';

type LayerDependenciesProps = {
  stack: ChangeStack;
  layer: StackLayer;
  onPick: (layerId: string) => void;
};

export function LayerDependencies({
  stack,
  layer,
  onPick,
}: LayerDependenciesProps) {
  if (layer.dependsOn.length === 0) {
    return null;
  }

  return (
    <section aria-label="Depends on" className="flex flex-col gap-1.5">
      <h3 className="text-faint text-xs">Depends on</h3>

      <ul className="flex flex-col gap-1">
        {layer.dependsOn.map((dependency) => {
          const earlier = layerAt(stack, dependency.layer);

          return (
            <li
              key={dependency.layer}
              className="flex flex-wrap items-center gap-1.5 text-sm"
            >
              <button
                type="button"
                onClick={() => onPick(dependency.layer)}
                className="flex items-center gap-1.5 rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70"
              >
                <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                <span className="text-faint tabular-nums">
                  {earlier?.position}
                </span>
                <span>{earlier?.layer.title ?? dependency.layer}</span>
              </button>

              {dependency.because.map((symbol) => (
                <code
                  key={symbol}
                  className="rounded border-[0.5px] border-border bg-muted/60 px-1 font-mono text-[11px] text-muted-foreground"
                >
                  {symbol}
                </code>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
