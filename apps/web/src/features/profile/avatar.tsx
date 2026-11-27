import { cn } from '@/lib/utils';
import { useAvatarUrl } from './profile-api';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

/** The member's picture, or their initials until one is uploaded (or while it loads). */
export function Avatar(props: {
  user: { id: string; name: string; avatarFileId: string | null };
  className?: string;
}) {
  const url = useAvatarUrl(props.user.id, props.user.avatarFileId);
  const box = cn('grid size-9 shrink-0 place-items-center rounded-full', props.className);
  return url ? (
    <img src={url} alt="" className={cn(box, 'object-cover')} />
  ) : (
    <span aria-hidden="true" className={cn(box, 'bg-chart-1 text-[13px] font-bold text-white')}>
      {initials(props.user.name)}
    </span>
  );
}
