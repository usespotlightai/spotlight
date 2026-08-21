import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './components/common/auth/RequireAuth.tsx';
import { RequireGuest } from './components/common/auth/RequireGuest.tsx';
import { Home } from './routes/Home.tsx';
import { Login } from './routes/Login.tsx';
import { SignUp } from './routes/SignUp.tsx';

export default function App() {
  return (
    <Routes>
      <Route element={<RequireGuest />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route index element={<Home />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
