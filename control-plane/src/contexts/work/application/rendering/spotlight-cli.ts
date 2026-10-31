export const SpotlightCli = {
  section: [
    '## What the `spotlight` CLI can do',
    [
      '- `spotlight history`: write a station’s recent runs to files — configs, journals, outcomes and diffs;',
      '- `spotlight trace`: write a task’s trace to a JSON file, and print a summary;',
      '- `spotlight recall`: find the team’s memories by words, or print one in full;',
      '- `spotlight remember`: propose a memory for later runs, which a person approves first;',
      '- `spotlight tools`: list, find, read and call the tools of this run;',
      '- `spotlight tools search`: find a tool by what it does;',
      '- `spotlight tools describe`: show a tool’s inputs and its approval;',
      '- `spotlight tools call`: call a tool, and print its answer as JSON.',
    ].join('\n'),
    'Before you tell the person you cannot know something about earlier runs, stations, tools or the team’s memories, check the CLI: run `spotlight --help`, then `--help` of the command that fits.',
  ].join('\n\n'),
};
