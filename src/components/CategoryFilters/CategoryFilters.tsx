import { CATEGORIES } from "../../utils/categories";
import type { CategoryFilter } from "../../types/place";

interface CategoryFiltersProps {
  selected: CategoryFilter;
  onSelect: (category: CategoryFilter) => void;
}

export function CategoryFilters({ selected, onSelect }: CategoryFiltersProps) {
  const options: { value: CategoryFilter; label: string; emoji?: string }[] = [
    { value: "all", label: "All" },
    ...CATEGORIES.map((c) => ({ value: c.value as CategoryFilter, label: c.label, emoji: c.emoji })),
  ];

  return (
    <section className="side-section" aria-label="Category filters">
      <h2 id="category-heading">Category</h2>
      <div className="chip-row" role="group" aria-labelledby="category-heading">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="chip"
            aria-pressed={selected === option.value}
            onClick={() => onSelect(option.value)}
          >
            {option.emoji && (
              <span className="chip-emoji" aria-hidden="true">
                {option.emoji}
              </span>
            )}
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
