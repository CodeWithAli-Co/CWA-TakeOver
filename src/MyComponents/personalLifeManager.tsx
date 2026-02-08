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
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Personal Life Manager</h1>
        <p className="text-zinc-400">
          Manage your daily schedule and find halal restaurants
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "schedule" | "restaurants")}
      >
        <TabsList className="mb-6 bg-zinc-900">
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Personal Schedule
          </TabsTrigger>
          <TabsTrigger value="restaurants" className="flex items-center gap-2">
            <Utensils className="w-4 h-4" />
            Halal Restaurants
          </TabsTrigger>
        </TabsList>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Today's Activities</p>
                  <p className="text-2xl font-bold">
                    {todaysActivities.length}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Completed</p>
                  <p className="text-2xl font-bold">
                    {todaysActivities.filter((a) => a.completed).length}
                  </p>
                </div>
                <Check className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">Upcoming</p>
                  <p className="text-2xl font-bold">
                    {upcomingActivities.length}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-orange-500" />
              </div>
            </div>

            <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">With Reminders</p>
                  <p className="text-2xl font-bold">
                    {activities.filter((a) => a.reminder_minutes).length}
                  </p>
                </div>
                <Bell className="w-8 h-8 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  setEditingActivity(null);
                  setIsAddActivityOpen(true);
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Activity
              </Button>
            </div>

            {/* Week Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(newDate.getDate() - 7);
                  setSelectedDate(newDate);
                }}
                className="border-zinc-700"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Week
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
                className="border-zinc-700"
              >
                Today
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(newDate.getDate() + 7);
                  setSelectedDate(newDate);
                }}
                className="border-zinc-700"
              >
                Next Week
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Week Range Display */}
          {(() => {
            const weekDays = getWeekDays(selectedDate);
            const weekStart = weekDays[0];
            const weekEnd = weekDays[6];
            return (
              <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
                <p className="text-center text-zinc-400">
                  Week of{" "}
                  <span className="font-bold text-white">
                    {weekStart.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  {" - "}
                  <span className="font-bold text-white">
                    {weekEnd.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </p>
              </div>
            );
          })()}

          {/* Week Schedule */}
          <div className="space-y-4">
            {getWeekDays(selectedDate).map((date) => {
              const dayActivities = getActivityForDate(activities, date);
              const isToday = isSameDay(date, new Date());

              return (
                <div
                  key={date.toISOString()}
                  className={`bg-zinc-900 rounded-lg border overflow-hidden ${
                    isToday
                      ? "border-red-600 ring-2 ring-red-600/20"
                      : "border-zinc-800"
                  }`}
                >
                  <div
                    className={`p-4 border-b ${isToday ? "border-red-600/50 bg-red-950/20" : "border-zinc-800"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                          {date.toLocaleDateString("en-US", {
                            weekday: "long",
                          })}
                          {isToday && (
                            <span className="text-xs px-2 py-1 bg-red-600 rounded-full">
                              Today
                            </span>
                          )}
                        </h2>
                        <p className="text-sm text-zinc-400">
                          {date.toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">
                          {dayActivities.length}
                        </p>
                        <p className="text-xs text-zinc-400">activities</p>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-zinc-800">
                    {dayActivities.length === 0 ? (
                      <div className="p-8 text-center text-zinc-400">
                        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No activities scheduled</p>
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
        <TabsContent value="restaurants" className="space-y-6">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                placeholder="Search restaurants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-900 border-zinc-800"
              />
            </div>

            <Select value={selectedCuisine} onValueChange={setSelectedCuisine}>
              <SelectTrigger className="w-full sm:w-[200px] bg-zinc-900 border-zinc-800">
                <SelectValue placeholder="All Cuisines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cuisines</SelectItem>
                {Object.entries(CUISINE_TYPES).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value.icon} {value.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={showOnlyFavorites ? "default" : "outline"}
              onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
              className={showOnlyFavorites ? "bg-red-600 hover:bg-red-700" : ""}
            >
              <Heart
                className={`w-4 h-4 mr-2 ${showOnlyFavorites ? "fill-current" : ""}`}
              />
              Favorites
            </Button>

            <Button
              onClick={() => {
                setEditingRestaurant(null);
                setIsAddRestaurantOpen(true);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>

          {/* Restaurants Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRestaurants.length === 0 ? (
              <div className="col-span-full p-12 text-center text-zinc-400 bg-zinc-900 rounded-lg border border-zinc-800">
                <Utensils className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No restaurants found</p>
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

// Activity Card Component
const ActivityCard: React.FC<{
  activity: PersonalActivity;
  onToggleComplete: (activity: PersonalActivity) => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ activity, onToggleComplete, onEdit, onDelete }) => {
  const activityType = ACTIVITY_TYPES[activity.type];

  return (
    <div className="p-4 hover:bg-zinc-800/50 transition-colors">
      <div className="flex items-start gap-4">
        {/* Time */}
        <div className="text-sm font-mono text-zinc-400 min-w-[80px]">
          {formatTime(activity.time)}
        </div>

        {/* Icon and Content */}
        <div className="flex-1">
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-lg ${activityType.darkColor} ${activityType.textColor} flex-shrink-0`}
            >
              {ACTIVITY_ICONS[activity.type]}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3
                  className={`font-medium ${activity.completed ? "line-through text-zinc-500" : ""}`}
                >
                  {activity.title}
                </h3>
                {activity.reminder_minutes && (
                  <Bell className="w-3 h-3 text-yellow-500" />
                )}
              </div>

              {activity.description && (
                <p className="text-sm text-zinc-400 mb-2">
                  {activity.description}
                </p>
              )}

              {activity.notes && (
                <p className="text-xs text-zinc-500 italic">{activity.notes}</p>
              )}

              <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                <Clock className="w-3 h-3" />
                <span>{activity.duration} min</span>
                {activity.is_recurring && (
                  <>
                    <span>•</span>
                    <span>Recurring</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleComplete(activity)}
            className={activity.completed ? "text-green-500" : "text-zinc-400"}
          >
            <Check className="w-4 h-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-zinc-400">
                <Edit className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-red-500">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
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
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 hover:border-zinc-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{cuisineInfo.icon}</span>
            <h3 className="font-bold">{restaurant.name}</h3>
          </div>
          <p className="text-sm text-zinc-400">{cuisineInfo.label}</p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleFavorite(restaurant)}
          className={restaurant.is_favorite ? "text-red-500" : "text-zinc-400"}
        >
          <Heart
            className={`w-5 h-5 ${restaurant.is_favorite ? "fill-current" : ""}`}
          />
        </Button>
      </div>

      {/* Details */}
      <div className="space-y-2 mb-3">
        <div className="flex items-start gap-2 text-sm text-zinc-400">
          <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{restaurant.address}</span>
        </div>

        {restaurant.phone_number && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Phone className="w-4 h-4 flex-shrink-0" />
            <span>{restaurant.phone_number}</span>
          </div>
        )}

        {restaurant.website && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Globe className="w-4 h-4 flex-shrink-0" />
            <a
              href={restaurant.website}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-400 underline"
            >
              Website
            </a>
          </div>
        )}

        {restaurant.price_range && (
          <div className="text-sm text-green-400 font-medium">
            {restaurant.price_range}
          </div>
        )}
      </div>

      {/* Notes */}
      {restaurant.notes && (
        <p className="text-sm text-zinc-500 mb-3 italic">{restaurant.notes}</p>
      )}

      {/* Tags */}
      {restaurant.tags && restaurant.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {restaurant.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-1 bg-zinc-800 rounded-full text-zinc-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-zinc-800">
        <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
          <Edit className="w-3 h-3 mr-1" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDelete}
          className="text-red-500 border-red-900"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
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
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl">
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
              className="bg-zinc-800 border-zinc-700"
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
              <SelectTrigger className="bg-zinc-800 border-zinc-700">
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
                className="bg-zinc-800 border-zinc-700"
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
                className="bg-zinc-800 border-zinc-700"
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
              className="bg-zinc-800 border-zinc-700"
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
                          ? "bg-red-600 hover:bg-red-700"
                          : "border-zinc-700"
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
              className="bg-zinc-800 border-zinc-700"
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
              className="bg-zinc-800 border-zinc-700"
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
            className="bg-red-600 hover:bg-red-700"
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
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl">
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
              className="bg-zinc-800 border-zinc-700"
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
              <SelectTrigger className="bg-zinc-800 border-zinc-700">
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
              className="bg-zinc-800 border-zinc-700"
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
              className="bg-zinc-800 border-zinc-700"
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
              className="bg-zinc-800 border-zinc-700"
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
              <SelectTrigger className="bg-zinc-800 border-zinc-700">
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
              className="bg-zinc-800 border-zinc-700"
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
                className="bg-zinc-800 border-zinc-700"
              />
              <Button onClick={addTag} variant="outline">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {formData.tags?.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 bg-zinc-800 rounded-full text-zinc-400 flex items-center gap-1"
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
            className="bg-red-600 hover:bg-red-700"
          >
            {restaurant ? "Update" : "Add"} Restaurant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PersonalLifeManager;
