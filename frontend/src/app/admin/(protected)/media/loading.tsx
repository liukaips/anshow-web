export default function AdminMediaLoading() {
  return (
    <div aria-busy="true" aria-label="正在加载媒体库" className="px-4 py-7 sm:px-8 sm:py-9" role="status">
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="h-4 w-28 bg-neutral-200" />
        <div className="mt-3 h-8 w-52 max-w-full bg-neutral-200" />
        <div className="mt-8 h-32 w-full bg-neutral-200" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="h-80 bg-neutral-200" />
          <div className="h-80 bg-neutral-200" />
        </div>
      </div>
    </div>
  );
}
