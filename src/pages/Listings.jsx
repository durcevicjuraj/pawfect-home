import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { collection, onSnapshot, orderBy, query, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ImageWithFallback from "../components/ImageWithFallback";
import { ANIMAL_OPTIONS, BREEDS_BY_ANIMAL } from "../data/animals";
import MultiSelectCityFilter from "../components/MultiSelectCityFilter";

function timeAgo(ts) {
  if (!ts) return "just now";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
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

function tsMs(ts) {
  if (!ts) return 0;
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.getTime();
}

// Lazy loading hook
function useLazyLoading(items, itemsPerPage = 12) {
  const [visibleCount, setVisibleCount] = useState(itemsPerPage);
  const [isLoading, setIsLoading] = useState(false);
  const loadMoreRef = useRef();

  const hasMore = visibleCount < items.length;
  const visibleItems = items.slice(0, visibleCount);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;
    
    setIsLoading(true);
    // Simulate slight delay for better UX
    setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + itemsPerPage, items.length));
      setIsLoading(false);
    }, 100);
  }, [isLoading, hasMore, items.length, itemsPerPage]);

  // Reset visible count when items change (e.g., filters applied)
  useEffect(() => {
    setVisibleCount(itemsPerPage);
  }, [items.length, itemsPerPage]);

  // Intersection Observer for auto-loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [loadMore, hasMore, isLoading]);

  return {
    visibleItems,
    hasMore,
    isLoading,
    loadMore,
    loadMoreRef,
    visibleCount,
    totalCount: items.length
  };
}

// Skeleton card component for loading states
function SkeletonCard() {
  return (
    <div className="card bg-base-100 shadow animate-pulse">
      <figure className="relative">
        <div className="w-full h-48 bg-base-300"></div>
        <div className="absolute top-2 left-2">
          <div className="w-16 h-5 bg-base-300 rounded-full"></div>
        </div>
      </figure>
      <div className="card-body">
        <div className="flex gap-2 mb-2">
          <div className="w-12 h-4 bg-base-300 rounded-full"></div>
          <div className="w-16 h-4 bg-base-300 rounded-full"></div>
          <div className="w-14 h-4 bg-base-300 rounded-full"></div>
        </div>
        <div className="w-3/4 h-6 bg-base-300 rounded mb-2"></div>
        <div className="space-y-2">
          <div className="w-full h-3 bg-base-300 rounded"></div>
          <div className="w-2/3 h-3 bg-base-300 rounded"></div>
        </div>
        <div className="w-1/2 h-3 bg-base-300 rounded mt-4"></div>
        <div className="w-1/3 h-3 bg-base-300 rounded"></div>
      </div>
    </div>
  );
}

