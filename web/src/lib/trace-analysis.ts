/** The work item an "Analyse with AI" from a trace turns into. */
export const analysisTitle = (traceTitle: string): string =>
  `Analyse trace: ${traceTitle}`;

export const analysisBrief = (taskId: string, traceTitle: string): string =>
  `Analyse the run trace for **${traceTitle}** (task \`${taskId}\`) and work out how we can reduce its failure modes in future runs.

Write the trace to a file with \`spotlight trace --task ${taskId}\`. It prints only the file's path and a one-line count — never the trace itself. Read and search that file with your own tools (grep, jq, a ranged read) rather than loading it whole.

The file is one JSON object: \`rows\`, \`faults\`, \`ms\`, and \`roots\` — a tree of nodes. Each node has an \`id\`, a \`kind\` (run, phase, step or span), a \`name\`, \`ms\` and \`tone\`; the heavy detail lives on step nodes (\`step.given\`, \`step.returned\`, \`step.change\`) and span nodes (\`span.attributes\`). Skim the ids, names and tones first, and read the detail only of the nodes worth it.

Report concretely on:

- **System prompt** — where a station's agent prompt misled it or left it unsure, with specific wording to change.
- **Missing tools or environment** — anything it lacked or could not reach that cost it retries or dead ends.
- **Token usage** — where context was spent needlessly (re-reading, loading whole files or traces) and a leaner way to do it.
- **Mistakes** — wrong turns worth skipping next time.

Write it up as a short report with specific, actionable recommendations. Do not make the change here — this is Triage. Hand the task on to Implementation with the recommendations in your handover note, and let Implementation open the pull request against the configuration repository.`;
