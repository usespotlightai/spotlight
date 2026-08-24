import { FitAddon } from '@xterm/addon-fit';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useXTerm } from 'react-xtermjs';
import { useTerminalTheme } from '@/hooks/useTerminalTheme';
import { sendRunInput } from '@/lib/api';
import { fromTyped, isRunEvent, toBytes } from '@/lib/terminal';

type RunTerminalProps = {
  runId: string;
};

export function RunTerminal({ runId }: RunTerminalProps) {
  const fit = useMemo(() => new FitAddon(), []);
  const theme = useTerminalTheme();
  const born = useRef(theme).current;

  // Held still because useXTerm disposes and recreates the terminal whenever
  // either changes identity. Passing literals opens a connection per render.
  const addons = useMemo(() => [fit], [fit]);

  const options = useMemo(
    () => ({
      cursorBlink: true,
      fontSize: 12,
      fontFamily:
        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      scrollback: 10_000,
      theme: born,
    }),
    [born],
  );

  const { ref, instance } = useXTerm({ addons, options });

  // Chained so keystrokes reach the agent in the order they were typed.
  // Independent requests do not.
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef('');

  const enqueue = useCallback((task: () => Promise<unknown>) => {
    chain.current = chain.current.then(task, task);
  }, []);

  const sendTyped = useCallback(
    (data: string) => {
      pending.current += data;

      enqueue(() => {
        const batch = pending.current;
        pending.current = '';

        return batch
          ? sendRunInput({ path: { runId }, body: { data: fromTyped(batch) } })
          : Promise.resolve();
      });
    },
    [enqueue, runId],
  );

  const sendSize = useCallback(
    (cols: number, rows: number) => {
      enqueue(() => sendRunInput({ path: { runId }, body: { cols, rows } }));
    },
    [enqueue, runId],
  );

  useEffect(() => {
    if (!instance) {
      return;
    }

    const typed = instance.onData(sendTyped);
    return () => typed.dispose();
  }, [instance, sendTyped]);

  useEffect(() => {
    if (!instance) {
      return;
    }

    instance.reset();

    const stream = new EventSource(`/api/runs/${runId}/stream`);

    stream.onmessage = (message: MessageEvent<string>) => {
      let entry: unknown;
      try {
        entry = JSON.parse(message.data);
      } catch {
        return;
      }

      if (!isRunEvent(entry)) {
        return;
      }

      if (entry.data) {
        instance.write(toBytes(entry.data));
        return;
      }

      if (entry.message && entry.type !== 'output') {
        instance.write(`\r\n\x1b[2m${entry.type}: ${entry.message}\x1b[0m\r\n`);
      }
    };

    return () => stream.close();
  }, [instance, runId]);

  useEffect(() => {
    if (!instance) {
      return;
    }

    const container = ref.current;
    if (!container) {
      return;
    }

    let sent = { cols: 0, rows: 0 };

    const measure = () => {
      try {
        fit.fit();
      } catch {
        return;
      }

      if (instance.cols !== sent.cols || instance.rows !== sent.rows) {
        sent = { cols: instance.cols, rows: instance.rows };
        sendSize(sent.cols, sent.rows);
      }
    };

    const observer = new ResizeObserver(measure);
    observer.observe(container);

    return () => observer.disconnect();
  }, [instance, fit, ref, sendSize]);

  useEffect(() => {
    if (instance) {
      instance.options.theme = theme;
    }
  }, [instance, theme]);

  useEffect(() => {
    instance?.focus();
  }, [instance]);

  // fit() subtracts a hardcoded 14px for the scrollbar; widening by exactly
  // that and clipping hands the columns back.
  return (
    <div className="min-h-0 flex-1 overflow-hidden bg-background">
      <div ref={ref} className="h-full w-[calc(100%+14px)]" />
    </div>
  );
}
