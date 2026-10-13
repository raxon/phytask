import { Icon } from '../shared/ui/Icon';

export function PageLoading({ page }: { page: string }) {
  return (
    <div
      className="panel flex min-h-64 items-center justify-center gap-3 p-8 text-sm text-[#647b6d]"
      role="status"
      aria-live="polite"
    >
      <Icon name="clock" />
      <span>Loading {page}...</span>
    </div>
  );
}
