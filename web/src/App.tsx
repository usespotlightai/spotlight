import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './components/common/auth/RequireAuth.tsx';
import { RequireGuest } from './components/common/auth/RequireGuest.tsx';
import { CreateWorkspace } from './routes/CreateWorkspace.tsx';
import { DefaultWorkspace } from './routes/DefaultWorkspace.tsx';
import { Login } from './routes/Login.tsx';
import { SignUp } from './routes/SignUp.tsx';
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
          <Route path="team/:teamId/:section" element={<TeamSection />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