export default function Listings() {
  const [items, setItems] = useState(null); // null = loading
  const [nameMap, setNameMap] = useState({}); // { uid: displayName }
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filters from URL params
  const [fAgeWindow, setFAgeWindow] = useState(searchParams.get("posted") || "");
  const [fAnimal, setFAnimal] = useState(searchParams.get("animal") || "");
  const [fBreed, setFBreed] = useState(searchParams.get("breed") || "");
  const [fCities, setFCities] = useState(() => {
    const cities = searchParams.get("cities");
    return cities ? cities.split(",").filter(Boolean) : [];
  });
  const [fSex, setFSex] = useState(searchParams.get("sex") || "");
  const [fAgeMin, setFAgeMin] = useState(searchParams.get("ageMin") || "");
  const [fAgeMax, setFAgeMax] = useState(searchParams.get("ageMax") || "");

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (fAgeWindow) params.set("posted", fAgeWindow);
    if (fAnimal) params.set("animal", fAnimal);
    if (fBreed) params.set("breed", fBreed);
    if (fCities.length > 0) params.set("cities", fCities.join(","));
    if (fSex) params.set("sex", fSex);
    if (fAgeMin) params.set("ageMin", fAgeMin);
    if (fAgeMax) params.set("ageMax", fAgeMax);

    const newSearch = params.toString();
    const currentSearch = searchParams.toString();
    if (newSearch !== currentSearch) {
      setSearchParams(params, { replace: true });
    }
  }, [fAgeWindow, fAnimal, fBreed, fCities, fSex, fAgeMin, fAgeMax, searchParams, setSearchParams]);

  // Reset breed when animal changes
  useEffect(() => { setFBreed(""); }, [fAnimal]);

  // live query
  useEffect(() => {
    const qy = query(collection(db, "listings"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qy, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // backfill owner names
  useEffect(() => {
    if (!items) return;
    const missing = [...new Set(items.filter(x => !x.ownerName && x.ownerUid).map(x => x.ownerUid))];
    const unsubs = missing.map(uid =>
      onSnapshot(doc(db, "users", uid), (snap) => {
        const n = snap.data()?.displayName || "User";
        setNameMap(prev => (prev[uid] === n ? prev : { ...prev, [uid]: n }));
      })
    );
    return () => unsubs.forEach(u => u());
  }, [items]);

  // city list from data
  const cityOptions = useMemo(() => {
    if (!items) return [];
    const s = new Set();
    for (const x of items) {
      const c = x.city?.trim();
      if (c) s.add(c);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // breed options based on selected animal
  const breedOptions = useMemo(() => {
    if (!fAnimal) return [];
    return BREEDS_BY_ANIMAL[fAnimal] || ["Unknown"];
  }, [fAnimal]);

  // filter items
  const filtered = useMemo(() => {
    if (!items) return [];
    let windowMs = 0;
    if (fAgeWindow === "24h") windowMs = 24 * 60 * 60 * 1000;
    if (fAgeWindow === "7d") windowMs = 7 * 24 * 60 * 60 * 1000;
    if (fAgeWindow === "30d") windowMs = 30 * 24 * 60 * 60 * 1000;
    const cutoff = windowMs ? Date.now() - windowMs : 0;

    return items.filter((x) => {
      if (cutoff && tsMs(x.createdAt) < cutoff) return false;
      if (fAnimal && x.animalType !== fAnimal) return false;
      if (fBreed && x.breed !== fBreed) return false;
      if (fCities.length > 0 && !fCities.includes(x.city)) return false;
      if (fSex && x.sex !== fSex) return false;

      const age = x.ageYears;
      if (fAgeMin !== "") {
        if (age == null) return false;
        if (Number(age) < Number(fAgeMin)) return false;
      }
      if (fAgeMax !== "") {
        if (age == null) return false;
        if (Number(age) > Number(fAgeMax)) return false;
      }
      return true;
    });
  }, [items, fAgeWindow, fAnimal, fBreed, fCities, fSex, fAgeMin, fAgeMax]);

  // sort so adopted go last; keep recency for the rest
  // sort so: available first, then reserved, then adopted; within each, newest first
  const sorted = useMemo(() => {
    const rank = (s) => {
      const v = (s || "available").toLowerCase();
      if (v === "available") return 0;
      if (v === "reserved") return 1;
      return 2; // adopted or anything else
    };

    const copy = [...filtered];
    copy.sort((a, b) => {
      const ra = rank(a.status);
      const rb = rank(b.status);
      if (ra !== rb) return ra - rb;
      // same bucket → sort by createdAt desc
      return tsMs(b.createdAt) - tsMs(a.createdAt);
    });
    return copy;
  }, [filtered]);

  // Lazy loading hook
  const { 
    visibleItems, 
    hasMore, 
    isLoading, 
    loadMore, 
    loadMoreRef,
    visibleCount,
    totalCount
  } = useLazyLoading(sorted, 12);

  const anyActive =
    fAgeWindow || fAnimal || fBreed || fCities.length > 0 || fSex || fAgeMin !== "" || fAgeMax !== "";

  function clearFilters() {
    setFAgeWindow("");
    setFAnimal("");
    setFBreed("");
    setFCities([]);
    setFSex("");
    setFAgeMin("");
    setFAgeMax("");
  }

  if (items === null) return <div className="p-6">Loading…</div>;

  function statusBadgeClass(s) {
    if (s === "adopted") return "badge-neutral";
    if (s === "reserved") return "badge-warning";
    return "badge-success"; // available / default
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Adoption listings</h1>
        <Link className="btn btn-primary" to="/listings/new">New listing</Link>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 shadow mb-5">
        <div className="card-body grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <label className="form-control">
            <span className="label-text">Posted</span>
            <select className="select select-bordered" value={fAgeWindow} onChange={e=>setFAgeWindow(e.target.value)}>
              <option value="">Any time</option>
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </label>

          <label className="form-control">
            <span className="label-text">Animal</span>
            <select className="select select-bordered" value={fAnimal} onChange={e=>setFAnimal(e.target.value)}>
              <option value="">Any</option>
              {ANIMAL_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label className="form-control">
            <span className="label-text">Breed</span>
            <select
              className="select select-bordered"
              value={fBreed}
              onChange={e=>setFBreed(e.target.value)}
              disabled={!fAnimal || breedOptions.length === 0}
              title={!fAnimal ? "Choose an animal first" : undefined}
            >
              <option value="">Any</option>
              {breedOptions.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </label>

          <MultiSelectCityFilter
            cities={cityOptions}
            selectedCities={fCities}
            onChange={setFCities}
          />

          <label className="form-control">
            <span className="label-text">Sex</span>
            <select className="select select-bordered" value={fSex} onChange={e=>setFSex(e.target.value)}>
              <option value="">Any</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="form-control">
              <span className="label-text">Age min</span>
              <input
                className="input input-bordered"
                type="number" min="0" step="1"
                value={fAgeMin}
                onChange={e=>setFAgeMin(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="form-control">
              <span className="label-text">Age max</span>
              <input
                className="input input-bordered"
                type="number" min="0" step="1"
                value={fAgeMax}
                onChange={e=>setFAgeMax(e.target.value)}
                placeholder="10"
              />
            </label>
          </div>
        </div>

        <div className="card-actions justify-between px-6 pb-4">
          <div className="text-sm opacity-70">
            {totalCount > 0 && (
              <>
                Showing {visibleCount} of {totalCount} result{totalCount === 1 ? "" : "s"}
                {anyActive ? " • filters active" : ""}
              </>
            )}
            {totalCount === 0 && "No results"}
          </div>
          <button className="btn btn-sm" onClick={clearFilters} disabled={!anyActive}>
            Clear filters
          </button>
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="alert">No listings match your filters.</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleItems.map((x) => {
              const status = (x.status || "available").toLowerCase();
              const isAdopted = status === "adopted";
              return (
                <Link
                  to={`/listings/${x.id}`}
                  state={{ from: location }}
                  key={x.id}
                  className={`card bg-base-100 shadow transition ${
                    isAdopted ? "opacity-60" : "hover:shadow-lg"
                  }`}
                >
                  <figure className="relative">
                    {/* status pill */}
                    <div className="absolute top-2 left-2 z-10">
                      <span className={`badge ${statusBadgeClass(status)} capitalize`}>
                        {status}
                      </span>
                    </div>

                    <ImageWithFallback
                      src={Array.isArray(x.photos) ? x.photos[0] : undefined}
                      alt={x.title || "Listing photo"}
                    />
                  </figure>

                  <div className="card-body">
                    <div className="flex items-center gap-2">
                      <span className="badge badge-outline capitalize">{x.animalType}</span>
                      {x.breed && <span className="badge badge-ghost">{x.breed}</span>}
                      {x.city && <span className="badge badge-ghost">{x.city}</span>}
                    </div>
                    <h2 className="card-title">{x.title}</h2>
                    <p className="line-clamp-3">{x.description}</p>
                    <div className="text-xs opacity-70">
                      Posted by {x.ownerName || nameMap[x.ownerUid] || "Unknown"} • {timeAgo(x.createdAt)}
                    </div>
                    <div className="text-xs opacity-60">
                      {x.sex !== "unknown" ? `Sex: ${x.sex}` : ""} {x.ageYears ? `• Age: ${x.ageYears}y` : ""}
                    </div>
                  </div>
                </Link>
              );
            })}

            {/* Skeleton loading cards */}
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={`skeleton-${i}`} />
            ))}
          </div>

          {/* Load more section */}
          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center mt-8">
              <button 
                className="btn btn-outline"
                onClick={loadMore}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Loading...
                  </>
                ) : (
                  "Load More"
                )}
              </button>
            </div>
          )}

          {/* End of results message */}
          {!hasMore && totalCount > 12 && (
            <div className="text-center mt-8 py-4">
              <div className="text-sm opacity-70">
                You've reached the end of the listings
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}