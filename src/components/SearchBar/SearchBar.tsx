import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

/** Controlled input with debounced propagation to keep filtering smooth. */
export function SearchBar({
  value,
  onChange,
  placeholder = "Search restaurants, mosques, grocery stores...",
  debounceMs = 200,
}: SearchBarProps) {
  const [text, setText] = useState(value);

  // Sync when an external change resets the query (e.g. filter reset).
  useEffect(() => setText(value), [value]);

  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChange(text), debounceMs);
    return () => clearTimeout(timer);
  }, [text, value, onChange, debounceMs]);

  return (
    <div className="searchbar" role="search">
      <span className="search-icon" aria-hidden="true">
        <Search size={15} />
      </span>
      <input
        type="search"
        value={text}
        placeholder={placeholder}
        aria-label="Search places"
        onChange={(e) => setText(e.target.value)}
      />
      {text && (
        <button
          type="button"
          className="clear-btn"
          aria-label="Clear search"
          onClick={() => setText("")}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
