import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { Home, User, Settings, LogOut, Palette, Check, PawPrint } from "lucide-react";

function IconLink({ to, tip, children }) {
  return (
    <div className="tooltip tooltip-left" data-tip={tip}>
      <NavLink
        to={to}
        className={({ isActive }) =>
          `btn btn-circle ${isActive ? "btn-primary" : "btn-ghost"}`
        }
        aria-label={tip}
      >
        {children}
      </NavLink>
    </div>
  );
}

const THEMES = [
  "light",
  "dark",
  "cyberpunk",
  "aqua",
  "valentine",
  "forest",
  "caramellatte",
  "dracula",
  "lofi",
  "lemonade",
  "nord",
];

function getInitialTheme() {
  const saved = localStorage.getItem("theme");
  if (saved && THEMES.includes(saved)) return saved;
  // default
  return "light";
}

export default function RightNav() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  async function handleSignOut() {
    await signOut(auth);
    navigate("/login", { replace: true });
  }

  return (
    <nav className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-3">
      <IconLink to="/" tip="Home">
        <Home size={18} />
      </IconLink>

      <IconLink to="/listings" tip="Listings">
        <PawPrint size={18} />
      </IconLink>


      {user && (
        <IconLink to={`/u/${user.uid}`} tip="Profile">
          <User size={18} />
        </IconLink>
      )}

      <IconLink to="/profileSettings" tip="Profile Settings">
        <Settings size={18} />
      </IconLink>

      {/* Theme dropdown */}
      <div className="tooltip tooltip-left" data-tip={`Theme: ${theme}`}>
        <div className="dropdown dropdown-left">
          <button className="btn btn-circle btn-ghost" aria-label="Choose theme" tabIndex={0}>
            <Palette size={18} />
          </button>
          <ul
              tabIndex={0}
              className="dropdown-content menu menu-sm p-2 shadow-xl bg-base-100 rounded-box
                        w-48 max-h-80 overflow-auto grid grid-cols-1"
            >

            {THEMES.map((name) => (
              <li key={name}>
                <button
                  className={theme === name ? "active capitalize" : "capitalize"}
                  onClick={() => setTheme(name)}
                >
                  <span className="flex-1">{name}</span>
                  {theme === name && <Check size={16} />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="tooltip tooltip-left" data-tip="Sign out">
        <button className="btn btn-circle btn-ghost" onClick={handleSignOut} aria-label="Sign out">
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );
}
