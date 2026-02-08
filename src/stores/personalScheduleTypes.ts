// src/stores/personalScheduleTypes.ts

export interface PersonalActivity {
  id: string;
  title: string;
  type:
    | "learning"
    | "medication"
    | "workout"
    | "family"
    | "meal"
    | "nap"
    | "work"
    | "custom";
  time: string;
  duration: number;
  description?: string;
  is_recurring: boolean;
  recurring_days?: number[];
  reminder_minutes?: number;
  notes?: string;
  completed?: boolean;
  completed_at?: string;
}

export interface HalalRestaurant {
  id: string;
  name: string;
  cuisine:
    | "american"
    | "asian"
    | "mexican"
    | "middle-eastern"
    | "italian"
    | "indian"
    | "mediterranean"
    | "african"
    | "other";
  address: string;
  phone_number?: string;
  website?: string;
  notes?: string;
  rating?: number;
  price_range?: "$" | "$$" | "$$$" | "$$$$";
  is_favorite?: boolean;
  tags?: string[];
  last_visited?: string;
}

export const ACTIVITY_TYPES = {
  medication: {
    color: "bg-red-500",
    label: "Medication",
    lightColor: "bg-red-100",
    darkColor: "bg-red-900/30",
    textColor: "text-red-600",
    icon: "💊",
  },
  workout: {
    color: "bg-orange-500",
    label: "Workout",
    lightColor: "bg-orange-100",
    darkColor: "bg-orange-900/30",
    textColor: "text-orange-600",
    icon: "💪",
  },
  learning: {
    color: "bg-blue-500",
    label: "Learning",
    lightColor: "bg-blue-100",
    darkColor: "bg-blue-900/30",
    textColor: "text-blue-600",
    icon: "📚",
  },
  family: {
    color: "bg-pink-500",
    label: "Family",
    lightColor: "bg-pink-100",
    darkColor: "bg-pink-900/30",
    textColor: "text-pink-600",
    icon: "👨‍👩‍👦",
  },
  meal: {
    color: "bg-green-500",
    label: "Meal",
    lightColor: "bg-green-100",
    darkColor: "bg-green-900/30",
    textColor: "text-green-600",
    icon: "🍽️",
  },
  nap: {
    color: "bg-purple-500",
    label: "Nap",
    lightColor: "bg-purple-100",
    darkColor: "bg-purple-900/30",
    textColor: "text-purple-600",
    icon: "😴",
  },
  work: {
    color: "bg-cyan-500",
    label: "Work",
    lightColor: "bg-cyan-100",
    darkColor: "bg-cyan-900/30",
    textColor: "text-cyan-600",
    icon: "💼",
  },
  custom: {
    color: "bg-gray-500",
    label: "Custom",
    lightColor: "bg-gray-100",
    darkColor: "bg-gray-900/30",
    textColor: "text-gray-600",
    icon: "📌",
  },
};

export const CUISINE_TYPES = {
  asian: { label: "Asian", icon: "🥢", color: "bg-red-500" },
  mexican: { label: "Mexican", icon: "🌮", color: "bg-yellow-500" },
  "middle-eastern": {
    label: "Middle Eastern",
    icon: "🥙",
    color: "bg-orange-500",
  },
  american: { label: "American", icon: "🍔", color: "bg-blue-500" },
  italian: { label: "Italian", icon: "🍝", color: "bg-green-500" },
  indian: { label: "Indian", icon: "🍛", color: "bg-pink-500" },
  mediterranean: { label: "Mediterranean", icon: "🥗", color: "bg-teal-500" },
  african: { label: "African", icon: "🍲", color: "bg-purple-500" },
  other: { label: "Other", icon: "🍴", color: "bg-gray-500" },
};

