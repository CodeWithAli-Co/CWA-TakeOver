/**
 * EmojiPicker.tsx — Full emoji picker popover.
 *
 * Curated list across 8 categories, recent-emojis row, search, hover
 * label. No npm dependency — emojis are inlined below.
 */

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Search, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chatStore";

interface Props {
  onPick: (emoji: string) => void;
  onClose?: () => void;
}

// ── Curated emoji dataset ------------------------------------------------
// Each entry is [emoji, searchable-name]. Names are lower-cased for matching.
// Trimmed set — ~250 high-signal emojis, not the full Unicode dump.

type Emoji = readonly [string, string];

const SMILEYS: Emoji[] = [
  ["😀", "grinning smile happy"],
  ["😃", "smile happy"],
  ["😄", "smile happy eyes"],
  ["😁", "beaming smile"],
  ["😆", "laugh"],
  ["😅", "sweat smile"],
  ["🤣", "rofl laugh rolling"],
  ["😂", "lol joy cry"],
  ["🙂", "slight smile"],
  ["🙃", "upside down"],
  ["😉", "wink"],
  ["😊", "blush smile"],
  ["😇", "angel innocent"],
  ["😍", "heart eyes love"],
  ["🥰", "in love"],
  ["😘", "kiss"],
  ["😗", "kiss face"],
  ["😙", "kiss smile"],
  ["😚", "kiss close eyes"],
  ["😋", "yum tongue"],
  ["😛", "tongue out"],
  ["😜", "wink tongue"],
  ["🤪", "zany silly"],
  ["😝", "tongue closed eyes"],
  ["🤑", "money face"],
  ["🤗", "hug"],
  ["🤭", "giggle"],
  ["🤫", "shh quiet"],
  ["🤔", "thinking"],
  ["🤨", "raised eyebrow"],
  ["😐", "neutral"],
  ["😑", "expressionless"],
  ["😶", "no mouth"],
  ["😏", "smirk"],
  ["😒", "unamused"],
  ["🙄", "eye roll"],
  ["😬", "grimace"],
  ["🤥", "lying"],
  ["😌", "relieved"],
  ["😔", "pensive"],
  ["😪", "sleepy"],
  ["🤤", "drool"],
  ["😴", "sleep"],
  ["😷", "mask sick"],
  ["🤒", "thermometer sick"],
  ["🤕", "bandage hurt"],
  ["🤢", "nauseated"],
  ["🤮", "vomit"],
  ["🤧", "sneeze"],
  ["🥵", "hot sweat"],
  ["🥶", "cold freeze"],
  ["🥴", "woozy"],
  ["😵", "dizzy"],
  ["🤯", "mind blown"],
  ["🤠", "cowboy"],
  ["🥳", "party face"],
  ["😎", "cool sunglasses"],
  ["🤓", "nerd glasses"],
  ["🧐", "monocle"],
  ["😕", "confused"],
  ["😟", "worried"],
  ["🙁", "slight frown"],
  ["☹️", "frown"],
  ["😮", "o mouth surprise"],
  ["😯", "hushed"],
  ["😲", "astonished"],
  ["😳", "flushed"],
  ["🥺", "pleading"],
  ["😦", "frown open"],
  ["😧", "anguished"],
  ["😨", "fearful"],
  ["😰", "anxious sweat"],
  ["😥", "sad relief"],
  ["😢", "cry sad"],
  ["😭", "sob cry loud"],
  ["😱", "scream fear"],
  ["😖", "confounded"],
  ["😣", "persevere"],
  ["😞", "disappointed"],
  ["😓", "sweat"],
  ["😩", "weary"],
  ["😫", "tired"],
  ["😤", "huff triumph"],
  ["😡", "rage angry"],
  ["😠", "angry"],
  ["🤬", "curse swear"],
  ["😈", "smile devil"],
  ["👿", "devil angry"],
  ["💀", "skull"],
  ["☠️", "skull crossbones"],
  ["👻", "ghost"],
  ["👽", "alien"],
  ["🤖", "robot"],
  ["👋", "wave hand"],
  ["🤚", "raised back hand"],
  ["✋", "raised hand"],
  ["👌", "ok hand"],
  ["🤏", "pinch"],
  ["✌️", "peace victory"],
  ["🤞", "crossed fingers"],
  ["🤟", "love you"],
  ["🤘", "rock metal"],
  ["🤙", "call me shaka"],
  ["👍", "thumbs up yes"],
  ["👎", "thumbs down no"],
  ["✊", "fist"],
  ["👊", "punch"],
  ["🤛", "fist bump left"],
  ["🤜", "fist bump right"],
  ["👏", "clap"],
  ["🙌", "raise hands celebrate"],
  ["👐", "open hands"],
  ["🤲", "palms up"],
  ["🙏", "pray thanks please"],
  ["✍️", "write"],
  ["💪", "flex muscle"],
];

