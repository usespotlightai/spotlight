import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import { RequireAuth } from './components/shell/auth/RequireAuth.tsx';
import { RequireGuest } from './components/shell/auth/RequireGuest.tsx';
import { DesktopHandoff } from './components/shell/DesktopHandoff.tsx';
import { PageErrorBoundary } from './components/shell/layout/PageErrorBoundary.tsx';
import { lazyPage } from './lib/lazy-page.ts';
import { Workspace } from './routes/Workspace.tsx';
import { workspacePages } from './workspace-pages.tsx';

const AcceptInvite = lazyPage(
  () => import('./routes/AcceptInvite.tsx'),
  (module) => module.AcceptInvite,
);

const AuthorizeDevice = lazyPage(
  () => import('./routes/AuthorizeDevice.tsx'),
  (module) => module.AuthorizeDevice,
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

const Login = lazyPage(
  () => import('./routes/Login.tsx'),
  (module) => module.Login,
);

const VerifyEmail = lazyPage(
  () => import('./routes/VerifyEmail.tsx'),
  (module) => module.VerifyEmail,
);

export default function App() {
  return (
    <PageErrorBoundary>
      <Suspense fallback={null}>
        <DesktopHandoff>
          <Routes>
            <Route element={<RequireGuest />}>
              <Route path="/login" element={<Login />} />
            </Route>

            <Route path="/invites/:token" element={<AcceptInvite />} />
            <Route path="/verify-email/:token" element={<VerifyEmail />} />
            <Route path="/device" element={<AuthorizeDevice />} />

            <Route element={<RequireAuth />}>
              <Route index element={<DefaultWorkspace />} />
              <Route path="/workspaces/new" element={<CreateWorkspace />} />
              <Route path="/github/installed" element={<GitHubInstalled />} />
              <Route
                path="/w/:slug"
                element={<Workspace pages={workspacePages} />}
              >
                {workspacePages}
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DesktopHandoff>
      </Suspense>
    </PageErrorBoundary>
  );
}
