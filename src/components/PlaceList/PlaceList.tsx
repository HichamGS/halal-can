import type { PlaceDTO } from "../../services/distanceService";
import { PlaceCard } from "./PlaceCard";

interface PlaceListProps {
  places: PlaceDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PlaceList({ places, selectedId, onSelect }: PlaceListProps) {
  return (
    <ul className="place-list" aria-label="Place results">
      {places.map((place) => (
        <PlaceCard
          key={place.id}
          place={place}
          selected={place.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}
