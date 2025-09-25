import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

// Enhanced Quick Action Card with animations
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
      whileHover={{ scale: 1.0 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
      className="flex items-center justify-between p-4 mb-5 bg-zinc-950/10 hover:bg-red-900/10 border border-red-900/30 rounded-lg hover:border-red-800/50 group"
    >
      <div className="flex items-center gap-2">
        <motion.div
          whileHover={{ scale: 1.1 }}
          className="p-2 rounded-lg bg-zinc-950/20"
        >
          <Icon className="h-5 w-5 text-red-500" />
        </motion.div>
        <div>
          <h3 className="text-sm font-medium text-amber-50 group-hover:text-amber-100">
            {title}
          </h3>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        whileHover={{ opacity: 1, x: 0 }}
        className="flex items-center gap-2"
      >
        {/* <ChevronRight className="h-4 w-4 text-red-500" /> */}
      </motion.div>
    </motion.div>
  </Link>
);
