import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    if (loading) return;             // prevent double click
    setLoading(true);
    setErr("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate("/", { replace: true });
    } catch (e) {
      setErr(e.code || e.message);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-base-200 p-6">
      <form onSubmit={onSubmit} className="card bg-base-100 w-full max-w-sm shadow-xl">
        <div className="card-body gap-3">
          <h2 className="card-title">Login</h2>
          <input className="input input-bordered" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="input input-bordered" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
          {err && <p className="text-error text-sm">{err}</p>}
          <div className="card-actions justify-between">
            <Link className="link" to="/register">Create account</Link>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
