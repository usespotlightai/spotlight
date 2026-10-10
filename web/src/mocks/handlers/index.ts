import { authHandlers } from '@/mocks/handlers/auth';
import { inboxHandlers } from '@/mocks/handlers/inbox';
import { insightsHandlers } from '@/mocks/handlers/insights';
import { membersHandlers } from '@/mocks/handlers/members';
import { settingsHandlers } from '@/mocks/handlers/settings';
import { shellHandlers } from '@/mocks/handlers/shell';
import { stationHandlers } from '@/mocks/handlers/station';
import { teamHandlers } from '@/mocks/handlers/team';
import { workHandlers } from '@/mocks/handlers/work';

export const handlers = [
  ...authHandlers,
  ...shellHandlers,
  ...inboxHandlers,
  ...workHandlers,
  ...stationHandlers,
  ...insightsHandlers,
  ...teamHandlers,
  ...settingsHandlers,
  ...membersHandlers,
];
