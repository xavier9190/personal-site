export function PageLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="CARREGANDO..."
      className="flex flex-1 flex-col gap-4 bg-[#121212] p-4 text-[#f1f3f5] md:h-full md:p-6"
    >
      <div className="flex items-center justify-between border-b-2 border-[#f1f3f5]/30 pb-3">
        <div className="h-7 w-44 animate-pulse rounded-md border-2 border-dashed border-[#f1f3f5]/25" />
        <div className="h-10 w-28 animate-pulse rounded-md border-2 border-dashed border-[#f1f3f5]/25" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="h-20 animate-pulse rounded-md border-2 border-dashed border-[#f1f3f5]/25" />
        <div className="h-20 animate-pulse rounded-md border-2 border-dashed border-[#f1f3f5]/25" />
        <div className="h-20 animate-pulse rounded-md border-2 border-dashed border-[#f1f3f5]/25" />
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-h-[240px] animate-pulse rounded-md border-2 border-dashed border-[#f1f3f5]/25 lg:col-span-2" />
        <div className="min-h-[240px] animate-pulse rounded-md border-2 border-dashed border-[#f1f3f5]/25" />
      </div>
    </div>
  );
}
