import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, storage } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { ANIMAL_OPTIONS, BREEDS_BY_ANIMAL } from "../data/animals";
import { ref as sRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "reserved",  label: "Reserved"  },
  { value: "adopted",   label: "Adopted"   },
];

const MAX_FILES = 5;
const MAX_MB = 8;

function safeName(original) {
  const dot = original.lastIndexOf(".");
  const base = (dot >= 0 ? original.slice(0, dot) : original).toLowerCase();
  const ext  = (dot >= 0 ? original.slice(dot) : "").toLowerCase();
  const slug = base.replace(/\s+/g, "_").replace(/[^a-z0-9._-]/g, "");
  return `${slug}${ext}`;
}

function reorder(arr, from, to) {
  if (from === to) return arr;
  const copy = arr.slice();
  const [m] = copy.splice(from, 1);
  copy.splice(to, 0, m);
  return copy;
}

export default function EditListing() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // loading states
  const [item, setItem] = useState(undefined);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // form state
  const [title, setTitle] = useState("");
  const [animalType, setAnimalType] = useState("");
  const [breed, setBreed] = useState("");
  const [name, setName] = useState("");
  const [sex, setSex] = useState("unknown");
  const [ageYears, setAgeYears] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [status, setStatus] = useState("available");

  // photos state for editing:
  // each item: { type: 'existing'|'new', src: string, file?: File }
  const [images, setImages] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);

  // fetch + gate
  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "listings", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setItem(null);
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        setItem(data);

        // owner-only gate
        if (!user || user.uid !== data.ownerUid) {
          navigate(`/listings/${id}`, { replace: true });
          return;
        }

        // hydrate form
        setTitle(data.title || "");
        setAnimalType(data.animalType || "");
        setBreed(data.breed || "");
        setName(data.name || "");
        setSex(data.sex || "unknown");
        setAgeYears(data.ageYears ?? "");
        setCity((data.city || "").trim());
        setDescription(data.description || "");
        setContactEmail(data.contactEmail || "");
        setContactPhone(data.contactPhone || "");
        setStatus(data.status || "available");

        const urls = Array.isArray(data.photos) ? data.photos.filter(Boolean) : [];
        setImages(urls.map((u) => ({ type: "existing", src: u })));
      } catch (e) {
        console.error(e);
        setItem(null);
      }
    })();
  }, [id, user, navigate]);

  // Clean up object URLs on unmount / when images change
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.type === "new" && img.src.startsWith("blob:")) {
          try { URL.revokeObjectURL(img.src); } catch {}
        }
      });
    };
  }, [images]);

  // breed options depend on animal
  const breedOptions = useMemo(
    () => (animalType ? (BREEDS_BY_ANIMAL[animalType] || ["Unknown"]) : []),
    [animalType]
  );

  if (item === undefined) return <div className="p-6">Loading…</div>;
  if (item === null) {
    return (
      <div className="min-h-dvh grid place-items-center p-6 bg-base-200">
        <div className="card bg-base-100 shadow-xl w-full max-w-xl">
          <div className="card-body">
            <h2 className="card-title">Listing not found</h2>
            <Link className="btn mt-2" to="/listings">Back to listings</Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- photo handlers ----
  function onPickFiles(e) {
    setErr("");
    const picked = Array.from(e.target.files || []);

    const remaining = Math.max(0, MAX_FILES - images.length);
    const add = [];
    for (const f of picked) {
      if (!f.type.startsWith("image/")) {
        setErr("Only image files are allowed.");
        return;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        setErr(`Each image must be < ${MAX_MB} MB.`);
        return;
      }
      add.push({ type: "new", src: URL.createObjectURL(f), file: f });
      if (add.length >= remaining) break;
    }
    if (add.length === 0) return;

    setImages((prev) => [...prev, ...add]);
    e.target.value = "";
  }

  function removeAt(i) {
    setImages((prev) => {
      const next = prev.slice();
      const removed = next.splice(i, 1)[0];
      if (removed?.type === "new" && removed.src.startsWith("blob:")) {
        try { URL.revokeObjectURL(removed.src); } catch {}
      }
      return next;
    });
  }
  function moveLeft(i) {
    if (i <= 0) return;
    setImages((prev) => reorder(prev, i, i - 1));
  }
  function moveRight(i) {
    setImages((prev) => {
      if (i >= prev.length - 1) return prev;
      return reorder(prev, i, i + 1);
    });
  }
  function setAsCover(i) {
    if (i === 0) return;
    setImages((prev) => reorder(prev, i, 0));
  }
  function onDragStart(i) { setDragIndex(i); }
  function onDragOver(e) { e.preventDefault(); }
  function onDrop(i) {
    if (dragIndex == null || dragIndex === i) return setDragIndex(null);
    setImages((prev) => reorder(prev, dragIndex, i));
    setDragIndex(null);
  }
  function onDragEnd() { setDragIndex(null); }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    if (!title.trim() || !description.trim() || !city.trim()) {
      setErr("Title, Description and City are required.");
      return;
    }
    if (!contactEmail.trim() && !contactPhone.trim()) {
      setErr("Provide at least Email or Phone.");
      return;
    }

    try {
      setSaving(true);

      // Upload any NEW images in-place to preserve order; keep existing URLs
      const uploaded = await Promise.all(
        images.map(async (img, idx) => {
          if (img.type === "existing") return img.src;

          const file = img.file;
          const name = `${Date.now()}_${idx}_${safeName(file.name)}`;
          const path = `listings/${id}/${name}`;
          const storageRef = sRef(storage, path);

          const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
          await new Promise((resolve, reject) => {
            task.on("state_changed", null, reject, resolve);
          });
          return await getDownloadURL(storageRef);
        })
      );

      // Prepare doc updates
      const finalPhotos = uploaded.filter(Boolean);
      const updates = {
        title: title.trim(),
        animalType: animalType || null,
        breed: breed || null,
        name: name.trim() || null,
        sex,
        ageYears: ageYears === "" ? null : Number(ageYears),
        city: city.trim(),
        description: description.trim(),
        contactEmail: contactEmail.trim() || null,
        contactPhone: contactPhone.trim() || null,
        status,
        photos: finalPhotos,
        updatedAt: serverTimestamp(),
      };

      const prevStatus = item.status || "available";
      if (status !== prevStatus) {
        if (status === "adopted" && prevStatus !== "adopted") {
          updates.adoptedAt = serverTimestamp();
        } else if (prevStatus === "adopted" && status !== "adopted") {
          updates.adoptedAt = null;
        }
        if (status === "reserved" && prevStatus !== "reserved") {
          updates.reservedAt = serverTimestamp();
        } else if (prevStatus === "reserved" && status !== "reserved") {
          updates.reservedAt = null;
        }
      }

      await updateDoc(doc(db, "listings", id), updates);

      // Delete any removed old photos from Storage
      const old = Array.isArray(item.photos) ? item.photos.filter(Boolean) : [];
      const removed = old.filter((u) => !finalPhotos.includes(u));
      if (removed.length) {
        await Promise.allSettled(removed.map((url) => deleteObject(sRef(storage, url))));
      }

      // back to detail; preserve where you came from if present
      navigate(`/listings/${id}`, {
        replace: true,
        state: location.state ?? undefined,
      });
    } catch (e) {
      console.error(e);
      setErr(e.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  const canAddMore = images.length < MAX_FILES;

  return (
    <div className="min-h-dvh bg-base-200 p-6 grid place-items-center">
      <form onSubmit={onSubmit} className="card bg-base-100 w-full max-w-2xl shadow-xl">
        <div className="card-body gap-3">
          <h2 className="card-title">Edit listing</h2>

          {/* Status */}
          <label className="form-control">
            <div className="label px-0">
              <span className="label-text">Status</span>
            </div>
            <select
              className="select select-bordered w-full"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          {/* Title */}    
          <label className="form-control">
            <div className="label px-0">
              <span className="label-text">Title *</span>
            </div>
            <input
              className="input input-bordered w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>

          {/* Animal Breed Sex */}    
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="form-control">
              <span className="label-text">Animal</span>
              <select
                className="select select-bordered"
                value={animalType}
                onChange={e=>{ setAnimalType(e.target.value); setBreed(""); }}
              >
                <option value="">—</option>
                {ANIMAL_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <span className="label-text">Breed</span>
              <select
                className="select select-bordered"
                value={breed}
                onChange={e=>setBreed(e.target.value)}
                disabled={!animalType}
              >
                <option value="">Unknown</option>
                {breedOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>

            <label className="form-control">
              <span className="label-text">Sex</span>
              <select
                className="select select-bordered"
                value={sex}
                onChange={e=>setSex(e.target.value)}
              >
                <option value="unknown">Unknown</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
          </div>

          {/* Pet name */}    
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text">Pet name</span>
              <input
                className="input input-bordered"
                value={name}
                onChange={e=>setName(e.target.value)}
                placeholder="(optional)"
              />
            </label>

          {/* Age */}    
            <label className="form-control">
              <span className="label-text">Age (years)</span>
              <input
                className="input input-bordered"
                type="number"
                min="0"
                step="0.1"
                value={ageYears}
                onChange={e=>setAgeYears(e.target.value)}
              />
            </label>
          </div>

          {/* City */}    
          <label className="form-control">
            <div className="label px-0">
              <span className="label-text">City *</span>
            </div>
            <input
              className="input input-bordered w-full"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </label>

          {/* Description */}    
          <label className="form-control">
            <div className="label px-0">
              <span className="label-text">Description *</span>
            </div>
            <textarea
              className="textarea textarea-bordered min-h-28 w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </label>

          {/* Photos */}
          <div className="divider">Photos</div>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={onPickFiles}
              className="file-input file-input-bordered"
              disabled={!canAddMore}
            />
            <span className="text-sm opacity-70">
              {images.length}/{MAX_FILES} • drag to reorder • first image is the cover
            </span>
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
              {images.map((img, i) => (
                <div
                  key={`${img.src}-${i}`}
                  className={`relative group rounded-box overflow-hidden border ${dragIndex === i ? "border-primary" : "border-base-300"}`}
                  draggable
                  onDragStart={() => onDragStart(i)}
                  onDragOver={onDragOver}
                  onDrop={() => onDrop(i)}
                  onDragEnd={onDragEnd}
                >
                  {/* Cover badge */}
                  {i === 0 && (
                    <div className="absolute top-2 left-2 z-10 badge badge-primary">Cover</div>
                  )}

                  {/* Remove (top-right) */}
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="btn btn-xs btn-error absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100"
                    title="Remove"
                  >
                    ✕
                  </button>

                  {/* Image */}
                  <img
                    src={img.src}
                    alt=""
                    className="w-full aspect-square object-cover select-none"
                  />

                  {/* Bottom controls */}
                  <div className="absolute inset-x-0 bottom-0 p-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      type="button"
                      className="btn btn-xs"
                      onClick={() => moveLeft(i)}
                      disabled={i === 0}
                      title="Move left"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs"
                      onClick={() => moveRight(i)}
                      disabled={i === images.length - 1}
                      title="Move right"
                    >
                      →
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs"
                      onClick={() => setAsCover(i)}
                      disabled={i === 0}
                      title="Set as cover"
                    >
                      Set cover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {err && <p className="text-error text-sm">{err}</p>}

          <div className="card-actions justify-between mt-2">
            <button type="button" className="btn" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
