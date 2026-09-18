export interface CronCalendar {
  nextAfter(expression: string, from: Date): Date;
}
