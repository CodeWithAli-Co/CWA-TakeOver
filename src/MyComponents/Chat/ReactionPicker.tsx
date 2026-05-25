/**
 * ReactionPicker.tsx — Quick emoji reaction popover.
 *
 * Shows 8 quick-pick emojis horizontally. Calls onPick with the selected emoji.
 */

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "🔥", "👀", "🙏", "💯"];

interface Props {
  onPick: (emoji: string) => void;
}

export const ReactionPicker: React.FC<Props> = ({ onPick }) => {
  return (
    <div className="flex items-center gap-0.5 p-1 bg-[#0f0f0f] border border-border rounded-sm shadow-lg">
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onPick(emoji)}
          className="p-1.5 rounded-sm hover:bg-muted/60 text-base leading-none transition-colors"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};
