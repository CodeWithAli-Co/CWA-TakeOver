import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

export const QuickActionCard = ({
  title,
  icon: Icon,
  url,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  url: string;
}) => (
  <Link to={`${url}`} from="/" draggable={false}>
    <motion.div
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      className="flex items-center gap-2 px-3.5 py-2 bg-muted/40 hover:bg-primary/[0.06] border border-border hover:border-primary/15 rounded-sm transition-all duration-300 cursor-pointer group"
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
      <span className="text-[12px] font-medium text-muted-foreground/60 group-hover:text-foreground/70 transition-colors whitespace-nowrap">
        {title}
      </span>
    </motion.div>
  </Link>
);
