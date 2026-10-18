export const SKILL_TRENDS = ['spreading', 'fading', 'steady'] as const;

export type SkillTrend = (typeof SKILL_TRENDS)[number];

export const TREND_RECENT_WEEKS = 2;

export const TREND_MIN_RUNS = 5;

export const TREND_SHIFT_POINTS = 20;

export interface WeekUse {
  readonly runs: number;
  readonly used: number;
}

const together = (weeks: readonly WeekUse[]): WeekUse =>
  weeks.reduce(
    (sum, each) => ({ runs: sum.runs + each.runs, used: sum.used + each.used }),
    { runs: 0, used: 0 },
  );

export const skillTrendOf = (weeks: readonly WeekUse[]): SkillTrend | null => {
  if (weeks.length <= TREND_RECENT_WEEKS) {
    return null;
  }

  const recent = together(weeks.slice(-TREND_RECENT_WEEKS));
  const earlier = together(weeks.slice(0, -TREND_RECENT_WEEKS));

  if (recent.runs < TREND_MIN_RUNS || earlier.runs < TREND_MIN_RUNS) {
    return null;
  }

  const shift = 100 * (recent.used * earlier.runs - earlier.used * recent.runs);
  const threshold = TREND_SHIFT_POINTS * recent.runs * earlier.runs;

  if (shift >= threshold) {
    return 'spreading';
  }

  return shift <= -threshold ? 'fading' : 'steady';
};
