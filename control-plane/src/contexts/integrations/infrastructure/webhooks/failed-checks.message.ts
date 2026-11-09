import type { FailedCheck } from '@github/application/dto/pull-request-activity.dto';

const LOG_LINES = 40;

const LOG_CHARACTERS = 4_000;

const SUMMARY_LINES = 40;

const SUMMARY_CHARACTERS = 2_000;

const DETAILED = 5;

const headOf = (summary: string): string =>
  summary
    .split('\n')
    .slice(0, SUMMARY_LINES)
    .join('\n')
    .slice(0, SUMMARY_CHARACTERS);

const tailOf = (log: string): string =>
  log.trimEnd().split('\n').slice(-LOG_LINES).join('\n').slice(-LOG_CHARACTERS);

const fenced = (text: string): string => {
  const longest = Math.max(
    0,
    ...(text.match(/`+/g) ?? []).map((run) => run.length),
  );
  const fence = '`'.repeat(Math.max(3, longest + 1));

  return `${fence}text\n${text}\n${fence}`;
};

const detailOf = (check: FailedCheck): string | null => {
  const log = check.log?.trim() ? tailOf(check.log) : null;
  const summary = check.summary?.trim() ? headOf(check.summary.trim()) : null;

  if (!check.step && !log && !summary) {
    return null;
  }

  const failed = check.step
    ? `**${check.name}** failed at the step "${check.step}".`
    : `**${check.name}** failed.`;

  return [
    log ? `${failed} The end of its log:` : failed,
    log ? fenced(log) : summary,
  ]
    .filter(Boolean)
    .join('\n\n');
};

export const failedChecksMessage = (
  checks: readonly FailedCheck[],
): string | null =>
  checks.length > 0
    ? [
        `Failed: ${checks.map((check) => check.name).join(', ')}.`,
        ...checks
          .slice(0, DETAILED)
          .map(detailOf)
          .filter((each) => each !== null),
      ].join('\n\n')
    : null;
