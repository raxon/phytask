import { Link, NavLink } from 'react-router';
import { Icon } from '../shared/ui/Icon';

export function AppHeader() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand">
          <span className="brand-icon">
            <Icon name="pulse" />
          </span>
          <span>
            rep<span className="brand-light">counter</span>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="nav-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Workspace
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => (isActive ? 'active' : '')}>
            Session history
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
