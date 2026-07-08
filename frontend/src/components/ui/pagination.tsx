'use client';

interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, total, limit, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="px-4 py-2 text-sm border border-card rounded-lg disabled:opacity-50 hover:bg-card-hover"
      >
        Previous
      </button>
      <span className="text-sm text-foreground opacity-50">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-4 py-2 text-sm border border-card rounded-lg disabled:opacity-50 hover:bg-card-hover"
      >
        Next
      </button>
    </div>
  );
}
