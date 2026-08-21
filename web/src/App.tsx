import { Route, Routes } from 'react-router';
import { Login } from './routes/Login.tsx';
import { SignUp } from './routes/SignUp.tsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
    </Routes>
  );
}