const NATURE: Emoji[] = [
  ["🐶", "dog puppy"],
  ["🐱", "cat"],
  ["🐭", "mouse"],
  ["🐹", "hamster"],
  ["🐰", "rabbit"],
  ["🦊", "fox"],
  ["🐻", "bear"],
  ["🐼", "panda"],
  ["🐨", "koala"],
  ["🐯", "tiger"],
  ["🦁", "lion"],
  ["🐷", "pig"],
  ["🐸", "frog"],
  ["🐵", "monkey"],
  ["🙈", "see no evil"],
  ["🙉", "hear no evil"],
  ["🙊", "speak no evil"],
  ["🐣", "hatching chick"],
  ["🐔", "chicken"],
  ["🐧", "penguin"],
  ["🐦", "bird"],
  ["🦅", "eagle"],
  ["🦆", "duck"],
  ["🦉", "owl"],
  ["🦇", "bat"],
  ["🐺", "wolf"],
  ["🐗", "boar"],
  ["🐴", "horse face"],
  ["🦄", "unicorn"],
  ["🐝", "bee"],
  ["🐛", "bug"],
  ["🦋", "butterfly"],
  ["🐌", "snail"],
  ["🐞", "ladybug"],
  ["🕷️", "spider"],
  ["🦂", "scorpion"],
  ["🐢", "turtle"],
  ["🐍", "snake"],
  ["🦎", "lizard"],
  ["🐙", "octopus"],
  ["🦑", "squid"],
  ["🦐", "shrimp"],
  ["🦞", "lobster"],
  ["🦀", "crab"],
  ["🐳", "whale"],
  ["🐬", "dolphin"],
  ["🐟", "fish"],
  ["🌲", "tree evergreen"],
  ["🌳", "tree"],
  ["🌴", "palm tree"],
  ["🌵", "cactus"],
  ["🌹", "rose"],
  ["🌻", "sunflower"],
  ["🌼", "flower"],
  ["🌷", "tulip"],
  ["☀️", "sun"],
  ["⭐", "star"],
  ["🌙", "moon"],
  ["🌎", "earth"],
  ["🔥", "fire flame lit"],
  ["💧", "water drop"],
  ["🌊", "wave ocean"],
  ["❄️", "snowflake"],
  ["⛄", "snowman"],
  ["⚡", "lightning"],
  ["☁️", "cloud"],
  ["🌈", "rainbow"],
];

const FOOD: Emoji[] = [
  ["🍎", "apple red"],
  ["🍊", "orange"],
  ["🍋", "lemon"],
  ["🍌", "banana"],
  ["🍉", "watermelon"],
  ["🍇", "grapes"],
  ["🍓", "strawberry"],
  ["🍒", "cherry"],
  ["🍑", "peach"],
  ["🥭", "mango"],
  ["🍍", "pineapple"],
  ["🥥", "coconut"],
  ["🥝", "kiwi"],
  ["🍅", "tomato"],
  ["🥑", "avocado"],
  ["🌶️", "pepper hot"],
  ["🌽", "corn"],
  ["🥕", "carrot"],
  ["🥔", "potato"],
  ["🍞", "bread"],
  ["🥐", "croissant"],
  ["🥯", "bagel"],
  ["🧀", "cheese"],
  ["🥓", "bacon"],
  ["🍗", "chicken leg"],
  ["🍖", "meat"],
  ["🍔", "burger"],
  ["🍟", "fries"],
  ["🍕", "pizza"],
  ["🌭", "hotdog"],
  ["🌮", "taco"],
  ["🌯", "burrito"],
  ["🥗", "salad"],
  ["🥘", "paella"],
  ["🍜", "ramen noodles"],
  ["🍣", "sushi"],
  ["🍱", "bento"],
  ["🍚", "rice"],
  ["🍙", "rice ball"],
  ["🍡", "dango"],
  ["🍦", "ice cream"],
  ["🍩", "donut"],
  ["🍪", "cookie"],
  ["🎂", "cake birthday"],
  ["🧁", "cupcake"],
  ["🍫", "chocolate"],
  ["🍿", "popcorn"],
  ["☕", "coffee"],
  ["🍵", "tea"],
  ["🧋", "boba"],
  ["🍺", "beer"],
  ["🍷", "wine"],
  ["🥂", "cheers champagne"],
  ["🍹", "cocktail"],
  ["🥤", "soda cup"],
];

