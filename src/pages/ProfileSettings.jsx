import { useEffect, useState } from "react";
import { updateProfile } from "firebase/auth";
import { auth, storage } from "../lib/firebase";
import { updateUserDoc } from "../lib/users";
import { useAuth } from "../contexts/AuthContext";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const MAX_MB = 4;

function safeName(original) {
  const dot = original.lastIndexOf(".");
  const base = (dot >= 0 ? original.slice(0, dot) : original).toLowerCase();
  const ext  = (dot >= 0 ? original.slice(dot) : "").toLowerCase();
  const slug = base.replace(/\s+/g, "_").replace(/[^a-z0-9._-]/g, "");
  return `${slug}${ext || ".jpg"}`;
}

export default function Profile() {
  const { user } = useAuth(); // null | FirebaseUser
  const [name, setName] = useState(user?.displayName || "");
  const [photoPreview, setPhotoPreview] = useState(user?.photoURL || "");
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    setName(user?.displayName || "");
    setPhotoPreview(user?.photoURL || "");
  }, [user]);

  if (user === undefined) return <div className="p-6">Loading…</div>;
  if (!user) return <div className="p-6">Not signed in.</div>;

  function onPick(e) {
    setErr("");
    const f = e.target.files?.[0];
    if (!f) return;

    if (!f.type.startsWith("image/")) {
      setErr("Please choose an image file.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setErr(`Image must be under ${MAX_MB} MB.`);
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPhotoPreview(url);
  }

  async function onSave(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setSaving(true);
    setPct(0);

    try {
      let newPhotoURL = user.photoURL || null;

      // Upload if a new file is selected
      if (file) {
        const path = `avatars/${user.uid}/${Date.now()}_${safeName(file.name)}`;
        const r = ref(storage, path);
        const task = uploadBytesResumable(r, file, { contentType: file.type });

        await new Promise((resolve, reject) => {
          task.on(
            "state_changed",
            (snap) => {
              const p = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
              setPct(p);
            },
            (e) => reject(e),
            () => resolve()
          );
        });
        newPhotoURL = await getDownloadURL(r);
      }

      // Update Firebase Auth profile (displayName + optional photoURL)
      await updateProfile(user, {
        displayName: name || null,
        ...(newPhotoURL ? { photoURL: newPhotoURL } : {}),
      });

      // Update Firestore user doc too
      const updates = { displayName: name || null };
      if (newPhotoURL) updates.photoURL = newPhotoURL;
      await updateUserDoc(user.uid, updates);

      // Refresh local auth object to reflect new photo
      await user.reload();

      setMsg("Saved ✅");
    } catch (e) {
      console.error(e);
      setErr(e.code || e.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-dvh bg-base-200 grid place-items-center p-6">
      <form onSubmit={onSave} className="card bg-base-100 w-full max-w-sm shadow-xl">
        <div className="card-body gap-4">
          <h2 className="card-title">Profile Settings</h2>

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="avatar">
              <div className="w-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 overflow-hidden">
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" />
                ) : (
                  <div className="bg-neutral text-neutral-content w-full h-full grid place-items-center">
                    <span className="text-xl">{(name?.[0] || "U").toUpperCase()}</span>
                  </div>
                )}
              </div>
            </div>

            <label className="form-control flex-1">
              <span className="label-text">Profile photo</span>
              <input
                type="file"
                accept="image/*"
                className="file-input file-input-bordered"
                onChange={onPick}
              />
              <span className="text-xs opacity-70 mt-1">PNG/JPG, up to {MAX_MB} MB</span>
              {pct > 0 && pct < 100 && (
                <progress className="progress w-full mt-2" value={pct} max="100"></progress>
              )}
            </label>
          </div>

          {/* Name */}
          <label className="form-control">
            <span className="label-text">Display name</span>
            <input
              className="input input-bordered"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </label>

          {/* Messages */}
          {err && <p className="text-error text-sm">{err}</p>}
          {msg && <p className="text-sm opacity-70">{msg}</p>}

          <div className="card-actions justify-end">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