export const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const AMPM = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${AMPM}`;
};

export const parseTime = (time: string): { hours: number; minutes: number } => {
  const [hours, minutes] = time.split(":").map(Number);
  return {
    hours,
    minutes,
  };
};

export const addMinutesToTime = (
  time: string,
  minutesToAdd: number
): string => {
  const { hours, minutes } = parseTime(time);
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMinutes = Math.floor(totalMinutes % 60);
  return `${String(newHours).padStart(2, "0")}:${String(newMinutes).padStart(2, "0")}`;
};

export const isActivityDueToday = (
  activity: PersonalActivity,
  date: Date = new Date()
): boolean => {
  if (!activity.is_recurring) return true;

  if (!activity.recurring_days || activity.recurring_days.length === 0)
    return true;

  return activity.recurring_days.includes(date.getDay());
};

export const getActivitiesForToday = (
  activities: PersonalActivity[]
): PersonalActivity[] => {
  const today = new Date();
  return activities
    .filter((activity) => isActivityDueToday(activity, today))
    .sort((a, b) => a.time.localeCompare(b.time));
};

export const getActivityForDate = (
  activities: PersonalActivity[],
  date: Date
): PersonalActivity[] => {
  return activities
    .filter((activity) => isActivityDueToday(activity, date))
    .sort((a, b) => a.time.localeCompare(b.time));
};

export const getWeekDays = (startDate: Date = new Date()): Date[] => {
  const days: Date[] = [];
  const start = new Date(startDate);
  start.setDate(start.getDate() - start.getDay()); // Starts from Sunday
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }

  return days;
};

export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
};

export const getUpcomingActivities = (
  activities: PersonalActivity[],
  limit: number = 5
): PersonalActivity[] => {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return activities
    .filter((activity) => activity.time >= currentTime)
    .slice(0, limit); // Come back to this to set the limit higher or lower
};

export const shouldShowReminder = (activity: PersonalActivity): boolean => {
  if (!activity.reminder_minutes) return false;

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const { hours, minutes } = parseTime(activity.time);
  const activityDate = new Date(now);
  activityDate.setHours(hours, minutes, 0, 0);

  const reminderTime = new Date(
    (activityDate.getTime() - activity.reminder_minutes) * 60000
  );
  const currentDate = new Date();

  // Shows if reminder is within 1 minute of reminder time
  const timeDiff = Math.abs(currentDate.getTime() - reminderTime.getTime());
  return timeDiff < 60000;
};

export const getRestaurantsByCuisine = (
  restaurants: HalalRestaurant[],
  cuisine: HalalRestaurant["cuisine"]
): HalalRestaurant[] => {
  return restaurants.filter((rest) => rest.cuisine === cuisine);
};

export const getFavoriteRestaurants = (
  restaurants: HalalRestaurant[]
): HalalRestaurant[] => {
  return restaurants.filter((rest) => rest.is_favorite);
};

export const searchRestaurants = (
  restaurants: HalalRestaurant[],
  query: string
): HalalRestaurant[] => {
  const lowercaseQuery = query.toLowerCase();
  return restaurants.filter(
    (rest) =>
      rest.name.toLowerCase().includes(lowercaseQuery) ||
      rest.address.toLowerCase().includes(lowercaseQuery) ||
      rest.price_range?.toLowerCase().includes(lowercaseQuery) ||
      rest.notes?.toLowerCase().includes(lowercaseQuery) ||
      rest.cuisine.toLowerCase().includes(lowercaseQuery) ||
      rest.tags?.includes(lowercaseQuery)
  );
};

// Default schedule based on user's requirements
export const getDefaultSchedule = (): PersonalActivity[] => {
  return [
    {
      id: "morning-minoxidil",
      title: "Minoxidil + Finasteride",
      type: "medication",
      time: "07:00",
      duration: 5,
      description:
        "Apply Minoxidil and take Finasteride. Not recommended before workout or bed.",
      is_recurring: true,
      recurring_days: [0, 1, 2, 3, 4, 5, 6], // Every day
      reminder_minutes: 10,
      notes: "Right after waking up",
    },
    {
      id: "morning-rust-learning",
      title: "Rust Learning",
      type: "learning",
      time: "08:00",
      duration: 180, // 3 hours
      description: "Deep dive into Rust programming concepts",
      is_recurring: true,
      recurring_days: [1, 2, 3, 4, 5], // Weekdays
      reminder_minutes: 5,
    },
    {
      id: "family-call",
      title: "Call Family",
      type: "family",
      time: "09:00",
      duration: 30,
      description: "Call Ali's Family (9AM EST = 8PM their time)",
      is_recurring: true,
      recurring_days: [0, 1, 2, 3, 4, 5, 6], // Every day
      reminder_minutes: 5,
      notes: "Before 9AM max because of time difference",
    },
    {
      id: "morning-nap",
      title: "Power Nap",
      type: "nap",
      time: "11:00",
      duration: 30,
      description: "Short power nap to recharge",
      is_recurring: true,
      recurring_days: [1, 2, 3, 4, 5], // Weekdays
    },
    {
      id: "rust-coding",
      title: "Rust Coding Practice",
      type: "learning",
      time: "11:30",
      duration: 180, // 3 hours
      description: "Hands-on Rust coding and projects",
      is_recurring: true,
      recurring_days: [1, 2, 3, 4, 5], // Weekdays
      reminder_minutes: 5,
    },
    {
      id: "lunch-break",
      title: "Lunch Break",
      type: "meal",
      time: "14:30",
      duration: 60,
      description: "Halal meal",
      is_recurring: true,
      recurring_days: [0, 1, 2, 3, 4, 5, 6], // Every day
      reminder_minutes: 10,
    },
    {
      id: "simplicity-work",
      title: "Simplicity Development",
      type: "work",
      time: "15:30",
      duration: 180, // 3 hours
      description: "Work on Simplicity CLI project",
      is_recurring: true,
      recurring_days: [1, 2, 3, 4, 5], // Weekdays
      reminder_minutes: 5,
    },
    {
      id: "gym-session",
      title: "Gym Workout",
      type: "workout",
      time: "18:30",
      duration: 90,
      description: "Gym session - Take Creatine right after",
      is_recurring: true,
      recurring_days: [1, 2, 3, 4, 5], // Weekdays
      reminder_minutes: 15,
      notes: "Take Creatine immediately after workout",
    },
    {
      id: "post-workout-creatine",
      title: "Take Creatine",
      type: "medication",
      time: "20:00",
      duration: 5,
      description: "Post-workout Creatine supplement",
      is_recurring: true,
      recurring_days: [1, 2, 3, 4, 5], // Gym days
      reminder_minutes: 5,
      notes: "Right after gym",
    },
    {
      id: "financial-aid-check",
      title: "Check School Financial Aid",
      type: "custom",
      time: "20:30",
      duration: 30,
      description: "Review and manage school financial aid status",
      is_recurring: true,
      recurring_days: [1, 3, 5], // Mon, Wed, Fri
      reminder_minutes: 10,
    },
  ];
};
