export const spanned = (from: string, to: string): string => {
  const opened = new Date(from);
  const closed = new Date(to);
  const sameDay = opened.toDateString() === closed.toDateString();

  const clock = (at: Date) =>
    at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return sameDay
    ? `${startedOn(opened.toISOString())} – ${clock(closed)}`
    : `${startedOn(opened.toISOString())} – ${startedOn(closed.toISOString())}`;
};

export const startedOn = (at: string): string =>
  new Date(at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
