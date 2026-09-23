import { memo } from "react";
import { Star, MapPin } from "lucide-react";
import type { PlaceDTO } from "../../services/distanceService";
import { categoryEmoji, HALAL_STATUS_DOT, HALAL_STATUS_LABELS } from "../../utils/categories";

interface PlaceCardProps {
  place: PlaceDTO;
  selected: boolean;
  onSelect: (id: string) => void;
}

/** Compact, scannable list card. Memoised so selection changes don't re-render all cards. */
export const PlaceCard = memo(function PlaceCard({ place, selected, onSelect }: PlaceCardProps) {
  const cuisineLine = place.cuisine?.join(" · ");
  const halalLabel = place.halalStatus ? HALAL_STATUS_LABELS[place.halalStatus] : null;

  return (
    <li>
      <button
        type="button"
        className={`place-card${selected ? " selected" : ""}`}
        aria-pressed={selected}
        aria-label={`${place.name}, ${place.city}`}
        onClick={() => onSelect(place.id)}
      >
        <div className="place-card-top">
          <span className="place-card-name">
            <span aria-hidden="true">{categoryEmoji(place.type)} </span>
            {place.name}
          </span>
          {typeof place.rating === "number" && (
            <span className="place-card-rating">
              <Star size={13} fill="currentColor" strokeWidth={0} aria-hidden="true" />
              {place.rating.toFixed(1)}
            </span>
          )}
        </div>
        <div className="place-card-meta">
          {halalLabel && (
            <>
              <span
                className="halal-dot"
                style={{ background: HALAL_STATUS_DOT[place.halalStatus!] }}
                aria-hidden="true"
              />
              <span>{halalLabel}</span>
            </>
          )}
          {typeof place.reviewCount === "number" && (
            <span aria-label={`${place.reviewCount} reviews`}>· {place.reviewCount} reviews</span>
          )}
          {place.distanceLabel && (
            <span>
              · <MapPin size={11} style={{ verticalAlign: -1 }} aria-hidden="true" />{" "}
              {place.distanceLabel}
            </span>
          )}
        </div>
        <div className="place-card-sub">
          {[cuisineLine, `${place.city}, ${shortProvince(place.province)}`]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </button>
    </li>
  );
});

function shortProvince(province: string): string {
  const map: Record<string, string> = {
    Ontario: "ON",
    Quebec: "QC",
    Alberta: "AB",
    "British Columbia": "BC",
    Manitoba: "MB",
    Saskatchewan: "SK",
    "Nova Scotia": "NS",
  };
  return map[province] ?? province;
}
