const SIGNATURE = /^\*\*[^\n]+?\*\* via Spotlight:\n\n/;

export const signedBy = (name: string, body: string): string =>
  `**${name}** via Spotlight:\n\n${body}`;

export const unsigned = (body: string): string => body.replace(SIGNATURE, '');
