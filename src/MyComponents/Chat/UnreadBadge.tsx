/**
 * UnreadBadge.tsx — Small red badge for sidebar nav and chat lists.
 *
 * Shows count if > 0, hides if 0. Caps display at "99+".
 */

interface Props {
  count: number;
  className?: string;
}

export const UnreadBadge: React.FC<Props> = ({ count, className = "" }) => {
  if (count <= 0) return null;
  const display = count > 99 ? "99+" : count.toString();

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full leading-none ${className}`}
    >
      {display}
    </span>
  );
};
