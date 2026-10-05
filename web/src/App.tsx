import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './components/shell/auth/RequireAuth.tsx';
import { RequireGuest } from './components/shell/auth/RequireGuest.tsx';
import { lazyPage } from './lib/lazy-page.ts';
import { Inbox } from './routes/Inbox.tsx';
import { Workspace } from './routes/Workspace.tsx';

const AcceptInvite = lazyPage(
  () => import('./routes/AcceptInvite.tsx'),
  (module) => module.AcceptInvite,
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

const CreateWorkspace = lazyPage(
  () => import('./routes/CreateWorkspace.tsx'),
  (module) => module.CreateWorkspace,
);

const DefaultWorkspace = lazyPage(
  () => import('./routes/DefaultWorkspace.tsx'),
  (module) => module.DefaultWorkspace,
);

const GitHubInstalled = lazyPage(
  () => import('./routes/GitHubInstalled.tsx'),
  (module) => module.GitHubInstalled,
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

const Login = lazyPage(
  () => import('./routes/Login.tsx'),
  (module) => module.Login,
);

const Memory = lazyPage(
  () => import('./routes/Memory.tsx'),
  (module) => module.Memory,
);

const Replay = lazyPage(
  () => import('./routes/Replay.tsx'),
  (module) => module.Replay,
);

const ReplaySet = lazyPage(
  () => import('./routes/ReplaySet.tsx'),
  (module) => module.ReplaySet,
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

const Search = lazyPage(
  () => import('./routes/Search.tsx'),
  (module) => module.Search,
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

const TeamConnections = lazyPage(
  () => import('./routes/TeamConnections.tsx'),
  (module) => module.TeamConnections,
);

const TeamSkills = lazyPage(
  () => import('./routes/TeamSkills.tsx'),
  (module) => module.TeamSkills,
);

const Tokens = lazyPage(
  () => import('./routes/Tokens.tsx'),
  (module) => module.Tokens,
);

const WorkspaceGeneral = lazyPage(
  () => import('./routes/WorkspaceGeneral.tsx'),
  (module) => module.WorkspaceGeneral,
);

const WorkspaceIndex = lazyPage(
  () => import('./routes/WorkspaceIndex.tsx'),
  (module) => module.WorkspaceIndex,
);

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route element={<RequireGuest />}>
          <Route path="/login" element={<Login />} />
        </Route>

        <Route path="/invites/:token" element={<AcceptInvite />} />

        <Route element={<RequireAuth />}>
          <Route index element={<DefaultWorkspace />} />
          <Route path="/workspaces/new" element={<CreateWorkspace />} />
          <Route path="/github/installed" element={<GitHubInstalled />} />
          <Route path="/w/:slug" element={<Workspace />}>
            <Route index element={<WorkspaceIndex />} />
            <Route path="team/:teamId">
              <Route index element={<TeamIndex />} />
              <Route path="lines/:lineId" element={<LineBoard />} />
              <Route
                path="lines/:lineId/stations/:stationId"
                element={<Station />}
              />
              <Route
                path="lines/:lineId/stations/:stationId/replay-sets/:setId"
                element={<ReplaySet />}
              />
              <Route
                path="lines/:lineId/stations/:stationId/replays/:replayId"
                element={<Replay />}
              />
              <Route
                path="lines/:lineId/stations/:stationId/searches/:searchId"
                element={<Search />}
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
            </Route>

            <Route path="settings">
              <Route index element={<Navigate to="general" replace />} />
              <Route path="general" element={<WorkspaceGeneral />} />
              <Route path="runners" element={<Runners />} />
              <Route path="runners/new" element={<AddHost />} />
              <Route path="tokens" element={<Tokens />} />
              <Route path="team/:teamId">
                <Route index element={<Navigate to="general" replace />} />
                <Route path="general" element={<TeamGeneral />} />
                <Route path="integrations" element={<TeamIntegrations />} />
                <Route path="connections" element={<TeamConnections />} />
                <Route path="skills" element={<TeamSkills />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
