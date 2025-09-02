import { useState, useRef, useEffect } from "react";

export default function MultiSelectCityFilter({ 
  cities, 
  selectedCities, 
  onChange, 
  placeholder = "Select cities..." 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter cities based on search term
  const filteredCities = cities.filter(city =>
    city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleCity = (city) => {
    const newSelected = selectedCities.includes(city)
      ? selectedCities.filter(c => c !== city)
      : [...selectedCities, city];
    onChange(newSelected);
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="form-control" ref={dropdownRef}>
      <span className="label-text">Cities</span>
      <div className="relative">
        {/* Main button */}
        <button
          type="button"
          className="select select-bordered w-full justify-between text-left"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="flex-1 truncate">
            {selectedCities.length === 0 ? (
              <span className="opacity-60">{placeholder}</span>
            ) : selectedCities.length === 1 ? (
              selectedCities[0]
            ) : (
              <span>{selectedCities.length} selected</span>
            )}
          </span>
          <span className="ml-2">
            {isOpen ? "▲" : "▼"}
          </span>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-50 bg-base-100 border border-base-300 rounded-box shadow-lg mt-1 max-h-64 flex flex-col">
            {/* Search input */}
            <div className="p-3 border-b border-base-300">
              <input
                type="text"
                className="input input-sm input-bordered w-full"
                placeholder="Search cities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Actions */}
            {selectedCities.length > 0 && (
              <div className="p-2 border-b border-base-300">
                <button
                  type="button"
                  className="btn btn-xs btn-ghost w-full"
                  onClick={clearAll}
                >
                  Clear all ({selectedCities.length})
                </button>
              </div>
            )}

            {/* City list */}
            <div className="flex-1 overflow-y-auto">
              {filteredCities.length === 0 ? (
                <div className="p-3 text-center text-sm opacity-60">
                  No cities found
                </div>
              ) : (
                filteredCities.map((city) => (
                  <label
                    key={city}
                    className="flex items-center gap-2 p-2 hover:bg-base-200 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={selectedCities.includes(city)}
                      onChange={() => toggleCity(city)}
                    />
                    <span className="text-sm">{city}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}