import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import ImageWithFallback from "../components/ImageWithFallback";
import { CheckCircle2 } from "lucide-react";

function timeAgo(ts) {
  if (!ts) return "just now";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d2 = Math.floor(h / 24);
  if (d2 < 30) return `${d2}d ago`;
  const mo = Math.floor(d2 / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(mo / 12);
  return `${y}y ago`;
}

export default function UserProfile() {
  const { uid } = useParams();
  const { user } = useAuth();
  const location = useLocation();

  const [profile, setProfile] = useState(undefined);
  const [items, setItems] = useState(null);

  //  Avatar loading state
  const photo = profile?.photoURL || null;
  const [imgLoading, setImgLoading] = useState(false);
  useEffect(() => { setImgLoading(!!photo); }, [photo]);

  // Load the user profile
  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => setProfile(snap.exists() ? snap.data() : null),
      () => setProfile(null)
    );
    return () => unsub();
  }, [uid]);

  //  Load this users listings and sort
  useEffect(() => {
    if (!uid) return;
    const qy = query(collection(db, "listings"), where("ownerUid", "==", uid));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rank = (s) => {
          const v = (s || "available").toLowerCase();
          if (v === "available") return 0;
          if (v === "reserved") return 1;
          return 2; // adopted
        };
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => {
          const ra = rank(a.status);
          const rb = rank(b.status);
          if (ra !== rb) return ra - rb;
          const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return tb - ta;
        });
        setItems(rows);
      },
      () => setItems([])
    );
    return () => unsub();
  }, [uid]);

  if (profile === undefined) return <div className="p-6">Loading…</div>;
  if (profile === null) {
    return (
      <div className="min-h-dvh grid place-items-center p-6 bg-base-200">
        <div className="card bg-base-100 shadow-xl max-w-md w-full">
          <div className="card-body">
            <h2 className="card-title">User not found</h2>
            <p>We couldn't find a user with id: <code>{uid}</code></p>
            <Link className="btn" to="/">Go home</Link>
          </div>
        </div>
      </div>
    );
  }

  const isMe = user && user.uid === uid;
  const joined = profile.createdAt?.toDate
    ? profile.createdAt.toDate().toLocaleDateString()
    : "—";

  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); } catch {}
  }

  return (
    <div className="min-h-dvh bg-base-200 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body gap-4">
            <div className="flex items-center gap-4">
              {/* Avatar*/}
              <div className="avatar">
                <div className="relative w-16 h-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 overflow-hidden">
                  {photo ? (
                    <>
                      {imgLoading && <div className="absolute inset-0 skeleton"></div>}
                      <img
                        src={photo}
                        alt={profile.displayName || "User"}
                        className={`w-full h-full object-cover transition-opacity duration-300 ${imgLoading ? "opacity-0" : "opacity-100"}`}
                        onLoad={() => setImgLoading(false)}
                        onError={() => setImgLoading(false)}
                      />
                    </>
                  ) : (
                    <div className="bg-neutral text-neutral-content w-full h-full grid place-items-center">
                      <span className="text-xl">{profile.displayName?.[0]?.toUpperCase() || "U"}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Username & Checkmark for shelters */}
              <div className="flex-1">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  {profile.displayName || "Unnamed user"}
                  {profile.role === "shelter" && profile.isVerifiedShelter && (
                    <span className="tooltip" data-tip="Verified" aria-label="Verified">
                      <CheckCircle2 className="w-5 h-5 text-blue-500" />
                    </span>
                  )}
                </h1>

              {/* Date joined & Email */}
              <div className="flex items-center gap-2 mt-1">
                <span className="badge">{profile.role || "user"}</span>
                <span className="opacity-60 text-sm">Joined: {joined}</span>
              </div>
                {isMe && <p className="opacity-60 text-sm mt-1">{profile.email}</p>}
              </div>
            </div>
            
            {/* Buttons */}
            <div className="card-actions justify-between mt-2">
              <button className="btn" onClick={copyLink}>Copy profile link</button>
              <div className="flex gap-2">
                {isMe && <Link className="btn" to="/profileSettings">Edit profile</Link>}
                <Link className="btn btn-primary" to="/">Home</Link>
              </div>
            </div>
          </div>
        </div>

        {/* User's listings */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Listings</h2>
            {isMe && <Link className="btn btn-primary btn-sm" to="/listings/new">New listing</Link>}
          </div>

          {items === null ? (
            <div className="p-2">Loading listings…</div>
          ) : items.length === 0 ? (
            <div className="alert">No listings yet.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((x) => {
                const status = (x.status || "available").toLowerCase();
                const isAdopted = status === "adopted";
                const statusClass =
                  status === "available"
                    ? "badge-success"
                    : status === "reserved"
                    ? "badge-warning"
                    : "badge-neutral";
                return (
                  <Link
                    to={`/listings/${x.id}`}
                    state={{ from: location }}
                    key={x.id}
                    className={`card bg-base-100 shadow hover:shadow-lg transition ${
                      isAdopted ? "opacity-70" : ""
                    }`}
                  >
                    <figure>
                      <ImageWithFallback
                        src={Array.isArray(x.photos) ? x.photos[0] : undefined}
                        alt={x.title || "Listing photo"}
                      />
                    </figure>
                    <div className="card-body">
                      <div className="flex items-center gap-2">
                        <span className={`badge ${statusClass} capitalize`}>{status}</span>
                        <span className="badge badge-outline capitalize">{x.animalType}</span>
                        {x.city && <span className="badge badge-ghost">{x.city}</span>}
                      </div>
                      <h3 className="card-title">{x.title}</h3>
                      <div className="text-xs opacity-70">{timeAgo(x.createdAt)}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
