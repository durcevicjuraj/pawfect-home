import { useEffect, useState } from "react";
import { PawPrint } from "lucide-react";

export default function ImageWithFallback({ src, alt = "", className = "" }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(!src);

  useEffect(() => {
    // reset when src changes
    setLoaded(false);
    setFailed(!src);
  }, [src]);

  return (
    <div className={`relative w-full aspect-video overflow-hidden ${className}`}>
      {/* Skeleton while loading (only when we do have an image to load) */}
      {!failed && !loaded && <div className="skeleton absolute inset-0" />}

      {/* Actual image */}
      {src && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            loaded && !failed ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* Placeholder (no image or failed to load) */}
      {(failed) && (
        <div className="absolute inset-0 grid place-items-center bg-base-300">
          <div className="flex flex-col items-center">
            <PawPrint size={28} className="opacity-70" />
            <span className="text-xs opacity-70 mt-1">No photo</span>
          </div>
        </div>
      )}
    </div>
  );
}
