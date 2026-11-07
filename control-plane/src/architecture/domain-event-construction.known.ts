import type { KnownViolations } from './known-violations';

export const KNOWN_DOMAIN_EVENT_CONSTRUCTION: KnownViolations = {
  'contexts/work/application/commands/handlers/use-tool.handler: new ToolUsed':
    { count: 1, finding: 'WORK-A-17' },
  'contexts/work/application/events/handlers/record-run-usage.handler: new ReplayRunUsageRecorded':
    { count: 1, finding: 'WORK-B-07' },
  'contexts/work/application/events/handlers/record-run-usage.handler: new RunUsageRecorded':
    { count: 1, finding: 'WORK-B-07' },
  'contexts/work/application/events/handlers/record-run-usage.handler: new SearchRunUsageRecorded':
    { count: 1, finding: 'WORK-B-07' },
};
