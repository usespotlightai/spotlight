export const LINE_PROPOSAL_TITLE = 'Update Spotlight configuration';

export const lineProposalBody = (summary: string): string =>
  [
    summary,
    'The board changes when this is merged and read back — nothing here takes effect on its own.',
  ].join('\n\n');
