/**
 * TypingIndicator.tsx — "X is typing..." display with animated dots.
 *
 * Filters out the current user and expired entries. Renders nothing if empty.
 */

import { motion } from "framer-motion";
import { useChatStore } from "@/stores/chatStore";

interface Props {
  group: string;
  currentUsername: string;
}

export const TypingIndicator: React.FC<Props> = ({ group, currentUsername }) => {
  const typingByGroup = useChatStore((s) => s.typingByGroup);
  const now = Date.now();
  const typers = (typingByGroup[group] || [])
    .filter((t) => t.username !== currentUsername && t.expiresAt > now)
    .map((t) => t.username);

  if (typers.length === 0) return null;

  const text =
    typers.length === 1 ? `${typers[0]} is typing` :
    typers.length === 2 ? `${typers[0]} and ${typers[1]} are typing` :
    `${typers.length} people are typing`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-2 px-4 py-1.5 text-[11px] text-white/40"
    >
      <span>{text}</span>
      <div className="flex items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            className="h-1 w-1 rounded-full bg-red-400"
          />
        ))}
      </div>
    </motion.div>
  );
};
