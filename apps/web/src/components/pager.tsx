import { buttonVariants } from '@/components/ui/button';

/** Previous / next for a paginated list (`meta` from the API's `{ data, meta }`). Hidden for one page. */
export function Pager(props: {
  meta: { page: number; totalPages: number } | undefined;
  onPage: (page: number) => void;
}) {
  const { meta } = props;
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <nav aria-label="Halaman" className="flex items-center gap-3 text-sm">
      <button
        type="button"
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
        disabled={meta.page <= 1}
        onClick={() => props.onPage(meta.page - 1)}
      >
        Sebelumnya
      </button>
      <span>
        Halaman {meta.page} dari {meta.totalPages}
      </span>
      <button
        type="button"
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
        disabled={meta.page >= meta.totalPages}
        onClick={() => props.onPage(meta.page + 1)}
      >
        Berikutnya
      </button>
    </nav>
  );
}
