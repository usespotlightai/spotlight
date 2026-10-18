const BYLINE = /^\*\*[^\n]+?\*\* via Spotlight:\n\n/;

export const withByline = (name: string, body: string): string =>
  `**${name}** via Spotlight:\n\n${body}`;

export const stripByline = (body: string): string => body.replace(BYLINE, '');
