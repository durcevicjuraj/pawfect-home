import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user"); // "user" | "shelter"
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      // create auth user
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

      // optional display name
      if (displayName.trim()) {
        await updateProfile(cred.user, { displayName: displayName.trim() });
      }

      // write user profile doc
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        email: email.trim(),
        displayName: displayName.trim() || null,
        createdAt: serverTimestamp(),
        role,                       // "user" or "shelter"
        isVerifiedShelter: false,   // defaults to false
      });

      navigate("/");
    } catch (e) {
      setErr(e.message || "Registration failed.");
      console.error(e);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-base-200 p-6">
      <form onSubmit={onSubmit} className="card bg-base-100 w-full max-w-sm shadow-xl">
        <div className="card-body gap-3">
          <h2 className="card-title">Create account</h2>

          <input
            className="input input-bordered"
            placeholder="Display name (optional)"
            value={displayName}
            onChange={e=>setDisplayName(e.target.value)}
          />

          <input
            className="input input-bordered"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            required
          />

          <input
            className="input input-bordered"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            required
          />

          {/* Profile type */}
          <label className="form-control">
            <span className="label-text">Account type</span>
            <select
              className="select select-bordered"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="user">User</option>
              <option value="shelter">Shelter</option>
            </select>
            {role === "shelter" && (
              <span className="text-xs opacity-70 mt-1">
                Shelter accounts start unverified. An admin can verify your shelter later.
              </span>
            )}
          </label>

          {err && <p className="text-error text-sm">{err}</p>}

          <div className="card-actions justify-between">
            <Link className="link" to="/login">Have an account?</Link>
            <button className="btn btn-primary" type="submit">Register</button>
          </div>
        </div>
      </form>
    </div>
  );
}
