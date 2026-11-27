/** Why a run counts for none of its station's signals: it ended for a reason outside the station's work. */
export const LEFT_OUT_CAUSES = [
  'refused',
  'setup',
  'infrastructure',
  'cancelled',
] as const;

export type LeftOutCause = (typeof LEFT_OUT_CAUSES)[number];
