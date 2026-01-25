// TimeEntryForm - Modern minimal entry form
import { useForm } from "@tanstack/react-form";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Clock, Building2, Tag, X, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { message } from "@tauri-apps/plugin-dialog";
import {
  TIME_CATEGORIES,
  COMPANIES,
  type TimeCategory,
  type TimeEntryFormData,
  calculateDurationMinutes,
  formatDuration,
} from "@/stores/timeTrackingTypes";
import { useCreateTimeEntry } from "@/stores/timeTrackingQueries";

interface TimeEntryFormProps {
  onSuccess?: () => void;
  defaultDate?: string;
  compact?: boolean;
}

export const TimeEntryForm = ({ onSuccess, defaultDate, compact = false }: TimeEntryFormProps) => {
  const createMutation = useCreateTimeEntry();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [calculatedDuration, setCalculatedDuration] = useState<number>(0);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState(format(new Date(), "HH:mm"));
  const [isBillable, setIsBillable] = useState(true);

  const today = defaultDate || format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    if (startTime && endTime) {
      const duration = calculateDurationMinutes(startTime, endTime);
      setCalculatedDuration(duration > 0 ? duration : 0);
    }
  }, [startTime, endTime]);

  const form = useForm({
    defaultValues: {
      company_id: COMPANIES[0].id,
      project_id: "",
      date: today,
      start_time: startTime,
      end_time: endTime,
      description: "",
      category: "Development" as TimeCategory,
      is_billable: true,
    } as TimeEntryFormData,
    onSubmit: async ({ value }) => {
      try {
        const durationMinutes = calculateDurationMinutes(value.start_time, value.end_time);

        if (durationMinutes <= 0) {
          await message("End time must be after start time", { title: "Invalid Time", kind: "error" });
          return;
        }

        const startDateTime = new Date(`${value.date}T${value.start_time}:00`);
        const endDateTime = new Date(`${value.date}T${value.end_time}:00`);

        if (endDateTime < startDateTime) {
          endDateTime.setDate(endDateTime.getDate() + 1);
        }

        await createMutation.mutateAsync({
          company_id: value.company_id,
          project_id: value.project_id || undefined,
          date: value.date,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          duration_minutes: durationMinutes,
          description: value.description,
          category: value.category,
          tags: selectedTags,
          is_billable: isBillable,
          proof_attachments: [],
        });

        form.reset();
        setSelectedTags([]);
        onSuccess?.();

        await message("Time entry logged!", { title: "Success" });
      } catch (error: any) {
        await message(error.message || "Failed to create entry", { title: "Error", kind: "error" });
      }
    },
  });

  const addTag = () => {
    if (tagInput.trim() && !selectedTags.includes(tagInput.trim())) {
      setSelectedTags([...selectedTags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  };

  // Modern input styles
  const inputStyles = cn(
    "w-full px-4 py-3 rounded-xl text-white placeholder:text-white/30",
    "bg-white/[0.03] border border-white/[0.08]",
    "focus:border-white/20 focus:bg-white/[0.05] focus:outline-none",
    "transition-all duration-200"
  );

  const selectStyles = cn(
    inputStyles,
    "appearance-none cursor-pointer",
    "[&>option]:bg-zinc-900 [&>option]:text-white"
  );

  const labelStyles = "text-xs font-medium text-white/50 uppercase tracking-wider mb-2 block";

  return (
    <div className="space-y-5">
      {/* Header with duration badge */}
      {!compact && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-white/50" />
            <span className="text-white/70 font-medium">Log Time</span>
          </div>
          {calculatedDuration > 0 && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/20"
            >
              <span className="text-sm font-semibold text-white">{formatDuration(calculatedDuration)}</span>
            </motion.div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        {/* Row 1: Company, Date, Category */}
        <div className={cn("grid gap-4", compact ? "grid-cols-2" : "grid-cols-3")}>
          <form.Field
            name="company_id"
            children={(field) => (
              <div>
                <label className={labelStyles}>
                  <Building2 className="inline h-3 w-3 mr-1" />
                  Company
                </label>
                <select
                  className={selectStyles}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                >
                  {COMPANIES.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          />

          <form.Field
            name="date"
            children={(field) => (
              <div>
                <label className={labelStyles}>Date</label>
                <input
                  type="date"
                  className={inputStyles}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          />

          {!compact && (
            <form.Field
              name="category"
              children={(field) => (
                <div>
                  <label className={labelStyles}>Category</label>
                  <select
                    className={selectStyles}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value as TimeCategory)}
                  >
                    {TIME_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            />
          )}
        </div>

        {/* Row 2: Time inputs + Billable */}
        <div className="grid grid-cols-3 gap-4">
          <form.Field
            name="start_time"
            children={(field) => (
              <div>
                <label className={labelStyles}>Start</label>
                <input
                  type="time"
                  className={inputStyles}
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    setStartTime(e.target.value);
                  }}
                />
              </div>
            )}
          />

          <form.Field
            name="end_time"
            children={(field) => (
              <div>
                <label className={labelStyles}>End</label>
                <input
                  type="time"
                  className={inputStyles}
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    setEndTime(e.target.value);
                  }}
                />
              </div>
            )}
          />

          <div>
            <label className={labelStyles}>Billable</label>
            <button
              type="button"
              onClick={() => setIsBillable(!isBillable)}
              className={cn(
                "w-full px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-medium",
                isBillable
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-white/[0.03] border-white/[0.08] text-white/40"
              )}
            >
              {isBillable ? "Yes" : "No"}
            </button>
          </div>
        </div>

        {/* Category for compact mode */}
        {compact && (
          <form.Field
            name="category"
            children={(field) => (
              <div>
                <label className={labelStyles}>Category</label>
                <select
                  className={selectStyles}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value as TimeCategory)}
                >
                  {TIME_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            )}
          />
        )}

        {/* Description */}
        <form.Field
          name="description"
          children={(field) => (
            <div>
              <label className={labelStyles}>Description</label>
              <textarea
                rows={compact ? 2 : 3}
                placeholder="What did you work on?"
                className={cn(inputStyles, "resize-none")}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                required
              />
            </div>
          )}
        />

        {/* Tags */}
        {!compact && (
          <div>
            <label className={labelStyles}>
              <Tag className="inline h-3 w-3 mr-1" />
              Tags
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add tag..."
                className={cn(inputStyles, "flex-1")}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                Add
              </button>
            </div>
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedTags.map((tag) => (
                  <motion.span
                    key={tag}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/70 text-sm"
                  >
                    {tag}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-red-400 transition-colors"
                      onClick={() => removeTag(tag)}
                    />
                  </motion.span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <motion.button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={cn(
                "w-full py-3.5 rounded-xl font-medium text-white transition-all duration-300",
                "bg-gradient-to-r from-red-500 to-orange-500",
                "hover:shadow-lg hover:shadow-red-500/20",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none",
                "flex items-center justify-center gap-2"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Logging...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Log Entry
                </>
              )}
            </motion.button>
          )}
        />
      </form>
    </div>
  );
};

export default TimeEntryForm;
