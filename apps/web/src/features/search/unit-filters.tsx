import { Input } from '@/components/ui/input';
import { selectClass } from '@/features/org/org-forms';
import { usePeriods, useStructure } from '@/features/org/org-api';

/** Mirrors the API's EventRangeQueryDto (apps/api/src/common/event-range.dto.ts). */
export interface UnitFilterValues {
  kesekjenanId?: string;
  departmentId?: string;
  eventFrom?: string;
  eventTo?: string;
}

/**
 * Kesekjenan, department and event-day range (US-8.1, 8.2, 8.4). Options come from the active period's
 * structure, which every member may read; picking a kesekjenan narrows the department list.
 */
export function UnitFilters(props: {
  value: UnitFilterValues;
  onChange: (patch: UnitFilterValues) => void;
}) {
  const active = usePeriods().data?.find((p) => p.isActive);
  const structure = useStructure(active?.id).data;
  const { value } = props;
  const kesekjenan = structure?.kesekjenan ?? [];
  const departments = kesekjenan
    .filter((k) => !value.kesekjenanId || k.id === value.kesekjenanId)
    .flatMap((k) => k.departments);

  return (
    <>
      <select
        aria-label="Filter kesekjenan"
        className={selectClass}
        value={value.kesekjenanId ?? ''}
        // A department from another kesekjenan would match nothing, so it is cleared too.
        onChange={(e) =>
          props.onChange({ kesekjenanId: e.target.value || undefined, departmentId: undefined })
        }
      >
        <option value="">Semua kesekjenan</option>
        {kesekjenan.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter departemen"
        className={selectClass}
        value={value.departmentId ?? ''}
        onChange={(e) => props.onChange({ departmentId: e.target.value || undefined })}
      >
        <option value="">Semua departemen</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <Input
        type="date"
        aria-label="Acara mulai tanggal"
        title="Acara mulai tanggal"
        value={value.eventFrom ?? ''}
        onChange={(e) => props.onChange({ eventFrom: e.target.value || undefined })}
      />
      <Input
        type="date"
        aria-label="Acara sampai tanggal"
        title="Acara sampai tanggal"
        value={value.eventTo ?? ''}
        onChange={(e) => props.onChange({ eventTo: e.target.value || undefined })}
      />
    </>
  );
}
