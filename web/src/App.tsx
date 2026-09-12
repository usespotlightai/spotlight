import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './components/shell/auth/RequireAuth.tsx';
import { RequireGuest } from './components/shell/auth/RequireGuest.tsx';
import { AcceptInvite } from './routes/AcceptInvite.tsx';
import { AssemblyLineBoard } from './routes/AssemblyLineBoard.tsx';
import { CreateWorkspace } from './routes/CreateWorkspace.tsx';
import { DefaultWorkspace } from './routes/DefaultWorkspace.tsx';
import { GitHubInstalled } from './routes/GitHubInstalled.tsx';
import { Inbox } from './routes/Inbox.tsx';
import { InboxIndex } from './routes/InboxIndex.tsx';
import { InboxItem } from './routes/InboxItem.tsx';
import { Login } from './routes/Login.tsx';
import { Run } from './routes/Run.tsx';
import { Runners } from './routes/Runners.tsx';
import { Station } from './routes/Station.tsx';
import { Task } from './routes/Task.tsx';
import { TaskTrace } from './routes/TaskTrace.tsx';
import { TeamIndex } from './routes/TeamIndex.tsx';
import { TeamIntegrations } from './routes/TeamIntegrations.tsx';
import { TeamSection } from './routes/TeamSection.tsx';
import { TeamSettings } from './routes/TeamSettings.tsx';
import { Workspace } from './routes/Workspace.tsx';
import { WorkspaceIndex } from './routes/WorkspaceIndex.tsx';

export default function App() {
  return (
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
            <Route path="lines/:lineId" element={<AssemblyLineBoard />} />
            <Route
              path="lines/:lineId/stations/:stationId"
              element={<Station />}
            />
            <Route path="tasks/:taskId" element={<Task />} />
            <Route path="observability/tasks/:taskId" element={<TaskTrace />} />
            <Route path="runs/:runId" element={<Run />} />
            <Route path="integrations" element={<TeamIntegrations />} />
            <Route path="settings" element={<TeamSettings />} />
            <Route path=":section" element={<TeamSection />} />
          </Route>
          <Route path="inbox" element={<Inbox />}>
            <Route index element={<InboxIndex />} />
            <Route path=":itemId" element={<InboxItem />} />
          </Route>

          <Route path="runners" element={<Runners />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
