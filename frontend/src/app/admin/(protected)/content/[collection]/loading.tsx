export default function AdminContentLoading() {
  return (
    <div aria-busy="true" aria-label="正在加载内容列表" className="px-4 py-7 sm:px-8 sm:py-9" role="status">
      <p className="sr-only" role="status">
        正在加载内容
      </p>
      <div className="mx-auto max-w-7xl animate-pulse motion-reduce:animate-none">
        <div className="h-4 w-32 bg-neutral-200" />
        <div className="mt-3 h-8 w-64 max-w-full bg-neutral-200" />
        <div className="mt-8 h-16 w-full bg-neutral-200" />
        <div className="mt-4 h-52 w-full bg-neutral-200" />
      </div>
    </div>
  );
}
