import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout.tsx';
import { About } from './routes/About.tsx';
import { Home } from './routes/Home.tsx';
import { NotFound } from './routes/NotFound.tsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
