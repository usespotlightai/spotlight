import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './components/common/auth/RequireAuth.tsx';
import { RequireGuest } from './components/common/auth/RequireGuest.tsx';
import { AssemblyLineBoard } from './routes/AssemblyLineBoard.tsx';
import { CreateWorkspace } from './routes/CreateWorkspace.tsx';
import { DefaultWorkspace } from './routes/DefaultWorkspace.tsx';
import { Inbox } from './routes/Inbox.tsx';
import { InboxIndex } from './routes/InboxIndex.tsx';
import { InboxItem } from './routes/InboxItem.tsx';
import { Login } from './routes/Login.tsx';
import { RunnerIndex } from './routes/RunnerIndex.tsx';
import { Runners } from './routes/Runners.tsx';
import { RunnerTerminal } from './routes/RunnerTerminal.tsx';
import { SignUp } from './routes/SignUp.tsx';
import { Station } from './routes/Station.tsx';
import { Task } from './routes/Task.tsx';
import { TeamIndex } from './routes/TeamIndex.tsx';
import { TeamSection } from './routes/TeamSection.tsx';
import { Workspace } from './routes/Workspace.tsx';
import { WorkspaceIndex } from './routes/WorkspaceIndex.tsx';

export default function App() {
  return (
    <Routes>
      <Route element={<RequireGuest />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route index element={<DefaultWorkspace />} />
        <Route path="/workspaces/new" element={<CreateWorkspace />} />
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
            <Route path=":section" element={<TeamSection />} />
          </Route>
          <Route path="inbox" element={<Inbox />}>
            <Route index element={<InboxIndex />} />
            <Route path=":taskId" element={<InboxItem />} />
          </Route>

          <Route path="runners" element={<Runners />}>
            <Route index element={<RunnerIndex />} />
            <Route path=":runnerId" element={<RunnerTerminal />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
