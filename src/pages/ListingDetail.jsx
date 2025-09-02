import { useEffect, useState } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { doc, onSnapshot, deleteDoc } from "firebase/firestore";
import { db, storage } from "../lib/firebase";
import { ref as sRef, deleteObject } from "firebase/storage";
import ImageWithFallback from "../components/ImageWithFallback";
import { useAuth } from "../contexts/AuthContext";

function timeAgo(ts) {
  if (!ts) return "just now";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dys = Math.floor(h / 24);
  if (dys < 30) return `${dys}d ago`;
  const mo = Math.floor(dys / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(mo / 12);
  return `${y}y ago`;
}

/* Availability pill */
function StatusBadge({ status }) {
  const map = {
    available: { text: "Available", cls: "badge-success" },
    reserved:  { text: "Reserved",  cls: "badge-warning" },
    adopted:   { text: "Adopted",   cls: "badge-neutral" },
  };
  const s = map[status || "available"];
  return <span className={`badge ${s.cls}`}>{s.text}</span>;
}

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [item, setItem] = useState(undefined); // undefined=loading, null=not found
  const [idx, setIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const from = location.state?.from;

  function goBack() {
    if (from) {
      navigate(-1);
    } else if (item?.ownerUid) {
      navigate(`/u/${item.ownerUid}`, { replace: true });
    } else {
      navigate("/listings", { replace: true });
    }
  }

  // Subscribe to listing
  useEffect(() => {
    const ref = doc(db, "listings", id);
    const unsub = onSnapshot(
      ref,
      (snap) => setItem(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => setItem(null)
    );
    return () => unsub();
  }, [id]);

  // Reset photo index when item changes
  useEffect(() => setIdx(0), [item?.id]);

  // Keyboard arrows
  useEffect(() => {
    function onKey(e) {
      const photos = Array.isArray(item?.photos) ? item.photos.filter(Boolean) : [];
      if (photos.length < 2) return;
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + photos.length) % photos.length);
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % photos.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item]);

  if (item === undefined) return <div className="p-6">Loading…</div>;
  if (item === null) {
    return (
      <div className="min-h-dvh grid place-items-center p-6">
        <div className="card bg-base-100 shadow-xl w-full max-w-xl">
          <div className="card-body">
            <h2 className="card-title">Listing not found</h2>
            <Link className="btn mt-2" to="/listings">Back to listings</Link>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = !!user && user.uid === item.ownerUid;

  const photos = (Array.isArray(item.photos) ? item.photos : []).filter(Boolean);
  const count = photos.length;
  const hasCarousel = count > 1;

  function prev() {
    if (!hasCarousel) return;
    setIdx((i) => (i - 1 + count) % count);
  }
  function next() {
    if (!hasCarousel) return;
    setIdx((i) => (i + 1) % count);
  }

  async function handleDelete() {
    if (!isOwner) return;
    const ok = window.confirm("Delete this listing? This cannot be undone.");
    if (!ok) return;

    try {
      setDeleting(true);

      // 1) Delete photos in Storage
      if (photos.length) {
        await Promise.allSettled(
          photos.map((url) => deleteObject(sRef(storage, url)))
        );
      }

      // 2) Delete Firestore doc
      await deleteDoc(doc(db, "listings", id));

      // 3) Navigate back smartly
      if (from) navigate(-1);
      else navigate("/listings", { replace: true });
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to delete. Check permissions and try again.");
    } finally {
      setDeleting(false);
    }
  }

  const email = item.contactEmail || null;
  const phone = item.contactPhone || null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="breadcrumbs text-sm mb-4">
        <ul>
          <li><Link to="/listings">Listings</Link></li>
          <li>{item.title || "Detail"}</li>
        </ul>
      </div>

      <div className="card bg-base-100 shadow-xl">
        {/* Image area */}
        <div className="relative">
          <ImageWithFallback
            src={photos[idx]}
            alt={item.title || "Listing photo"}
          />

          {hasCarousel && (
            <>
              <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
                <button
                  type="button"
                  className="btn btn-circle btn-neutral pointer-events-auto"
                  onClick={prev}
                  aria-label="Previous photo"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="btn btn-circle btn-neutral pointer-events-auto"
                  onClick={next}
                  aria-label="Next photo"
                >
                  ›
                </button>
              </div>

              <div className="absolute bottom-2 right-2 bg-base-100/80 rounded px-2 py-1 text-xs">
                {idx + 1} / {count}
              </div>
            </>
          )}
        </div>

        <div className="card-body gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <span className="badge badge-outline capitalize">{item.animalType}</span>
            {item.breed && <span className="badge badge-ghost">{item.breed}</span>}
            {item.city && <span className="badge badge-ghost">{item.city}</span>}
            {item.sex !== "unknown" && <span className="badge">{item.sex}</span>}
            {item.ageYears != null && <span className="badge">Age: {item.ageYears}y</span>}
          </div>

          <h1 className="text-3xl font-bold">{item.title}</h1>
          {item.name && <div className="opacity-80">Pet name: <strong>{item.name}</strong></div>}

          <p className="leading-relaxed whitespace-pre-wrap">{item.description}</p>

          <div className="opacity-70 text-sm">
            Posted by{" "}
            {item.ownerUid ? (
              <Link
                to={`/u/${item.ownerUid}`}
                state={{ from: location }}
                className="link link-hover"
              >
                {item.ownerName || "User"}
              </Link>
            ) : (
              item.ownerName || "Unknown"
            )}
            {" "}• {timeAgo(item.createdAt)}
          </div>

          <div className="card-actions justify-between mt-2">
            <button className="btn" onClick={goBack}>Back</button>

            <div className="flex gap-2 flex-wrap">
              {isOwner && (
                <>
                  <Link
                    className="btn"
                    to={`/listings/${id}/edit`}
                    state={{ from: location }}
                  >
                    Edit
                  </Link>
                  <button
                    className="btn btn-error"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                </>
              )}
              {email && <a className="btn btn-primary" href={`mailto:${email}`}>Email</a>}
              {phone && <a className="btn" href={`tel:${phone}`}>Call</a>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
