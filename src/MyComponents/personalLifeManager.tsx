// src/MyComponents/personalLifeManager.tsx

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Search,
  Bell,
  Check,
  X,
  Edit,
  Trash2,
  MapPin,
  Phone,
  Globe,
  Star,
  Heart,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pill,
  Dumbbell,
  BookOpen,
  Users,
  Utensils,
  Moon,
  Briefcase,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/shadcnComponents/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/shadcnComponents/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/shadcnComponents/Label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/shadcnComponents/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcnComponents/select";

import supabase from "./supabase";
import {
  PersonalActivity,
  HalalRestaurant,
  ACTIVITY_TYPES,
  CUISINE_TYPES,
  formatTime,
  getActivitiesForToday,
  getUpcomingActivities,
  shouldShowReminder,
  getRestaurantsByCuisine,
  getFavoriteRestaurants,
  searchRestaurants,
  getDefaultSchedule,
  getWeekDays,
  isSameDay,
  getActivityForDate,
} from "@/stores/personalScheduleTypes";
import { Switch } from "@/components/ui/shadcnComponents/switch";
import ToggleSwitch from "./Reusables/switchUI";

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  medication: <Pill className="w-4 h-4" />,
  workout: <Dumbbell className="w-4 h-4" />,
  learning: <BookOpen className="w-4 h-4" />,
  family: <Users className="w-4 h-4" />,
  meal: <Utensils className="w-4 h-4" />,
  nap: <Moon className="w-4 h-4" />,
  work: <Briefcase className="w-4 h-4" />,
  custom: <Tag className="w-4 h-4" />,
};

const PersonalLifeManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"schedule" | "restaurants">(
    "schedule"
  );
  const [activities, setActivities] = useState<PersonalActivity[]>([]);
  const [restaurants, setRestaurants] = useState<HalalRestaurant[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState<string>("all");
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [isAddRestaurantOpen, setIsAddRestaurantOpen] = useState(false);
  const [editingActivity, setEditingActivity] =
    useState<PersonalActivity | null>(null);
  const [editingRestaurant, setEditingRestaurant] =
    useState<HalalRestaurant | null>(null);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadActivities();
    loadRestaurants();
    setupReminderCheck();
  }, []);

  const loadActivities = async () => {
    try {
      const { data, error } = await supabase
        .schema("personal")
        .from("activities")
        .select("*")
        .order("time", { ascending: true });

      if (error) {
        console.error("Error loading activities:", error);
        // Use default schedule if no data exists
        setActivities(getDefaultSchedule());
        return;
      }

      if (data && data.length > 0) {
        setActivities(data);
      } else {
        // Initialize with default schedule
        const defaultSchedule = getDefaultSchedule();
        setActivities(defaultSchedule);
        // Save default schedule to database
        for (const activity of defaultSchedule) {
          await saveActivity(activity);
        }
      }
    } catch (error) {
      console.error("Error loading activities:", error);
      setActivities(getDefaultSchedule());
    }
  };

  const loadRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .schema("personal")
        .from("restaurants")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error loading restaurants:", error);
        return;
      }

      setRestaurants(data || []);
    } catch (error) {
      console.error("Error loading restaurants:", error);
    }
  };

  const saveActivity = async (activity: PersonalActivity) => {
    try {
      const { error } = await supabase
        .schema("personal")
        .from("activities")
        .upsert(activity);

      if (error) throw error;
    } catch (error) {
      console.error("Error saving activity:", error);
    }
  };

  const saveRestaurant = async (restaurant: HalalRestaurant) => {
    try {
      const { error } = await supabase
        .schema("personal")
        .from("restaurants")
        .upsert(restaurant);

      if (error) throw error;
    } catch (error) {
      console.error("Error saving restaurant:", error);
    }
  };

  const deleteActivity = async (id: string) => {
    try {
      const { error } = await supabase
        .schema("personal")
        .from("activities")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setActivities(activities.filter((a) => a.id !== id));
    } catch (error) {
      console.error("Error deleting activity:", error);
    }
  };

  const deleteRestaurant = async (id: string) => {
    try {
      const { error } = await supabase
        .schema("personal")
        .from("restaurants")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setRestaurants(restaurants.filter((r) => r.id !== id));
    } catch (error) {
      console.error("Error deleting restaurant:", error);
    }
  };

  const toggleActivityCompletion = async (activity: PersonalActivity) => {
    const updated = {
      ...activity,
      completed: !activity.completed,
      completed_at: !activity.completed ? new Date().toISOString() : undefined,
    };
    await saveActivity(updated);
    setActivities(activities.map((a) => (a.id === activity.id ? updated : a)));
  };

  const toggleRestaurantFavorite = async (restaurant: HalalRestaurant) => {
    const updated = {
      ...restaurant,
      is_favorite: !restaurant.is_favorite,
    };
    await saveRestaurant(updated);
    setRestaurants(
      restaurants.map((r) => (r.id === restaurant.id ? updated : r))
    );
  };

  const setupReminderCheck = () => {
    // Check for reminders every minute
    const interval = setInterval(() => {
      activities.forEach((activity) => {
        if (shouldShowReminder(activity)) {
          showNotification(activity);
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  };

  const showNotification = (activity: PersonalActivity) => {
    // Use browser notification API
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`Reminder: ${activity.title}`, {
        body: `Coming up at ${formatTime(activity.time)}`,
        icon: "/public/codewithali_logo.png",
      });
    }
  };

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Filter logic
  const todaysActivities = getActivitiesForToday(activities);
  const upcomingActivities = getUpcomingActivities(activities);

  const filteredRestaurants = restaurants.filter((restaurant) => {
    const matchesSearch =
      searchQuery === "" ||
      searchRestaurants(restaurants, searchQuery).includes(restaurant);
    const matchesCuisine =
      selectedCuisine === "all" || restaurant.cuisine === selectedCuisine;
    const matchesFavorite = !showOnlyFavorites || restaurant.is_favorite;
    return matchesSearch && matchesCuisine && matchesFavorite;
  });

  return (
    <div className="min-h-screen bg-black text-white overflow-y-auto">
      {/* Header */}
      <div className="px-8 pt-7 pb-2">
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-red-500/[0.08] border border-red-500/15">
              <Heart className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-[24px] font-bold text-white tracking-tight">Personal Life</h1>
              <p className="text-[12px] text-white/20 mt-0.5">
                Your schedule, reminders, and favorite places
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "schedule" | "restaurants")}
        className="px-8"
      >
        <TabsList className="mt-5 bg-white/[0.02] border border-white/[0.04] rounded-sm h-9 p-0.5">
          <TabsTrigger
            value="schedule"
            className="data-[state=active]:bg-red-500/[0.1] data-[state=active]:text-red-400 text-white/30 rounded-sm text-[12px] h-7 px-4 flex items-center gap-1.5"
          >
            <Calendar className="h-3.5 w-3.5" />
            Schedule
          </TabsTrigger>
          <TabsTrigger
            value="restaurants"
            className="data-[state=active]:bg-red-500/[0.1] data-[state=active]:text-red-400 text-white/30 rounded-sm text-[12px] h-7 px-4 flex items-center gap-1.5"
          >
            <Utensils className="h-3.5 w-3.5" />
            Restaurants
          </TabsTrigger>
        </TabsList>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4 mt-4">
          {/* Unified stats strip */}
          <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm overflow-hidden">
            <div className="flex">
              <div className="flex-1 px-5 py-4 border-r border-white/[0.04]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="h-3 w-3 text-red-500/60" />
                  <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Today</span>
                </div>
                <p className="text-xl font-bold text-white tracking-tight">{todaysActivities.length}</p>
              </div>
              <div className="flex-1 px-5 py-4 border-r border-white/[0.04]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Check className="h-3 w-3 text-emerald-500/60" />
                  <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Completed</span>
                </div>
                <p className="text-xl font-bold text-emerald-400 tracking-tight">{todaysActivities.filter((a) => a.completed).length}</p>
              </div>
              <div className="flex-1 px-5 py-4 border-r border-white/[0.04]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="h-3 w-3 text-amber-500/60" />
                  <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Upcoming</span>
                </div>
                <p className="text-xl font-bold text-amber-400 tracking-tight">{upcomingActivities.length}</p>
              </div>
              <div className="flex-1 px-5 py-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Bell className="h-3 w-3 text-purple-500/60" />
                  <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Reminders</span>
                </div>
                <p className="text-xl font-bold text-purple-400 tracking-tight">{activities.filter((a) => a.reminder_minutes).length}</p>
              </div>
            </div>
          </div>

          {/* Controls bar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <button
              onClick={() => {
                setEditingActivity(null);
                setIsAddActivityOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/[0.1] hover:bg-red-500/[0.15] border border-red-500/20 text-red-400 text-[11px] font-medium rounded-sm transition-colors"
            >
              <Plus className="h-3 w-3" /> Add Activity
            </button>

            {/* Week nav — compact pill group */}
            <div className="flex items-center bg-white/[0.02] border border-white/[0.04] rounded-sm">
              <button
                onClick={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(newDate.getDate() - 7);
                  setSelectedDate(newDate);
                }}
                className="p-2 text-white/30 hover:text-white/70 hover:bg-white/[0.04] rounded-sm"
                title="Previous week"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setSelectedDate(new Date())}
                className="px-3 py-1.5 text-[11px] text-white/40 hover:text-white border-x border-white/[0.04]"
              >
                {(() => {
                  const days = getWeekDays(selectedDate);
                  return `${days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
                })()}
              </button>
              <button
                onClick={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(newDate.getDate() + 7);
                  setSelectedDate(newDate);
                }}
                className="p-2 text-white/30 hover:text-white/70 hover:bg-white/[0.04] rounded-sm"
                title="Next week"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Week Schedule */}
          <div className="space-y-3 pb-6">
            {getWeekDays(selectedDate).map((date) => {
              const dayActivities = getActivityForDate(activities, date);
              const isToday = isSameDay(date, new Date());

              return (
                <div
                  key={date.toISOString()}
                  className={`bg-[#0a0a0a] border rounded-sm overflow-hidden transition-colors ${
                    isToday ? "border-red-500/20" : "border-white/[0.04]"
                  }`}
                >
                  <div
                    className={`px-5 py-3 flex items-center justify-between border-b ${
                      isToday ? "border-red-500/10 bg-red-500/[0.03]" : "border-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isToday && (
                        <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                      )}
                      <div>
                        <h2 className="text-[13px] font-semibold text-white/85 flex items-center gap-2">
                          {date.toLocaleDateString("en-US", { weekday: "long" })}
                          {isToday && (
                            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-red-500/[0.1] text-red-400 border border-red-500/15">
                              Today
                            </span>
                          )}
                        </h2>
                        <p className="text-[11px] text-white/25 mt-0.5">
                          {date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[16px] font-bold text-white tracking-tight">{dayActivities.length}</p>
                      <p className="text-[10px] text-white/25 uppercase tracking-wider">
                        {dayActivities.length === 1 ? "activity" : "activities"}
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-white/[0.025]">
                    {dayActivities.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-[12px] text-white/20">No activities scheduled</p>
                      </div>
                    ) : (
                      dayActivities.map((activity) => (
                        <ActivityCard
                          key={`${date.toISOString()}-${activity.id}`}
                          activity={activity}
                          onToggleComplete={toggleActivityCompletion}
                          onEdit={() => {
                            setEditingActivity(activity);
                            setIsAddActivityOpen(true);
                          }}
                          onDelete={() => deleteActivity(activity.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Restaurants Tab */}
        <TabsContent value="restaurants" className="space-y-4 mt-4 pb-6">
          {/* Search and Filter bar */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center flex-wrap">
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/15" />
              <input
                type="text"
                placeholder="Search restaurants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white/[0.02] border border-white/[0.04] rounded-sm text-[12px] text-white/60 placeholder:text-white/15 focus:outline-none focus:border-white/[0.08]"
              />
            </div>

            <Select value={selectedCuisine} onValueChange={setSelectedCuisine}>
              <SelectTrigger className="w-full sm:w-[180px] bg-white/[0.02] border-white/[0.04] rounded-sm text-[12px] text-white/60 h-9">
                <SelectValue placeholder="All Cuisines" />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0a0a] border-white/[0.06] rounded-sm">
                <SelectItem value="all">All Cuisines</SelectItem>
                {Object.entries(CUISINE_TYPES).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value.icon} {value.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-sm text-[11px] font-medium transition-colors ${
                showOnlyFavorites
                  ? "bg-red-500/[0.1] text-red-400 border border-red-500/20"
                  : "bg-white/[0.02] text-white/30 border border-white/[0.04] hover:text-white/60"
              }`}
            >
              <Heart className={`h-3 w-3 ${showOnlyFavorites ? "fill-current" : ""}`} />
              Favorites
            </button>

            <button
              onClick={() => {
                setEditingRestaurant(null);
                setIsAddRestaurantOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500/[0.1] hover:bg-red-500/[0.15] border border-red-500/20 text-red-400 text-[11px] font-medium rounded-sm transition-colors"
            >
              <Plus className="h-3 w-3" /> Add Restaurant
            </button>
          </div>

          {/* Restaurants Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredRestaurants.length === 0 ? (
              <div className="col-span-full bg-[#0a0a0a] border border-white/[0.04] rounded-sm py-16 text-center">
                <Utensils className="h-10 w-10 text-white/[0.05] mx-auto mb-3" />
                <p className="text-[14px] text-white/30 font-medium mb-1">No restaurants found</p>
                <p className="text-[12px] text-white/15">
                  {restaurants.length === 0 ? "Add your first halal spot" : "Try a different filter"}
                </p>
              </div>
            ) : (
              filteredRestaurants.map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  onToggleFavorite={toggleRestaurantFavorite}
                  onEdit={() => {
                    setEditingRestaurant(restaurant);
                    setIsAddRestaurantOpen(true);
                  }}
                  onDelete={() => deleteRestaurant(restaurant.id)}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Activity Modal */}
      <ActivityModal
        isOpen={isAddActivityOpen}
        onClose={() => {
          setIsAddActivityOpen(false);
          setEditingActivity(null);
        }}
        activity={editingActivity}
        onSave={async (activity) => {
          await saveActivity(activity);
          await loadActivities();
          setIsAddActivityOpen(false);
          setEditingActivity(null);
        }}
      />

      {/* Add/Edit Restaurant Modal */}
      <RestaurantModal
        isOpen={isAddRestaurantOpen}
        onClose={() => {
          setIsAddRestaurantOpen(false);
          setEditingRestaurant(null);
        }}
        restaurant={editingRestaurant}
        onSave={async (restaurant) => {
          await saveRestaurant(restaurant);
          await loadRestaurants();
          setIsAddRestaurantOpen(false);
          setEditingRestaurant(null);
        }}
      />
    </div>
  );
};

// Activity Card Component — Void theme
const ActivityCard: React.FC<{
  activity: PersonalActivity;
  onToggleComplete: (activity: PersonalActivity) => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ activity, onToggleComplete, onEdit, onDelete }) => {
  const activityType = ACTIVITY_TYPES[activity.type];

  return (
    <div className="px-5 py-3 hover:bg-white/[0.015] transition-colors group">
      <div className="flex items-start gap-3">
        {/* Time column */}
        <div className="text-[11px] font-mono text-white/30 min-w-[60px] pt-1 tabular-nums">
          {formatTime(activity.time)}
        </div>

        {/* Icon */}
        <div
          className={`p-1.5 rounded-sm ${activityType.darkColor} ${activityType.textColor} shrink-0 mt-0.5`}
        >
          {ACTIVITY_ICONS[activity.type]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h3
              className={`text-[13px] font-medium ${
                activity.completed ? "line-through text-white/30" : "text-white/80"
              }`}
            >
              {activity.title}
            </h3>
            {activity.reminder_minutes ? (
              <Bell className="h-3 w-3 text-amber-400/70" />
            ) : null}
          </div>

          {activity.description && (
            <p className="text-[11px] text-white/40 leading-snug mb-1">
              {activity.description}
            </p>
          )}

          {activity.notes && (
            <p className="text-[10px] text-white/25 italic">{activity.notes}</p>
          )}

          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/25">
            <span className="flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" /> {activity.duration}m
            </span>
            {activity.is_recurring && (
              <>
                <span>·</span>
                <span>Recurring</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onToggleComplete(activity)}
            className={`p-1.5 rounded-sm hover:bg-white/[0.04] transition-colors ${
              activity.completed ? "text-emerald-400" : "text-white/30 hover:text-emerald-400"
            }`}
            title={activity.completed ? "Mark incomplete" : "Mark complete"}
          >
            <Check className="h-3.5 w-3.5" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-sm hover:bg-white/[0.04] text-white/30 hover:text-white/70 transition-colors">
                <Edit className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#0a0a0a] border-white/[0.06] rounded-sm">
              <DropdownMenuItem onClick={onEdit} className="text-[12px]">
                <Edit className="h-3 w-3 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-[12px] text-red-400">
                <Trash2 className="h-3 w-3 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};

// Restaurant Card Component
const RestaurantCard: React.FC<{
  restaurant: HalalRestaurant;
  onToggleFavorite: (restaurant: HalalRestaurant) => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ restaurant, onToggleFavorite, onEdit, onDelete }) => {
  const cuisineInfo = CUISINE_TYPES[restaurant.cuisine];

  return (
    <div className="bg-[#0a0a0a] border border-white/[0.04] hover:border-red-500/10 rounded-sm p-4 transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xl">{cuisineInfo.icon}</span>
            <h3 className="text-[14px] font-semibold text-white/85 truncate">{restaurant.name}</h3>
          </div>
          <p className="text-[11px] text-white/30">{cuisineInfo.label}</p>
        </div>

        <button
          onClick={() => onToggleFavorite(restaurant)}
          className={`p-1.5 rounded-sm hover:bg-white/[0.04] transition-colors shrink-0 ${
            restaurant.is_favorite ? "text-red-400" : "text-white/30 hover:text-red-400"
          }`}
          title={restaurant.is_favorite ? "Unfavorite" : "Favorite"}
        >
          <Heart className={`h-4 w-4 ${restaurant.is_favorite ? "fill-current" : ""}`} />
        </button>
      </div>

      {/* Details */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-start gap-1.5 text-[12px] text-white/50">
          <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-white/20" />
          <span className="leading-snug">{restaurant.address}</span>
        </div>

        {restaurant.phone_number && (
          <div className="flex items-center gap-1.5 text-[12px] text-white/50">
            <Phone className="h-3 w-3 shrink-0 text-white/20" />
            <span>{restaurant.phone_number}</span>
          </div>
        )}

        {restaurant.website && (
          <div className="flex items-center gap-1.5 text-[12px]">
            <Globe className="h-3 w-3 shrink-0 text-white/20" />
            <a
              href={restaurant.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-400/70 hover:text-red-400 truncate"
            >
              Website
            </a>
          </div>
        )}

        {restaurant.price_range && (
          <div className="text-[12px] text-emerald-400 font-medium">
            {restaurant.price_range}
          </div>
        )}
      </div>

      {/* Notes */}
      {restaurant.notes && (
        <div className="bg-white/[0.015] border-l-2 border-amber-500/30 px-2 py-1 mb-3 rounded-sm">
          <p className="text-[11px] text-white/50 italic leading-snug">{restaurant.notes}</p>
        </div>
      )}

      {/* Tags */}
      {restaurant.tags && restaurant.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {restaurant.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 bg-white/[0.03] rounded-sm text-white/40"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-3 border-t border-white/[0.04] opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] text-white/40 hover:text-white/80 text-[11px] rounded-sm transition-colors"
        >
          <Edit className="h-3 w-3" /> Edit
        </button>
        <button
          onClick={onDelete}
          className="px-2.5 py-1.5 bg-white/[0.02] hover:bg-red-500/[0.06] border border-white/[0.04] hover:border-red-500/15 text-white/40 hover:text-red-400 rounded-sm transition-colors"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

// Activity Modal Component
const ActivityModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  activity: PersonalActivity | null;
  onSave: (activity: PersonalActivity) => void;
}> = ({ isOpen, onClose, activity, onSave }) => {
  const [formData, setFormData] = useState<Partial<PersonalActivity>>({
    title: "",
    type: "custom",
    time: "09:00",
    duration: 30,
    description: "",
    is_recurring: false,
    recurring_days: [],
    reminder_minutes: 0,
    notes: "",
  });

  useEffect(() => {
    if (activity) {
      setFormData(activity);
    } else {
      setFormData({
        title: "",
        type: "custom",
        time: "09:00",
        duration: 30,
        description: "",
        is_recurring: false,
        recurring_days: [],
        reminder_minutes: 0,
        notes: "",
      });
    }
  }, [activity, isOpen]);

  const handleSubmit = () => {
    const newActivity: PersonalActivity = {
      id: activity?.id || `activity-${Date.now()}`,
      title: formData.title || "",
      type: formData.type || "custom",
      time: formData.time || "09:00",
      duration: formData.duration || 30,
      description: formData.description,
      is_recurring: formData.is_recurring || false,
      recurring_days: formData.recurring_days || [],
      reminder_minutes: formData.reminder_minutes,
      notes: formData.notes,
      completed: activity?.completed || false,
    };

    onSave(newActivity);
  };

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {activity ? "Edit Activity" : "Add Activity"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div>
            <Label>Title</Label>
            <Input
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Activity title"
              className="bg-white/[0.02] border-white/[0.06] text-white/80 rounded-sm focus:border-red-500/20"
            />
          </div>

          {/* Type */}
          <div>
            <Label>Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  type: value as PersonalActivity["type"],
                })
              }
            >
              <SelectTrigger className="bg-white/[0.02] border-white/[0.06] text-white/80 rounded-sm focus:border-red-500/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTIVITY_TYPES).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value.icon} {value.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time and Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Time</Label>
              <Input
                type="time"
                value={formData.time}
                onChange={(e) =>
                  setFormData({ ...formData, time: e.target.value })
                }
                className="bg-white/[0.02] border-white/[0.06] text-white/80 rounded-sm focus:border-red-500/20"
              />
            </div>
            <div>
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                value={formData.duration}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    duration: parseInt(e.target.value),
                  })
                }
                className="bg-white/[0.02] border-white/[0.06] text-white/80 rounded-sm focus:border-red-500/20"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Activity description"
              className="bg-white/[0.02] border-white/[0.06] text-white/80 rounded-sm focus:border-red-500/20"
              rows={3}
            />
          </div>

          {/* Recurring */}
          <div className="flex items-center justify-between">
            <Label>Recurring Activity</Label>
            <ToggleSwitch
              checked={formData.is_recurring}
              onChange={(checked) =>
                setFormData({ ...formData, is_recurring: checked })
              }
            />
          </div>

          {/* Recurring Days */}
          {formData.is_recurring && (
            <div>
              <Label>Repeat on</Label>
              <div className="flex gap-2 mt-2">
                {DAYS.map((day, index) => {
                  const isSelected = formData.recurring_days?.includes(index);
                  return (
                    <Button
                      key={day}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        const days = formData.recurring_days || [];
                        const newDays = isSelected
                          ? days.filter((d) => d !== index)
                          : [...days, index];
                        setFormData({ ...formData, recurring_days: newDays });
                      }}
                      className={
                        isSelected
                          ? "bg-red-600 hover:bg-red-500 rounded-sm"
                          : "border-white/[0.06]"
                      }
                    >
                      {day}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reminder */}
          <div>
            <Label>Reminder (minutes before)</Label>
            <Input
              type="number"
              value={formData.reminder_minutes || 0}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  reminder_minutes: parseInt(e.target.value),
                })
              }
              placeholder="0 for no reminder"
              className="bg-white/[0.02] border-white/[0.06] text-white/80 rounded-sm focus:border-red-500/20"
            />
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Additional notes"
              className="bg-white/[0.02] border-white/[0.06] text-white/80 rounded-sm focus:border-red-500/20"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-red-600 hover:bg-red-500 rounded-sm"
          >
            {activity ? "Update" : "Add"} Activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Restaurant Modal Component
const RestaurantModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  restaurant: HalalRestaurant | null;
  onSave: (restaurant: HalalRestaurant) => void;
}> = ({ isOpen, onClose, restaurant, onSave }) => {
  const [formData, setFormData] = useState<Partial<HalalRestaurant>>({
    name: "",
    cuisine: "other",
    address: "",
    phone_number: "",
    website: "",
    notes: "",
    rating: undefined,
    price_range: undefined,
    is_favorite: false,
    tags: [],
  });

  useEffect(() => {
    if (restaurant) {
      setFormData(restaurant);
    } else {
      setFormData({
        name: "",
        cuisine: "other",
        address: "",
        phone_number: "",
        website: "",
        notes: "",
        rating: undefined,
        price_range: undefined,
        is_favorite: false,
        tags: [],
      });
    }
  }, [restaurant, isOpen]);

  const handleSubmit = () => {
    const newRestaurant: HalalRestaurant = {
      id: restaurant?.id || `restaurant-${Date.now()}`,
      name: formData.name || "",
      cuisine: formData.cuisine || "other",
      address: formData.address || "",
      phone_number: formData.phone_number,
      website: formData.website,
      notes: formData.notes,
      rating: formData.rating,
      price_range: formData.price_range,
      is_favorite: formData.is_favorite || false,
      tags: formData.tags || [],
    };

    onSave(newRestaurant);
  };

  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    if (tagInput.trim()) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), tagInput.trim()],
      });
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter((t) => t !== tag) || [],
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {restaurant ? "Edit Restaurant" : "Add Restaurant"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div>
            <Label>Restaurant Name</Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Restaurant name"
              className="bg-white/[0.02] border-white/[0.06] text-white/80 rounded-sm focus:border-red-500/20"
            />
          </div>

          {/* Cuisine */}
          <div>
            <Label>Cuisine Type</Label>
            <Select
              value={formData.cuisine}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  cuisine: value as HalalRestaurant["cuisine"],
                })
              }
            >
              <SelectTrigger className="bg-white/[0.02] border-white/[0.06] text-white/80 rounded-sm focus:border-red-500/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CUISINE_TYPES).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value.icon} {value.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Address */}
          <div>
            <Label>Address</Label>
            <Input
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder="Full address"
              className="bg-white/[0.02] border-white/[0.06] text-white/80 rounded-sm focus:border-red-500/20"
            />
          </div>

          {/* Phone */}
          <div>
            <Label>Phone</Label>
            <Input
              value={formData.phone_number}
              onChange={(e) =>
                setFormData({ ...formData, phone_number: e.target.value })
              }
              placeholder="Phone number"
              className="bg-white/[0.02] border-white/[0.06] text-white/80 rounded-sm focus:border-red-500/20"
            />
          </div>

          {/* Website */}
          <div>
            <Label>Website</Label>
            <Input
              value={formData.website}
              onChange={(e) =>
                setFormData({ ...formData, website: e.target.value })
              }
              placeholder="https://..."
              className="bg-white/[0.02] border-white/[0.06] text-white/80 rounded-sm focus:border-red-500/20"
            />
          </div>

          {/* Price Range */}
          <div>
            <Label>Price Range</Label>
            <Select
              value={formData.price_range}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  price_range: value as HalalRestaurant["price_range"],
                })
              }
            >
              <SelectTrigger className="bg-white/[0.02] border-white/[0.06] text-white/80 rounded-sm focus:border-red-500/20">
                <SelectValue placeholder="Select price range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="$">$ - Budget</SelectItem>
                <SelectItem value="$$">$$ - Moderate</SelectItem>
                <SelectItem value="$$$">$$$ - Expensive</SelectItem>
                <SelectItem value="$$$$">$$$$ - Very Expensive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Additional notes, recommendations, etc."
              className="bg-white/[0.02] border-white/[0.06] text-white/80 rounded-sm focus:border-red-500/20"
              rows={3}
            />
          </div>

          {/* Tags */}
          <div>
            <Label>Tags</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addTag()}
                placeholder="Add tag (e.g., halal-certified)"
                className="bg-white/[0.02] border-white/[0.06] text-white/80 rounded-sm focus:border-red-500/20"
              />
              <Button onClick={addTag} variant="outline">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {formData.tags?.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 bg-white/[0.04] rounded-sm text-white/50 flex items-center gap-1"
                >
                  {tag}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-red-500"
                    onClick={() => removeTag(tag)}
                  />
                </span>
              ))}
            </div>
          </div>

          {/* Favorite */}
          <div className="flex items-center justify-between">
            <Label>Mark as Favorite</Label>
            <Switch
              checked={formData.is_favorite}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_favorite: checked })
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-red-600 hover:bg-red-500 rounded-sm"
          >
            {restaurant ? "Update" : "Add"} Restaurant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PersonalLifeManager;
