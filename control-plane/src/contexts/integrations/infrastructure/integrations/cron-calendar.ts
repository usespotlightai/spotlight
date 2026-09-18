import type { CronCalendar } from '@integrations/domain/services/cron-calendar';
import { CronTime } from 'cron';

export const cronCalendar: CronCalendar = {
  nextAfter: (expression, from) =>
    new CronTime(expression).getNextDateFrom(from).toJSDate(),
};