const ACTIVITY: Emoji[] = [
  ["⚽", "soccer ball"],
  ["🏀", "basketball"],
  ["🏈", "football american"],
  ["⚾", "baseball"],
  ["🎾", "tennis"],
  ["🏐", "volleyball"],
  ["🎱", "pool billiards"],
  ["🏓", "ping pong"],
  ["🏸", "badminton"],
  ["🏒", "hockey"],
  ["🥊", "boxing gloves"],
  ["🥋", "martial arts"],
  ["⛳", "golf"],
  ["🎯", "bullseye target"],
  ["🎳", "bowling"],
  ["🎮", "video game"],
  ["🕹️", "joystick"],
  ["🎲", "dice"],
  ["♟️", "chess"],
  ["🎨", "art palette"],
  ["🎭", "theater"],
  ["🎤", "microphone"],
  ["🎧", "headphones"],
  ["🎼", "music score"],
  ["🎹", "piano"],
  ["🥁", "drum"],
  ["🎷", "saxophone"],
  ["🎸", "guitar"],
  ["🎺", "trumpet"],
  ["🎻", "violin"],
];

const TRAVEL: Emoji[] = [
  ["🚗", "car"],
  ["🚕", "taxi"],
  ["🚙", "suv"],
  ["🚌", "bus"],
  ["🚎", "trolley"],
  ["🏎️", "racecar"],
  ["🚓", "police"],
  ["🚑", "ambulance"],
  ["🚒", "firetruck"],
  ["🛻", "pickup truck"],
  ["🚚", "delivery truck"],
  ["🚲", "bicycle"],
  ["🛴", "scooter"],
  ["🏍️", "motorcycle"],
  ["✈️", "plane"],
  ["🚀", "rocket launch"],
  ["🛸", "ufo"],
  ["🚁", "helicopter"],
  ["⛵", "sailboat"],
  ["🚤", "speedboat"],
  ["🛥️", "motor boat"],
  ["🚢", "ship"],
  ["🏠", "house"],
  ["🏢", "office"],
  ["🏭", "factory"],
  ["🌆", "sunset city"],
  ["🌇", "city sunrise"],
  ["🌉", "bridge"],
  ["🗽", "liberty"],
  ["🗼", "tokyo tower"],
  ["🗺️", "map world"],
];

const OBJECTS: Emoji[] = [
  ["⌚", "watch"],
  ["📱", "phone"],
  ["💻", "laptop"],
  ["⌨️", "keyboard"],
  ["🖥️", "desktop"],
  ["🖨️", "printer"],
  ["🖱️", "mouse computer"],
  ["💾", "floppy"],
  ["💿", "cd"],
  ["📀", "dvd"],
  ["📸", "camera flash"],
  ["📷", "camera"],
  ["🎥", "movie camera"],
  ["🎬", "clapper"],
  ["📺", "tv"],
  ["📻", "radio"],
  ["🔋", "battery"],
  ["🔌", "plug"],
  ["💡", "idea lightbulb"],
  ["🔦", "flashlight"],
  ["🕯️", "candle"],
  ["🧯", "extinguisher"],
  ["🛢️", "oil drum"],
  ["💰", "money bag"],
  ["💵", "dollar"],
  ["💳", "credit card"],
  ["🧾", "receipt"],
  ["📈", "chart up"],
  ["📉", "chart down"],
  ["📊", "bar chart"],
  ["📋", "clipboard"],
  ["📅", "calendar"],
  ["📆", "tear off calendar"],
  ["📝", "memo note"],
  ["✏️", "pencil"],
  ["📌", "pin"],
  ["📎", "paperclip"],
  ["🔒", "lock"],
  ["🔑", "key"],
  ["🔨", "hammer"],
  ["⚙️", "gear settings"],
  ["🔧", "wrench"],
  ["🔩", "nut bolt"],
  ["⚗️", "alembic"],
  ["🧪", "test tube"],
  ["🔬", "microscope"],
  ["💉", "syringe"],
  ["💊", "pill"],
  ["📚", "books"],
  ["📖", "book open"],
  ["🎁", "gift"],
  ["🎈", "balloon"],
  ["🎉", "party popper"],
  ["🎊", "confetti ball"],
  ["🏆", "trophy"],
  ["🥇", "gold medal"],
  ["🎖️", "military medal"],
  ["🏅", "sports medal"],
];

