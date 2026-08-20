import { NavLink, Outlet } from 'react-router';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'nav-link nav-link--active' : 'nav-link';

/**
 * Layout route: renders on every child route, with <Outlet /> as the slot.
 * NavLink supplies the active state that plain <Link> does not.
 */
export function Layout() {
  return (
    <div className="app">
      <header className="app-header">
        <nav>
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/about" className={navLinkClass}>
            About
          </NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
