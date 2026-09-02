import type { Ref } from 'react';
import { PaneHandle } from '@/components/layout/PaneHandle';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { took } from '@/lib/inbox';
import type { TraceNode } from '@/lib/trace';
import { cn } from '@/lib/utils';

const Field = ({ name, value }: { name: string; value: string }) => (
  <div className="flex gap-3 py-1 text-xs">
    <dt className="w-32 shrink-0 truncate text-muted-foreground">{name}</dt>
    <dd className="min-w-0 flex-1 break-words font-mono text-foreground">
      {value}
    </dd>
  </div>
);

const Spoke = ({ title, body }: { title: string; body: string }) => (
  <section className="flex flex-col gap-1">
    <h3 className="font-medium text-foreground text-xs">{title}</h3>
    <p className="whitespace-pre-wrap break-words text-muted-foreground text-xs leading-5">
      {body}
    </p>
  </section>
);

const Block = ({ title, body }: { title: string; body: string }) => (
  <section className="flex flex-col gap-1">
    <h3 className="font-medium text-foreground text-xs">{title}</h3>
    <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-muted-foreground text-xs leading-5">
      {body}
    </pre>
  </section>
);

const DETAIL_PANE = {
  storageKey: 'spotlight.trace-detail-width',
  min: 288,
  max: 720,
  initial: 384,
  label: 'Resize the details',
  edge: 'left' as const,
};

/**
 * Where a step and a span describe the same call, both are read: the model and
 * its cost from the harness, the file and the rewrite from the protocol.
 */
export function SpanDetail({
  node,
  open,
  ref,
}: {
  node: TraceNode;
  open: boolean;
  ref?: Ref<HTMLElement>;
}) {
  const { step, span } = node;
  const { width, resizing, handleProps } = usePaneWidth(DETAIL_PANE);

  return (
    <aside
      ref={ref}
      style={{ width }}
      data-closed={open ? undefined : ''}
      data-open={open ? '' : undefined}
      className={cn(
        'relative shrink-0 border-border border-l-[0.5px] duration-150',
        'data-open:animate-in data-open:fade-in data-open:slide-in-from-right-4',
        // Held at where it left off until it is taken away: without this the
        // animation ends, the panel snaps back to full, and it flickers.
        'data-closed:animate-out data-closed:fade-out data-closed:slide-out-to-right-4 data-closed:fill-mode-forwards',
        resizing && 'select-none',
      )}
    >
      <PaneHandle {...handleProps} edge="left" resizing={resizing} />

      <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
        <header className="flex flex-col gap-1">
          <h2
            className={cn(
              'break-words font-medium text-sm',
              node.tone === 'failed' ? 'text-destructive' : 'text-foreground',
            )}
          >
            {node.name}
          </h2>
          <p className="text-muted-foreground text-xs">
            {took(node.ms)}
            {step?.status && ` · ${step.status}`}
            {span && ` · ${span.name}`}
          </p>
        </header>

        {/* A row named for its kind rather than its words leaves the words
            with nowhere else to be read. */}
        {step && step.text !== node.name && (
          <Spoke
            title={
              step.kind === 'thought' ? 'What it was thinking' : 'What it said'
            }
            body={step.text}
          />
        )}

        {step?.locations.length ? (
          <section className="flex flex-col gap-1">
            <h3 className="font-medium text-foreground text-xs">
              Where it went
            </h3>
            <ul className="flex flex-col">
              {step.locations.map((where) => (
                <li
                  key={`${where.path}:${where.line}`}
                  className="truncate font-mono text-muted-foreground text-xs"
                  title={where.path}
                >
                  {where.path}
                  {where.line !== null && `:${where.line}`}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {step?.change && (
          <section className="flex flex-col gap-1">
            <h3 className="font-medium text-foreground text-xs">
              {step.change.path ?? 'What changed'}
            </h3>
            <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-5">
              <span className="text-destructive">
                {step.change.before || '(nothing)'}
              </span>
              {'\n'}
              <span className="text-foreground">
                {step.change.after || '(nothing)'}
              </span>
            </pre>
          </section>
        )}

        {step?.given && (
          <Block title="What it was asked for" body={step.given} />
        )}
        {step?.detail && <Block title="What came back" body={step.detail} />}
        {step?.returned && !step.detail && (
          <Block title="What came back" body={step.returned} />
        )}

        {span && span.attributes.length > 0 && (
          <section className="flex flex-col">
            <h3 className="pb-1 font-medium text-foreground text-xs">
              What the harness reported
            </h3>
            <dl className="divide-y divide-border">
              {span.attributes.map((each) => (
                <Field key={each.name} name={each.name} value={each.value} />
              ))}
            </dl>
          </section>
        )}

        {!step && !span && (
          <p className="text-muted-foreground text-xs">
            Nothing was recorded about this beyond how long it took.
          </p>
        )}
      </div>
    </aside>
  );
}