const SYMBOLS: Emoji[] = [
  ["❤️", "red heart love"],
  ["🧡", "orange heart"],
  ["💛", "yellow heart"],
  ["💚", "green heart"],
  ["💙", "blue heart"],
  ["💜", "purple heart"],
  ["🖤", "black heart"],
  ["🤍", "white heart"],
  ["🤎", "brown heart"],
  ["💔", "broken heart"],
  ["❣️", "heart exclamation"],
  ["💕", "two hearts"],
  ["💞", "revolving hearts"],
  ["💓", "heartbeat"],
  ["💗", "growing heart"],
  ["💖", "sparkling heart"],
  ["💘", "heart arrow"],
  ["💝", "heart ribbon"],
  ["💟", "heart decoration"],
  ["☮️", "peace symbol"],
  ["✝️", "cross christian"],
  ["☯️", "yin yang"],
  ["⚛️", "atom"],
  ["🔯", "star david"],
  ["♾️", "infinity"],
  ["⚠️", "warning"],
  ["🚫", "prohibit"],
  ["✅", "check green"],
  ["❌", "cross red x"],
  ["❓", "question mark"],
  ["❗", "exclamation"],
  ["💯", "100"],
  ["🔔", "bell"],
  ["🔕", "bell muted"],
  ["🔊", "speaker loud"],
  ["🔇", "muted"],
  ["♻️", "recycle"],
  ["🆕", "new"],
  ["🆘", "sos"],
  ["🔝", "top"],
  ["✨", "sparkles"],
  ["⭕", "big red circle"],
  ["🔴", "red circle"],
  ["🟠", "orange circle"],
  ["🟡", "yellow circle"],
  ["🟢", "green circle"],
  ["🔵", "blue circle"],
  ["🟣", "purple circle"],
  ["⚫", "black circle"],
  ["⚪", "white circle"],
];

const CATEGORIES: { id: string; label: string; icon: string; list: Emoji[] }[] = [
  { id: "smileys", label: "Smileys & People", icon: "😀", list: SMILEYS },
  { id: "nature", label: "Nature", icon: "🌿", list: NATURE },
  { id: "food", label: "Food & Drink", icon: "🍔", list: FOOD },
  { id: "activity", label: "Activity", icon: "⚽", list: ACTIVITY },
  { id: "travel", label: "Travel", icon: "✈️", list: TRAVEL },
  { id: "objects", label: "Objects", icon: "💡", list: OBJECTS },
  { id: "symbols", label: "Symbols", icon: "❤️", list: SYMBOLS },
];

const ALL_EMOJIS = CATEGORIES.flatMap((c) => c.list);

// ── component -----------------------------------------------------------

export function EmojiPicker({ onPick, onClose }: Props) {
  const { recentEmojis, pushRecentEmoji } = useChatStore();
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>(
    recentEmojis.length > 0 ? "recent" : "smileys",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return null;
    const needle = query.toLowerCase();
    return ALL_EMOJIS.filter(([, name]) => name.includes(needle));
  }, [query]);

  const visible: Emoji[] = filtered
    ? filtered
    : activeCat === "recent"
      ? recentEmojis.map((e) => [e, ""] as Emoji)
      : CATEGORIES.find((c) => c.id === activeCat)?.list ?? [];

  const pick = (emoji: string) => {
    pushRecentEmoji(emoji);
    onPick(emoji);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="flex w-[340px] flex-col rounded-xl border border-border bg-card text-card-foreground"
      style={{ boxShadow: "0 20px 48px rgba(0,0,0,0.55)" }}
      role="dialog"
      aria-label="Emoji picker"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emoji…"
          className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          autoFocus
        />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            esc
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="max-h-[260px] overflow-y-auto p-2">
        {visible.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-muted-foreground">
            <Smile className="mx-auto mb-1 size-5 opacity-40" />
            No emoji for "{query}"
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-0.5">
            {visible.map(([emoji, name], i) => (
              <button
                key={`${emoji}-${i}`}
                type="button"
                onClick={() => pick(emoji)}
                title={name || undefined}
                className="flex aspect-square items-center justify-center rounded text-lg transition-colors hover:bg-muted"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category tabs */}
      {!filtered && (
        <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
          <button
            type="button"
            onClick={() => setActiveCat("recent")}
            className={cn(
              "flex size-7 items-center justify-center rounded-md transition-colors",
              activeCat === "recent"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60",
            )}
            title="Recent"
            disabled={recentEmojis.length === 0}
          >
            <Clock className="size-3.5" />
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCat(c.id)}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-base transition-colors",
                activeCat === c.id
                  ? "bg-muted"
                  : "opacity-60 hover:bg-muted/60 hover:opacity-100",
              )}
              title={c.label}
            >
              {c.icon}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
