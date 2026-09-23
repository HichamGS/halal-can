import { Moon } from "lucide-react";
import { SearchBar } from "../SearchBar/SearchBar";
import { MapPin, Navigation } from "lucide-react";
import type { GeoStatus } from "../../hooks/useGeolocation";

interface HeaderProps {
  query: string;
  onQueryChange: (query: string) => void;
  locationLabel: string;
  onUseMyLocation: () => void;
  geoStatus: GeoStatus;
}

export function Header({
  query,
  onQueryChange,
  locationLabel,
  onUseMyLocation,
  geoStatus,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-icon" aria-hidden="true">
          <Moon size={20} fill="currentColor" strokeWidth={0} />
        </span>
        Halal Canada
      </div>

      <div className="header-search">
        <SearchBar value={query} onChange={onQueryChange} />
      </div>

      <div className="header-actions">
        <span className="location-chip" title="Current map focus">
          <MapPin size={14} aria-hidden="true" />
          {locationLabel}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onUseMyLocation}
          disabled={geoStatus === "locating"}
          aria-label="Use my location"
        >
          <Navigation size={14} aria-hidden="true" />
          {geoStatus === "locating" ? "Locating…" : "Use my location"}
        </button>
      </div>
    </header>
  );
}
