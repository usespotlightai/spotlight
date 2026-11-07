const waiting = (station: string, link: string | null): string => {
  const where = station ? ` at ${station}` : '';

  return `A task${where} is waiting on you.${link ? ` ${link}` : ''}`;
};

const decidedAt = (link: string | null): string =>
  link
    ? `Approve or reject it in Spotlight: ${link}`
    : 'Approve or reject it in your Spotlight inbox.';

export const askText = (input: {
  readonly written: string;
  readonly station: string;
  readonly link: string | null;
  readonly awaitsApproval: boolean;
}): string => {
  const body = input.written || waiting(input.station, input.link);

  return input.awaitsApproval ? `${body}\n\n${decidedAt(input.link)}` : body;
};
