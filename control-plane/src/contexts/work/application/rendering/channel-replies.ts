export interface ListedProposal {
  readonly number: number;
  readonly title: string;
  readonly line: string | null;
  readonly station: string | null;
}

const placed = (proposal: ListedProposal): string =>
  proposal.line && proposal.station
    ? ` (${proposal.line} › ${proposal.station})`
    : '';

export const ChannelReplies = {
  unknownPerson:
    'Sorry, no member of this Spotlight workspace uses the email of your account. Add that email in Spotlight under Settings › Emails, or join the workspace with it. Then try again.',

  notInTeam:
    'Sorry, you are not a member of the Spotlight team that reads these messages. Ask a team admin to add you, then try again.',

  notTheStarter:
    'Only the person who started this chat can talk to it. To ask your own question, mention Spotlight in a new message.',

  nothingSaid: 'Please write your question after the mention.',

  failed: 'Sorry, Spotlight could not finish this answer. Please try again.',

  mixedImages:
    'Sorry, the lines of this team run in different images, so one chat cannot read all their repositories. Ask a team admin to give the lines one image.',

  noneOpen: 'This chat has no open proposal.',

  unknownHarness(harness: string): string {
    return `Sorry, this integration names the harness ${harness}, which Spotlight does not know. Ask a team admin to change it.`;
  },

  unnamed(open: number): string {
    return `This chat has ${open} open proposals. Name one, as in “accept 2”.`;
  },

  noSuch(number: number): string {
    return `This chat has no open proposal ${number}.`;
  },

  dismissed(title: string): string {
    return `Dismissed “${title}”.`;
  },

  created(title: string): string {
    return `Created the task “${title}”. Its questions come in a new thread in this channel.`;
  },

  answered(said: string | null, open: readonly ListedProposal[]): string {
    if (open.length === 0) {
      return said ?? '';
    }

    const only = open.length === 1;
    const listed = open.map(
      (each) => `${each.number}. ${each.title}${placed(each)}`,
    );

    return [
      ...(said ? [said, ''] : []),
      only ? 'Open proposal:' : 'Open proposals:',
      ...listed,
      only
        ? 'To create the task, reply “accept”. To remove it, reply “dismiss”.'
        : 'To create a task, reply “accept” and its number, as in “accept 1”. To remove one, reply “dismiss” and its number.',
    ].join('\n');
  },
};
