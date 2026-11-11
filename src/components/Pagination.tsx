import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Page } from "@/lib/pagination";

/** Previous / next controls with a "11–20 of 47" summary. Renders nothing for a single page. */
export function Pagination({
  page,
  onPage,
  className = "",
}: {
  page: Pick<Page<unknown>, "page" | "pages" | "from" | "to" | "total">;
  onPage: (p: number) => void;
  className?: string;
}) {
  if (page.pages <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className={`flex flex-wrap items-center justify-between gap-2 pt-3 text-sm ${className}`}
    >
      <p className="order-2 w-full text-center text-xs text-muted-foreground sm:order-1 sm:w-auto sm:text-left">
        Showing {page.from}–{page.to} of {page.total}
      </p>
      <div className="order-1 flex w-full items-center justify-between gap-2 sm:order-2 sm:w-auto sm:justify-end">
        <Button
          size="sm"
          variant="outline"
          disabled={page.page <= 1}
          onClick={() => onPage(page.page - 1)}
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <span className="px-1 tabular-nums text-muted-foreground">
          Page {page.page} of {page.pages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page.page >= page.pages}
          onClick={() => onPage(page.page + 1)}
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
