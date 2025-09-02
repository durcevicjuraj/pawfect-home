import { useEffect, useState } from "react";
import { addDoc, collection, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { auth, db, storage } from "../lib/firebase";
import { useNavigate, Link } from "react-router-dom";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { ANIMAL_OPTIONS, BREEDS_BY_ANIMAL } from "../data/animals";

const MAX_FILES = 5;
const MAX_MB = 8;

const MAX_TITLE = 30;
const MAX_DESC = 150;

// block selling words/symbols (case-insensitive)
const SELL_RE = /\b(price|money|euro|eur|dollar|usd|kn|kuna|hrk|sell|selling|for\s*sale)\b|[$€]/gi;

function findBannedTerms(s) {
  if (!s) return [];
  const uniq = new Set();
  const matches = s.match(SELL_RE);
  if (matches) {
    for (const m of matches) {
      const t = m.trim().toLowerCase();
      uniq.add(t.replace(/\s+/g, " "));
    }
  }
  return Array.from(uniq);
}

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
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

export default function NewListing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // form fields
  const [title, setTitle] = useState("");
  const [animalType, setAnimalType] = useState("dog");
  const [breed, setBreed] = useState("Unknown");
  const [name, setName] = useState("");
  const [sex, setSex] = useState("unknown");
  const [ageYears, setAgeYears] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");

  // contact (at least one required)
  const [contactEmail, setContactEmail] = useState(auth.currentUser?.email || "");
  const [contactPhone, setContactPhone] = useState("");

  // images
  const [files, setFiles] = useState([]);       // File[]
  const [previews, setPreviews] = useState([]); // object URLs
  const [dragIndex, setDragIndex] = useState(null);

  // validations
  const bannedInTitle = findBannedTerms(title);
  const bannedInDesc  = findBannedTerms(description);
  const titleOver = title.length > MAX_TITLE;
  const descOver  = description.length > MAX_DESC;

  useEffect(() => {
    const list = BREEDS_BY_ANIMAL[animalType] || ["Unknown"];
    setBreed(list[0] || "Unknown");
  }, [animalType]);

  function rebuildPreviews(nextFiles) {
    previews.forEach((u) => URL.revokeObjectURL(u));
    setPreviews(nextFiles.map((f) => URL.createObjectURL(f)));
  }

  function onPickFiles(e) {
    setErr("");
    const picked = Array.from(e.target.files || []);
    const all = [...files, ...picked];

    const unique = [];
    const seen = new Set();
    for (const f of all) {
      const key = `${f.name}-${f.size}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(f);
      }
      if (unique.length >= MAX_FILES) break;
    }

    for (const f of unique) {
      if (!f.type.startsWith("image/")) {
        setErr("Only image files are allowed.");
        return;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        setErr(`Each image must be < ${MAX_MB} MB.`);
        return;
      }
    }

    setFiles(unique);
    rebuildPreviews(unique);
  }

  function removeAt(i) {
    const next = files.slice();
    next.splice(i, 1);
    setFiles(next);
    rebuildPreviews(next);
  }

  function moveLeft(i) {
    if (i <= 0) return;
    const next = reorder(files, i, i - 1);
    setFiles(next);
    rebuildPreviews(next);
  }
  function moveRight(i) {
    if (i >= files.length - 1) return;
    const next = reorder(files, i, i + 1);
    setFiles(next);
    rebuildPreviews(next);
  }
  function setAsCover(i) {
    if (i === 0) return;
    const next = reorder(files, i, 0);
    setFiles(next);
    rebuildPreviews(next);
  }

  function onDragStart(i) { setDragIndex(i); }
  function onDragOver(e) { e.preventDefault(); }
  function onDrop(i) {
    if (dragIndex == null || dragIndex === i) return setDragIndex(null);
    const next = reorder(files, dragIndex, i);
    setFiles(next);
    rebuildPreviews(next);
    setDragIndex(null);
  }
  function onDragEnd() { setDragIndex(null); }

  async function onSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setErr("");

    if (!title.trim()) return setErr("Title is required.");
    if (title.length > MAX_TITLE) return setErr(`Title must be ≤ ${MAX_TITLE} characters.`);
    if (!description.trim()) return setErr("Description is required.");
    if (description.length > MAX_DESC) return setErr(`Description must be ≤ ${MAX_DESC} characters.`);
    const bad = [...bannedInTitle, ...bannedInDesc];
    if (bad.length) return setErr(`Please remove selling-related terms: ${Array.from(new Set(bad)).join(", ")}`);

    const emailOK = contactEmail.trim().length > 0;
    const phoneOK = contactPhone.trim().length > 0;
    if (!emailOK && !phoneOK) return setErr("Please provide at least an email or a phone number.");

    const cityClean = city.trim();
    if (!cityClean) return setErr("Please enter the city/location.");

    setLoading(true);
    try {
      const uid = auth.currentUser.uid;

      const docRef = await addDoc(collection(db, "listings"), {
        ownerUid: uid,
        ownerName: auth.currentUser.displayName || null,
        title: title.trim(),
        animalType,
        breed,
        name: name.trim() || null,
        sex,
        ageYears: ageYears === "" ? null : Number(ageYears),
        city: cityClean,
        description: description.trim(),
        contactEmail: emailOK ? contactEmail.trim() : null,
        contactPhone: phoneOK ? contactPhone.trim() : null,
        status: "available",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        photos: [],
      });

      // Upload in arranged order (first is cover)
      let urls = [];
      if (files.length) {
        urls = await Promise.all(
          files.map(async (file, idx) => {
            const name = `${Date.now()}_${idx}_${safeName(file.name)}`;
            const path = `listings/${docRef.id}/${name}`;
            const storageRef = ref(storage, path);

            const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
            await new Promise((resolve, reject) => {
              task.on("state_changed", null, reject, resolve);
            });

            return await getDownloadURL(storageRef);
          })
        );
      }

      if (urls.length) {
        await updateDoc(doc(db, "listings", docRef.id), {
          photos: urls,
          updatedAt: serverTimestamp(),
        });
      }

      navigate("/listings", { replace: true });
    } catch (e) {
      console.error(e);
      setErr(e.code || e.message || "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  const breedOptions = BREEDS_BY_ANIMAL[animalType] || ["Unknown"];
  const breedDisabled = animalType === "other" || breedOptions.length <= 1;

  return (
    <div className="min-h-dvh bg-base-200 p-6 grid place-items-center">
      <form onSubmit={onSubmit} className="card bg-base-100 w-full max-w-3xl shadow-xl">
        <div className="card-body gap-4">
          <h2 className="card-title text-2xl">Create adoption listing</h2>

          {/* Title */}
          <label className="form-control grid grid-cols-2 gap-x-2 gap-y-1">
            <div>
              <span className="label-text">Title *  </span>
              <span className={`text-xs justify-self-end ${titleOver ? "text-error" : "opacity-60"}`}>
                {title.length}/{MAX_TITLE}
              </span>
            </div>

            <input
              className={`input input-bordered col-span-2 ${titleOver || bannedInTitle.length ? "input-error" : ""}`}
              value={title}
              onChange={(e)=>setTitle(e.target.value)}
              required
              maxLength={MAX_TITLE}
              placeholder="Max 30 characters"
            />

            {bannedInTitle.length > 0 && (
              <span className="text-error text-xs mt-1 col-span-2">
                Remove: {bannedInTitle.join(", ")}
              </span>
            )}
</label>


          {/* Animal + Breed + Sex + Age */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <label className="form-control">
              <span className="label-text">Animal</span>
              <select
                className="select select-bordered"
                value={animalType}
                onChange={(e)=>setAnimalType(e.target.value)}
              >
                {ANIMAL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <span className="label-text">Breed</span>
              <select
                className="select select-bordered"
                value={breed}
                onChange={(e)=>setBreed(e.target.value)}
                disabled={breedDisabled}
                title={breedDisabled ? "Breed is set to Unknown" : undefined}
              >
                {breedOptions.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <span className="label-text">Sex</span>
              <select
                className="select select-bordered"
                value={sex}
                onChange={(e)=>setSex(e.target.value)}
              >
                <option value="unknown">Unknown</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>

            <label className="form-control">
              <span className="label-text">Age (years)</span>
              <input
                className="input input-bordered"
                type="number"
                min="0"
                step="0.1"
                value={ageYears}
                onChange={(e)=>setAgeYears(e.target.value)}
                placeholder="e.g. 2"
              />
            </label>
          </div>

          {/* Pet name + City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text">Pet name</span>
              <input
                className="input input-bordered"
                value={name}
                onChange={(e)=>setName(e.target.value)}
                placeholder="(optional)"
              />
            </label>

            <label className="form-control">
              <span className="label-text">Location (City) *</span>
              <input
                className="input input-bordered"
                value={city}
                onChange={(e)=>setCity(e.target.value)}
                placeholder="e.g. Osijek"
                required
              />
            </label>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text">Contact email</span>
              <input
                className="input input-bordered"
                type="email"
                value={contactEmail}
                onChange={(e)=>setContactEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </label>

            <label className="form-control">
              <span className="label-text">Contact phone</span>
              <input
                className="input input-bordered"
                inputMode="tel"
                value={contactPhone}
                onChange={(e)=>setContactPhone(e.target.value)}
                placeholder="+385 ..."
              />
            </label>
          </div>
          <p className="text-xs opacity-70 -mt-2">Provide at least one: email or phone.</p>

          {/* Description */}
          <label className="form-control grid grid-cols-2 gap-x-2 gap-y-1">
            <div>
              <span className="label-text">Description *  </span>
              <span className={`text-xs justify-self-end ${descOver ? "text-error" : "opacity-60"}`}>
                {description.length}/{MAX_DESC}
              </span>
            </div>

            <textarea
              className={`textarea textarea-bordered min-h-32 col-span-2 ${descOver || bannedInDesc.length ? "textarea-error" : ""}`}
              value={description}
              onChange={(e)=>setDescription(e.target.value)}
              required
              maxLength={MAX_DESC}
              placeholder="Max 150 characters; no prices/selling terms"
            />

            {bannedInDesc.length > 0 && (
              <span className="text-error text-xs mt-1 col-span-2">
                Remove: {bannedInDesc.join(", ")}
              </span>
            )}
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
            />
            <span className="text-sm opacity-70">
              Up to {MAX_FILES} images, each &lt; {MAX_MB} MB
            </span>
          </div>

          {previews.length > 0 && (
            <>
              <p className="text-xs opacity-70 mt-2">
                Tip: drag to reorder • first image is the cover • or use the buttons.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
                {previews.map((src, i) => (
                  <div
                    key={i}
                    className={`relative group rounded-box overflow-hidden border ${
                      dragIndex === i ? "border-primary" : "border-base-300"
                    }`}
                    draggable
                    onDragStart={() => onDragStart(i)}
                    onDragOver={onDragOver}
                    onDrop={() => onDrop(i)}
                    onDragEnd={onDragEnd}
                  >
                    {/* Cover badge */}
                    {i === 0 && (
                      <div className="absolute top-2 left-2 z-10 badge badge-primary">
                        Cover
                      </div>
                    )}

                    {/* ✕ Remove — now in the TOP RIGHT */}
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
                      src={src}
                      alt=""
                      className="w-full aspect-square object-cover select-none"
                    />

                    {/* Bottom controls: reorder + set cover */}
                    <div className="absolute inset-x-0 bottom-0 p-2 flex items-center justify-start gap-1 opacity-0 group-hover:opacity-100 transition">
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
                        disabled={i === files.length - 1}
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
            </>
          )}

          {err && <p className="text-error text-sm">{err}</p>}

          <div className="card-actions justify-between mt-2">
            <Link className="btn" to="/listings">Cancel</Link>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading || titleOver || descOver || bannedInTitle.length > 0 || bannedInDesc.length > 0}
            >
              {loading ? "Publishing…" : "Publish listing"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
