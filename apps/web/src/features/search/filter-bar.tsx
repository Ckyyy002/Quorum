import { SlidersHorizontal, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Shared size for every control in the filter panel, so search, selects and dates line up. */
export const filterControlClass = 'h-9 w-full';

/** A small caption above one control; wrapping the control in <label> names it for screen readers. */
export function FilterField(props: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {props.label}
      {props.children}
    </label>
  );
}

/**
 * Search box always visible; the other filters sit in a panel behind a "Filter" button so the list keeps
 * the space. The panel starts open when a filter is already set, so an active filter is never hidden.
 */
export function FilterBar(props: {
  search: { value: string; placeholder: string; onChange: (q: string | undefined) => void };
  /** The page's query; every set value except the search text and the page counts as an active filter. */
  query: object;
  onReset: () => void;
  children: ReactNode;
}) {
  const active = Object.entries(props.query).filter(
    ([k, v]) => k !== 'q' && k !== 'page' && v !== undefined,
  ).length;
  const [open, setOpen] = useState(active > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Input
          type="search"
          className="h-9 min-w-48 flex-1"
          placeholder={props.search.placeholder}
          aria-label={props.search.placeholder}
          value={props.search.value}
          onChange={(e) => props.search.onChange(e.target.value || undefined)}
        />
        <Button
          type="button"
          variant="outline"
          size="lg"
          // Same white face and edge as the search box; the default outline button blends into the page.
          className="border-input bg-card"
          aria-expanded={open}
          aria-controls="filter-panel"
          onClick={() => setOpen((o) => !o)}
        >
          <SlidersHorizontal />
          Filter
          {active > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {active}
            </span>
          )}
        </Button>
        {active > 0 && (
          <Button type="button" variant="ghost" size="lg" onClick={props.onReset}>
            <X /> Reset
          </Button>
        )}
      </div>
      {open && (
        <div
          id="filter-panel"
          // Tinted panel, so the white fields inside stand out and the panel stands apart from the page.
          className="grid gap-3 rounded-xl border border-input/40 bg-muted p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {props.children}
        </div>
      )}
    </div>
  );
}
