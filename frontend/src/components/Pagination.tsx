interface Props { page: number; pageSize: number; total: number; onPage: (p: number) => void }

export function Pagination({ page, pageSize, total, onPage }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
      <span>Page {page} of {pages} · {total} total</span>
      <div className="flex gap-2">
        <button type="button" className="btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button type="button" className="btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </nav>
  );
}
