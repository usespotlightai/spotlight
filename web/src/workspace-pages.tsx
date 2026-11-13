import { Navigate, Route } from 'react-router';

import { lazyPage } from './lib/lazy-page.ts';
import { Inbox } from './routes/Inbox.tsx';

const AccountEmails = lazyPage(
  () => import('./routes/AccountEmails.tsx'),
  (module) => module.AccountEmails,
);

const AccountNotifications = lazyPage(
  () => import('./routes/AccountNotifications.tsx'),
  (module) => module.AccountNotifications,
);

const AddHost = lazyPage(
  () => import('./routes/AddHost.tsx'),
  (module) => module.AddHost,
);

const Agent = lazyPage(
  () => import('./routes/Agent.tsx'),
  (module) => module.Agent,
);

const AgentChat = lazyPage(
  () => import('./routes/AgentChat.tsx'),
  (module) => module.AgentChat,
);

const ApiAccess = lazyPage(
  () => import('./routes/ApiAccess.tsx'),
  (module) => module.ApiAccess,
);

const InboxIndex = lazyPage(
  () => import('./routes/InboxIndex.tsx'),
  (module) => module.InboxIndex,
);

const InboxItem = lazyPage(
  () => import('./routes/InboxItem.tsx'),
  (module) => module.InboxItem,
);

const InboxNotice = lazyPage(
  () => import('./routes/InboxNotice.tsx'),
  (module) => module.InboxNotice,
);

const Insights = lazyPage(
  () => import('./routes/Insights.tsx'),
  (module) => module.Insights,
);

const LineBoard = lazyPage(
  () => import('./routes/LineBoard.tsx'),
  (module) => module.LineBoard,
);

const Memory = lazyPage(
  () => import('./routes/Memory.tsx'),
  (module) => module.Memory,
);

const Run = lazyPage(
  () => import('./routes/Run.tsx'),
  (module) => module.Run,
);

const RunChangeStack = lazyPage(
  () => import('./routes/RunChangeStack.tsx'),
  (module) => module.RunChangeStack,
);

const Runners = lazyPage(
  () => import('./routes/Runners.tsx'),
  (module) => module.Runners,
);

const Runs = lazyPage(
  () => import('./routes/Runs.tsx'),
  (module) => module.Runs,
);

const Station = lazyPage(
  () => import('./routes/Station.tsx'),
  (module) => module.Station,
);

const Task = lazyPage(
  () => import('./routes/Task.tsx'),
  (module) => module.Task,
);

const TaskTrace = lazyPage(
  () => import('./routes/TaskTrace.tsx'),
  (module) => module.TaskTrace,
);

const TeamGeneral = lazyPage(
  () => import('./routes/TeamGeneral.tsx'),
  (module) => module.TeamGeneral,
);

const TeamIndex = lazyPage(
  () => import('./routes/TeamIndex.tsx'),
  (module) => module.TeamIndex,
);

const TeamIntegrations = lazyPage(
  () => import('./routes/TeamIntegrations.tsx'),
  (module) => module.TeamIntegrations,
);

const TeamSkills = lazyPage(
  () => import('./routes/TeamSkills.tsx'),
  (module) => module.TeamSkills,
);

const WorkspaceMembers = lazyPage(
  () => import('./routes/WorkspaceMembers.tsx'),
  (module) => module.WorkspaceMembers,
);

const WorkspaceGeneral = lazyPage(
  () => import('./routes/WorkspaceGeneral.tsx'),
  (module) => module.WorkspaceGeneral,
);

const WorkspaceIndex = lazyPage(
  () => import('./routes/WorkspaceIndex.tsx'),
  (module) => module.WorkspaceIndex,
);

export const workspacePages = (
  <>
    <Route index element={<WorkspaceIndex />} />
    <Route path="team/:teamId">
      <Route index element={<TeamIndex />} />
      <Route path="lines/:lineId" element={<LineBoard />} />
      <Route
        path="lines/:lineId/stations/:stationId/:tab?"
        element={<Station />}
      />
      <Route path="tasks/:taskId" element={<Task />} />
      <Route path="tasks/:taskId/trace" element={<TaskTrace />} />
      <Route path="agent" element={<Agent />} />
      <Route path="agent/:chatId" element={<AgentChat />} />
      <Route path="runs" element={<Runs />} />
      <Route path="runs/:runId" element={<Run />} />
      <Route path="runs/:runId/changes" element={<RunChangeStack />} />
      <Route path="insights" element={<Insights />} />
      <Route path="memory" element={<Memory />} />
    </Route>
    <Route path="inbox" element={<Inbox />}>
      <Route index element={<InboxIndex />} />
      <Route path=":itemId" element={<InboxItem />} />
      <Route path="notices/:noticeId" element={<InboxNotice />} />
      <Route path="teams/:teamId/runs/:runId" element={<Run />} />
      <Route path="teams/:teamId/chats/:chatId" element={<AgentChat />} />
    </Route>

    <Route path="settings">
      <Route index element={<Navigate to="general" replace />} />
      <Route path="account/emails" element={<AccountEmails />} />
      <Route path="account/notifications" element={<AccountNotifications />} />
      <Route path="general" element={<WorkspaceGeneral />} />
      <Route path="members" element={<WorkspaceMembers />} />
      <Route path="runners" element={<Runners />} />
      <Route path="runners/new" element={<AddHost />} />
      <Route path="api-access" element={<ApiAccess />} />
      <Route path="team/:teamId">
        <Route index element={<Navigate to="general" replace />} />
        <Route path="general" element={<TeamGeneral />} />
        <Route path="integrations" element={<TeamIntegrations />} />
        <Route path="skills" element={<TeamSkills />} />
      </Route>
    </Route>
  </>
);
