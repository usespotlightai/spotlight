import type { TraceReference } from '@work/domain/value-objects/trace-reference.vo';

export const Traced = {
  reading: `## Reading a trace

A trace is the record of a task being worked along its line. Write one to a file with \`spotlight trace --task <id>\` — it prints the file's path and a short summary, never the trace itself — and read and search that file with your own tools rather than loading it whole.

The file is one JSON object: \`rows\`, \`faults\`, \`ms\`, and \`roots\`, a tree of nodes. Each node has an \`id\`, a \`kind\` (run, phase, step or span), a \`name\`, \`ms\` and \`tone\`; the heavy detail lives on step nodes (\`step.given\`, \`step.returned\`, \`step.change\`) and span nodes (\`span.attributes\`). Skim the ids, names and tones first, and read the detail only of the nodes worth it.`,

  listed(traces: readonly TraceReference[]): string | null {
    return traces.length > 0
      ? [
          'Traces, each written to a file by the command beside it:',
          ...traces.map(
            (each) =>
              `- ${each.title.value}: \`spotlight trace --task ${each.taskId.value}\``,
          ),
        ].join('\n')
      : null;
  },
};
