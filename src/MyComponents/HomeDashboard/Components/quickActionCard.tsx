import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";

/**
 * QuickActionCard — single nav item in the dashboard header strip.
 *
 * Active / idle styling follows the design spec:
 *
 *   active : bg-surface-2 text-fg   + icon text-primary  (was text-accent)
 *   idle   : bg-transparent text-fg-muted
 *            hover:bg-surface hover:text-fg
 *
 * "Active" is determined by route match — if the user is currently on
 * the URL the card links to (or a subpath of it), the active styling
 * is applied. On the home route nothing matches, so the strip reads
 * as all-idle there; the styling is in place for when this header
 * sits above sub-routes.
 *
 * Note on the colour token: the design spec wrote `text-accent` for
 * the active icon. We use `text-primary` because the existing
 * `text-accent` Tailwind class resolves to a muted-grey hover surface
 * used by ~13 shadcn components (dropdown focus, calendar day
 * selected, billing button hover). Since `--primary` is now the
 * refined coral-red, the visual effect is identical to the spec.
 */
export const QuickActionCard = ({
  title,
  icon: Icon,
  url,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  url: string;
}) => {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Active when pathname === url, OR url is a proper prefix of
  // pathname. The root "/" only matches itself so home doesn't
  // claim ownership of every nav item via prefix matching.
  const active =
    url === "/"
      ? pathname === "/"
      : pathname === url || pathname.startsWith(url + "/");

  return (
    <Link to={`${url}`} from="/" draggable={false}>
      <motion.div
        whileTap={{ scale: 0.97 }}
        aria-current={active ? "page" : undefined}
        className={[
          // Compact chip sized for the 56px header bar. Editorial
          // accent: hover and active states tint emerald to match
          // the sidebar / dashboard accent language instead of the
          // generic shadcn surface tokens.
          "inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md",
          "transition-colors duration-150 cursor-pointer group",
          active
            ? "bg-emerald-500/[0.08] text-emerald-200"
            : "bg-transparent text-zinc-400 hover:bg-emerald-500/[0.04] hover:text-emerald-200",
        ].join(" ")}
      >
        <Icon
          className={[
            "h-3.5 w-3.5 transition-colors",
            active ? "text-emerald-300" : "text-zinc-500 group-hover:text-emerald-300/80",
          ].join(" ")}
        />
        <span className="text-[11.5px] font-medium whitespace-nowrap leading-none tracking-tight">
          {title}
        </span>
      </motion.div>
    </Link>
  );
};
