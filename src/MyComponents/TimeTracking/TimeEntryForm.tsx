// TimeEntryForm - Quick entry interface for logging time
import { useForm } from "@tanstack/react-form";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Plus, Clock, Building2, FolderOpen, Tag, DollarSign, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/shadcnComponents/card";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { Button } from "@/components/ui/button";
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

  const today = defaultDate || format(new Date(), "yyyy-MM-dd");

  // Update duration when times change
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
        // Calculate duration
        const durationMinutes = calculateDurationMinutes(value.start_time, value.end_time);

        if (durationMinutes <= 0) {
          await message("End time must be after start time", { title: "Invalid Time", kind: "error" });
          return;
        }

        // Create ISO timestamps for start and end
        const startDateTime = new Date(`${value.date}T${value.start_time}:00`);
        const endDateTime = new Date(`${value.date}T${value.end_time}:00`);

        // Handle overnight entries
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
          is_billable: value.is_billable,
          proof_attachments: [],
        });

        // Reset form
        form.reset();
        setSelectedTags([]);
        onSuccess?.();

        await message("Time entry logged successfully!", { title: "Success" });
      } catch (error: any) {
        await message(error.message || "Failed to create time entry", { title: "Error", kind: "error" });
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

  const inputClass =
    "w-full px-3 py-2 bg-black/40 border border-red-900/30 text-amber-50 rounded-lg focus:border-red-500 focus:outline-none hover:bg-black/60 transition-colors";
  const labelClass = "text-amber-50/70 text-sm font-medium";
  const selectClass =
    "w-full px-3 py-2 bg-black/40 border border-red-900/30 text-amber-50 rounded-lg focus:border-red-500 focus:outline-none hover:bg-black/60 transition-colors appearance-none cursor-pointer";

  return (
    <Card className="bg-zinc-950 high-dpi:bg-zinc-950/20 border-red-900/30 rounded-xs">
      <CardHeader className="pb-4">
        <CardTitle className="text-amber-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-red-500" />
            Log Time
          </div>
          {calculatedDuration > 0 && (
            <Badge className="bg-red-900/30 text-red-400 border-red-900/50">
              {formatDuration(calculatedDuration)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className={`grid ${compact ? "grid-cols-2" : "grid-cols-3"} gap-4`}>
            {/* Company Selection */}
            <form.Field
              name="company_id"
              children={(field) => (
                <div className="flex flex-col space-y-2">
                  <label className={labelClass} htmlFor={field.name}>
                    <Building2 className="inline h-3 w-3 mr-1" />
                    Company
                  </label>
                  <select
                    name={field.name}
                    className={selectClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  >
                    {COMPANIES.map((company) => (
                      <option key={company.id} value={company.id} className="bg-black text-amber-50">
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            />

            {/* Date */}
            <form.Field
              name="date"
              children={(field) => (
                <div className="flex flex-col space-y-2">
                  <label className={labelClass} htmlFor={field.name}>
                    Date
                  </label>
                  <input
                    type="date"
                    name={field.name}
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            />

            {/* Category */}
            <form.Field
              name="category"
              children={(field) => (
                <div className="flex flex-col space-y-2">
                  <label className={labelClass} htmlFor={field.name}>
                    <FolderOpen className="inline h-3 w-3 mr-1" />
                    Category
                  </label>
                  <select
                    name={field.name}
                    className={selectClass}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value as TimeCategory)}
                  >
                    {TIME_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-black text-amber-50">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            />

            {/* Start Time */}
            <form.Field
              name="start_time"
              children={(field) => (
                <div className="flex flex-col space-y-2">
                  <label className={labelClass} htmlFor={field.name}>
                    Start Time
                  </label>
                  <input
                    type="time"
                    name={field.name}
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                      setStartTime(e.target.value);
                    }}
                  />
                </div>
              )}
            />

            {/* End Time */}
            <form.Field
              name="end_time"
              children={(field) => (
                <div className="flex flex-col space-y-2">
                  <label className={labelClass} htmlFor={field.name}>
                    End Time
                  </label>
                  <input
                    type="time"
                    name={field.name}
                    className={inputClass}
                    value={field.state.value}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                      setEndTime(e.target.value);
                    }}
                  />
                </div>
              )}
            />

            {/* Billable Toggle */}
            <form.Field
              name="is_billable"
              children={(field) => (
                <div className="flex flex-col space-y-2">
                  <label className={labelClass}>
                    <DollarSign className="inline h-3 w-3 mr-1" />
                    Billable
                  </label>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => field.handleChange(!field.state.value)}
                    className={`w-full px-3 py-2 rounded-lg border transition-all ${
                      field.state.value
                        ? "bg-green-900/30 border-green-500/50 text-green-400"
                        : "bg-black/40 border-red-900/30 text-amber-50/50"
                    }`}
                  >
                    {field.state.value ? "Yes - Billable" : "No - Non-billable"}
                  </motion.button>
                </div>
              )}
            />
          </div>

          {/* Description - Full Width */}
          <div className="mt-4">
            <form.Field
              name="description"
              children={(field) => (
                <div className="flex flex-col space-y-2">
                  <label className={labelClass} htmlFor={field.name}>
                    Description
                  </label>
                  <textarea
                    name={field.name}
                    rows={3}
                    placeholder="What did you work on? Be specific for proof of work..."
                    className={`${inputClass} resize-none`}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                  />
                </div>
              )}
            />
          </div>

          {/* Tags Section */}
          <div className="mt-4">
            <label className={labelClass}>
              <Tag className="inline h-3 w-3 mr-1" />
              Tags (Optional)
            </label>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                placeholder="Add a tag..."
                className={`${inputClass} flex-1`}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button
                type="button"
                onClick={addTag}
                className="bg-red-900/50 hover:bg-red-900/70 text-amber-50 px-3"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedTags.map((tag) => (
                  <Badge
                    key={tag}
                    className="bg-red-900/20 text-amber-50/80 border-red-900/30 flex items-center gap-1"
                  >
                    {tag}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-red-400"
                      onClick={() => removeTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
            children={([canSubmit, isSubmitting]) => (
              <motion.button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-6 w-full px-4 py-3 flex items-center justify-center gap-2 bg-red-900 hover:bg-red-800 disabled:bg-red-900/50 disabled:cursor-not-allowed text-amber-50 rounded-lg transition-colors font-medium"
              >
                {isSubmitting ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Clock className="h-4 w-4" />
                    </motion.div>
                    Logging...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Log Time Entry
                  </>
                )}
              </motion.button>
            )}
          />
        </form>
      </CardContent>
    </Card>
  );
};

export default TimeEntryForm;
