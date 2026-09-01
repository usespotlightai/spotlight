/** What happened outside Spotlight, in Spotlight's words. Only what an
 *  adapter can recognise is named, so nothing waits on a word nobody raises. */
export const HAPPENINGS = [
  'merged',
  'commented',
  'changes-requested',
  'checks-failed',
  'closed-unmerged',
] as const;

export type Happening = (typeof HAPPENINGS)[number];

/** A merge or a broken build tells itself. Only words answer what was asked. */
export const spokenByAPerson = (happening: Happening): boolean =>
  happening === 'commented' || happening === 'changes-requested';
