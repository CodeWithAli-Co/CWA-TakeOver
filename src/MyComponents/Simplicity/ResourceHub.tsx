/**
 * ResourceHub.tsx — Bookmark/resource collection with Supabase backing.
 *
 * Replaces the old ResourceStation.tsx (localStorage-based).
 * Resources persist to simplicity_resources table. No dummy data.
 *
 * Features:
 *   - Add / edit / delete resources
 *   - Categories (All, Docs, Tutorials, Articles, Videos, Tools, Snippets, Other)
 *   - Quick filters: Read Later, Favorites, Completed
 *   - Search across title, url, description, tags
 *   - Favorite toggle per card
 *   - Optional notes + snippet per resource
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, BookOpen, Edit, Trash2, Star, X, ExternalLink,
  FileText, Video, Wrench, Code2, Play, Check, Clock, Sparkles,
} from "lucide-react";
import {
  ResourcesQuery, addResource, updateResource, deleteResource, Resource,
} from "./simplicityQueries";
import { CodeBlock } from "./CodeBlock";

const RESOURCE_TYPES = [
  { key: "docs", label: "Docs", icon: FileText },
  { key: "tutorial", label: "Tutorial", icon: BookOpen },
  { key: "article", label: "Article", icon: FileText },
  { key: "video", label: "Video", icon: Video },
  { key: "snippet", label: "Snippet", icon: Code2 },
  { key: "tool", label: "Tool", icon: Wrench },
] as const;

const getTypeIcon = (type: string) => {
  const match = RESOURCE_TYPES.find((t) => t.key === type);
  return match?.icon || FileText;
};

export const ResourceHub = () => {
  const { data: resources = [], refetch } = ResourcesQuery();

  const [activeFilter, setActiveFilter] = useState<"all" | "readlater" | "favorites" | "completed">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState("docs");
  const [formCategory, setFormCategory] = useState("other");
  const [formTags, setFormTags] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formSnippet, setFormSnippet] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filter resources
  const filtered = useMemo(() => {
    return resources.filter((r) => {
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "readlater" && r.read_later) ||
        (activeFilter === "favorites" && r.favorite) ||
        (activeFilter === "completed" && r.completed);

      const matchesType = typeFilter === "all" || r.type === typeFilter;

      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        r.title.toLowerCase().includes(q) ||
        r.url.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q));

      return matchesFilter && matchesType && matchesSearch;
    });
  }, [resources, activeFilter, typeFilter, searchQuery]);

  // Counts
  const counts = useMemo(() => ({
    all: resources.length,
    readlater: resources.filter((r) => r.read_later).length,
    favorites: resources.filter((r) => r.favorite).length,
    completed: resources.filter((r) => r.completed).length,
  }), [resources]);

  // ── Form handlers ──
  const resetForm = () => {
    setFormTitle("");
    setFormUrl("");
    setFormDesc("");
    setFormType("docs");
    setFormCategory("other");
    setFormTags("");
    setFormNotes("");
    setFormSnippet("");
    setEditingResource(null);
  };

  const openNewForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (r: Resource) => {
    setEditingResource(r);
    setFormTitle(r.title);
    setFormUrl(r.url);
    setFormDesc(r.description);
    setFormType(r.type);
    setFormCategory(r.category);
    setFormTags(r.tags.join(", "));
    setFormNotes(r.notes);
    setFormSnippet(r.snippet);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formUrl.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        title: formTitle.trim(),
        url: formUrl.trim(),
        description: formDesc.trim(),
        category: formCategory,
        type: formType,
        tags: formTags.split(",").map((t) => t.trim()).filter(Boolean),
        read_later: editingResource?.read_later || false,
        completed: editingResource?.completed || false,
        favorite: editingResource?.favorite || false,
        notes: formNotes.trim(),
        snippet: formSnippet,
      };
      if (editingResource) {
        await updateResource(editingResource.id, payload);
      } else {
        await addResource(payload);
      }
      setShowForm(false);
      resetForm();
      refetch();
    } catch (err) {
      console.error("Save resource error:", err);
      alert("Failed to save. Make sure the simplicity_resources table exists in Supabase.");
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this resource?")) return;
    try {
      await deleteResource(id);
      refetch();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const toggleFavorite = async (r: Resource) => {
    try {
      await updateResource(r.id, { favorite: !r.favorite });
      refetch();
    } catch (err) {
      console.error("Favorite error:", err);
    }
  };

  const toggleCompleted = async (r: Resource) => {
    try {
      await updateResource(r.id, { completed: !r.completed });
      refetch();
    } catch (err) {
      console.error("Complete error:", err);
    }
  };

  const toggleReadLater = async (r: Resource) => {
    try {
      await updateResource(r.id, { read_later: !r.read_later });
      refetch();
    } catch (err) {
      console.error("Read later error:", err);
    }
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-sm bg-red-500/[0.08] border border-red-500/15">
              <BookOpen className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-white tracking-tight">Resource Hub</h2>
              <p className="text-[11px] text-white/20 mt-0.5">
                {resources.length} saved · {counts.readlater} queued · {counts.favorites} starred
              </p>
            </div>
          </div>

          <button
            onClick={openNewForm}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/[0.1] hover:bg-red-500/[0.15] border border-red-500/20 text-red-400 text-[11px] font-medium rounded-sm transition-colors"
          >
            <Plus className="h-3 w-3" /> New Resource
          </button>
        </div>
      </div>

      {/* Quick filters + search */}
      <div className="px-6 py-3 border-b border-white/[0.04] flex items-center gap-2 flex-wrap">
        {/* Status filter pills */}
        <div className="flex items-center bg-white/[0.02] border border-white/[0.04] rounded-sm p-0.5">
          {([
            { key: "all", label: "All", icon: Sparkles },
            { key: "readlater", label: "Read Later", icon: Clock },
            { key: "favorites", label: "Starred", icon: Star },
            { key: "completed", label: "Done", icon: Check },
          ] as const).map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-sm text-[11px] font-medium transition-colors ${
                  activeFilter === f.key
                    ? "bg-red-500/[0.1] text-red-400"
                    : "text-white/25 hover:text-white/50"
                }`}
              >
                <Icon className="h-3 w-3" />
                {f.label} ({counts[f.key as keyof typeof counts] || 0})
              </button>
            );
          })}
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-2.5 py-1.5 bg-white/[0.02] border border-white/[0.04] rounded-sm text-[11px] text-white/60 focus:outline-none focus:border-white/[0.08] cursor-pointer"
        >
          <option value="all">All types</option>
          {RESOURCE_TYPES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/15" />
          <input
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white/[0.02] border border-white/[0.04] rounded-sm text-[12px] text-white/60 placeholder:text-white/15 focus:outline-none focus:border-white/[0.08]"
          />
        </div>
      </div>

      {/* Resource list */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm py-16 text-center">
            <BookOpen className="h-10 w-10 text-white/[0.05] mx-auto mb-3" />
            <p className="text-[14px] text-white/30 font-medium mb-1">
              {resources.length === 0 ? "No resources yet" : "No resources match"}
            </p>
            <p className="text-[12px] text-white/15">
              {resources.length === 0 ? "Click 'New Resource' to bookmark a link" : "Try a different filter"}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map((resource) => {
              const Icon = getTypeIcon(resource.type);
              return (
                <motion.div
                  key={resource.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={`bg-[#0a0a0a] border rounded-sm overflow-hidden group hover:border-red-500/10 transition-colors ${
                    resource.completed ? "border-white/[0.02] opacity-60" : "border-white/[0.04]"
                  }`}
                >
                  <div className="p-4 flex items-start gap-3">
                    {/* Completed checkbox */}
                    <button
                      onClick={() => toggleCompleted(resource)}
                      className={`mt-0.5 h-4 w-4 rounded-sm border-2 flex items-center justify-center shrink-0 transition-colors ${
                        resource.completed
                          ? "bg-emerald-500/20 border-emerald-500/40"
                          : "border-white/[0.1] hover:border-white/[0.2]"
                      }`}
                    >
                      {resource.completed && <Check className="h-2.5 w-2.5 text-emerald-400" />}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Icon className="h-3.5 w-3.5 text-red-500/70 shrink-0" />
                        <h3 className={`text-[13px] font-medium ${
                          resource.completed ? "text-white/40 line-through" : "text-white/85"
                        }`}>
                          {resource.title}
                        </h3>
                        {resource.favorite && (
                          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        )}
                        {resource.read_later && (
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-blue-500/[0.08] text-blue-400/80 border border-blue-500/10">
                            <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                            Read later
                          </span>
                        )}
                      </div>

                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-red-400/70 hover:text-red-400 truncate flex items-center gap-1 mb-1"
                      >
                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{resource.url}</span>
                      </a>

                      {resource.description && (
                        <p className="text-[12px] text-white/40 leading-snug mb-2">
                          {resource.description}
                        </p>
                      )}

                      {resource.notes && (
                        <div className="bg-white/[0.015] border-l-2 border-amber-500/30 px-2 py-1 mb-2 rounded-sm">
                          <p className="text-[11px] text-white/50 italic">{resource.notes}</p>
                        </div>
                      )}

                      {resource.snippet && (
                        <div className="mb-2 bg-black/40 rounded-sm border border-white/[0.04] max-h-[150px] overflow-y-auto">
                          <CodeBlock code={resource.snippet} language="typescript" />
                        </div>
                      )}

                      {resource.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {resource.tags.map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 bg-white/[0.03] rounded-sm text-[10px] text-white/40">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => toggleReadLater(resource)}
                        className={`p-1.5 rounded-sm hover:bg-white/[0.04] transition-colors ${
                          resource.read_later ? "text-blue-400" : "text-white/30 hover:text-blue-400"
                        }`}
                        title="Read later"
                      >
                        <Clock className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => toggleFavorite(resource)}
                        className="p-1.5 rounded-sm hover:bg-white/[0.04] text-white/30 hover:text-amber-400 transition-colors"
                        title="Favorite"
                      >
                        <Star className={`h-3.5 w-3.5 ${resource.favorite ? "fill-amber-400 text-amber-400" : ""}`} />
                      </button>
                      <button
                        onClick={() => openEditForm(resource)}
                        className="p-1.5 rounded-sm hover:bg-white/[0.04] text-white/30 hover:text-white/70 transition-colors"
                        title="Edit"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(resource.id)}
                        className="p-1.5 rounded-sm hover:bg-red-500/[0.06] text-white/30 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0a0a0a] border border-white/[0.08] rounded-sm w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/50"
            >
              <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-white/90">
                  {editingResource ? "Edit Resource" : "New Resource"}
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1.5 rounded-sm text-white/30 hover:text-white/70 hover:bg-white/[0.04]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="What is this?"
                    className="w-full mt-1.5 px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white/80 rounded-sm text-[13px] placeholder:text-white/15 focus:outline-none focus:border-red-500/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
                    URL
                  </label>
                  <input
                    type="url"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full mt-1.5 px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white/80 rounded-sm text-[13px] placeholder:text-white/15 focus:outline-none focus:border-red-500/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
                    Description
                  </label>
                  <textarea
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="What does it cover?"
                    rows={2}
                    className="w-full mt-1.5 px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white/80 rounded-sm text-[13px] placeholder:text-white/15 focus:outline-none focus:border-red-500/20 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
                      Type
                    </label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      className="w-full mt-1.5 px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white/80 rounded-sm text-[13px] focus:outline-none focus:border-red-500/20 cursor-pointer"
                    >
                      {RESOURCE_TYPES.map((t) => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
                      Category
                    </label>
                    <input
                      type="text"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      placeholder="e.g. react, billing"
                      className="w-full mt-1.5 px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white/80 rounded-sm text-[13px] placeholder:text-white/15 focus:outline-none focus:border-red-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="comma, separated, tags"
                    className="w-full mt-1.5 px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white/80 rounded-sm text-[13px] placeholder:text-white/15 focus:outline-none focus:border-red-500/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
                    Personal notes (optional)
                  </label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Your thoughts, things to remember..."
                    rows={2}
                    className="w-full mt-1.5 px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white/80 rounded-sm text-[13px] placeholder:text-white/15 focus:outline-none focus:border-red-500/20 resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
                    Code snippet (optional)
                  </label>
                  <textarea
                    value={formSnippet}
                    onChange={(e) => setFormSnippet(e.target.value)}
                    placeholder="// Paste a short code example"
                    rows={6}
                    className="w-full mt-1.5 px-3 py-2 bg-black/40 border border-white/[0.06] text-white/85 rounded-sm text-[12.5px] placeholder:text-white/15 focus:outline-none focus:border-red-500/20 font-mono leading-relaxed resize-y"
                    spellCheck={false}
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-white/[0.04] flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] text-white/40 hover:text-white/70 text-[12px] rounded-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={submitting || !formTitle.trim() || !formUrl.trim()}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-[12px] font-medium rounded-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? "Saving..." : editingResource ? "Save Changes" : "Add Resource"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
