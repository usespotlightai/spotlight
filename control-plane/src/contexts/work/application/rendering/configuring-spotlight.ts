const DOCS = 'https://docs.usespotlight.ai';

export const ConfiguringSpotlight = {
  section: [
    '## Configuring Spotlight',
    'Teams write Spotlight’s configuration as Terraform code: lines and stations, integrations, hooks, skills, secrets and runners. They use the provider `usespotlightai/spotlight` and the modules of the `usespotlightai` namespace in the Terraform Registry, such as `usespotlightai/slack/spotlight` for Slack. Some steps happen in the web app, such as connecting GitHub, inviting people and issuing tokens. The docs say which.',
    `The docs are at ${DOCS}, and ${DOCS}/llms.txt lists every page with a one-line summary.`,
    'When the task or the person asks how to set up or change Spotlight, such as an integration, a line, a station, a secret or a runner, first read the docs page for it, and base your answer or your change on that page. Spotlight’s source code and tests show how Spotlight works inside, not how to set it up. If you cannot open the docs, say so, and do not guess from Spotlight’s source code.',
  ].join('\n\n'),
};
