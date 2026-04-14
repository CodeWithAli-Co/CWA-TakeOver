/**
 * PatternLibrary.tsx — Code pattern library with dynamic per-language tabs.
 *
 * Features:
 *   - Patterns persisted to Supabase (simplicity_patterns table)
 *   - Tabs appear dynamically: only languages with at least one saved pattern
 *     get a tab. An "All" tab is always shown.
 *   - Syntax-highlighted code blocks via react-syntax-highlighter
 *   - Add / edit / delete / favorite patterns
 *   - Copy-to-clipboard button on every pattern card
 *   - Search by title, description, or tags
 *
 * Design:
 *   - Void theme (bg-[#0a0a0a] cards, white/opacity text, red-500 accents)
 *   - Card header: title + language badge + favorite + actions
 *   - Code block with copy button in top-right
 *   - Footer: tags + created date
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Copy, Check, Code2, Edit, Trash2, Star, X, Sparkles,
} from "lucide-react";
import {
  PatternsQuery, addPattern, updatePattern, deletePattern,
  SUPPORTED_LANGUAGES, getLanguageLabel, Pattern,
} from "./simplicityQueries";
import { CodeBlock } from "./CodeBlock";

export const PatternLibrary = () => {
  const { data: patterns = [], refetch } = PatternsQuery();

  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPattern, setEditingPattern] = useState<Pattern | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formLanguage, setFormLanguage] = useState("typescript");
  const [formTags, setFormTags] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Build the list of unique languages that have at least one pattern
  // Tabs only appear for languages with existing content.
  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    patterns.forEach((p) => langs.add(p.language));
    return Array.from(langs);
  }, [patterns]);

  // Filter patterns by active tab + search query
  const filtered = useMemo(() => {
    return patterns.filter((p) => {
      const matchesTab = activeTab === "all" || p.language === activeTab;
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        p.title.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q));
      return matchesTab && matchesSearch;
    });
  }, [patterns, activeTab, searchQuery]);

  // Count patterns per language for tab badges
  const countByLanguage = useMemo(() => {
    const counts: Record<string, number> = { all: patterns.length };
    patterns.forEach((p) => {
      counts[p.language] = (counts[p.language] || 0) + 1;
    });
    return counts;
  }, [patterns]);

  // ── Form handlers ──
  const resetForm = () => {
    setFormTitle("");
    setFormDesc("");
    setFormCode("");
    setFormLanguage("typescript");
    setFormTags("");
    setEditingPattern(null);
  };

  const openNewForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (p: Pattern) => {
    setEditingPattern(p);
    setFormTitle(p.title);
    setFormDesc(p.description);
    setFormCode(p.code);
    setFormLanguage(p.language);
    setFormTags(p.tags.join(", "));
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formCode.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDesc.trim(),
        code: formCode,
        language: formLanguage,
        tags: formTags.split(",").map((t) => t.trim()).filter(Boolean),
        favorite: editingPattern?.favorite || false,
      };
      if (editingPattern) {
        await updatePattern(editingPattern.id, payload);
      } else {
        await addPattern(payload);
      }
      setShowForm(false);
      resetForm();
      refetch();
    } catch (err) {
      console.error("Save pattern error:", err);
      alert("Failed to save. Make sure the simplicity_patterns table exists in Supabase.");
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this pattern?")) return;
    try {
      await deletePattern(id);
      refetch();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const toggleFavorite = async (p: Pattern) => {
    try {
      await updatePattern(p.id, { favorite: !p.favorite });
      refetch();
    } catch (err) {
      console.error("Favorite error:", err);
    }
  };

  const copyToClipboard = (code: string, id: number) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-sm bg-red-500/[0.08] border border-red-500/15">
              <Code2 className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-white tracking-tight">Code Pattern Library</h2>
              <p className="text-[11px] text-white/20 mt-0.5">
                {patterns.length} pattern{patterns.length !== 1 ? "s" : ""} across {availableLanguages.length} language{availableLanguages.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <button
            onClick={openNewForm}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/[0.1] hover:bg-red-500/[0.15] border border-red-500/20 text-red-400 text-[11px] font-medium rounded-sm transition-colors"
          >
            <Plus className="h-3 w-3" /> New Pattern
          </button>
        </div>
      </div>

      {/* Language tabs — only appear for languages with patterns */}
      {patterns.length > 0 && (
        <div className="px-6 py-3 border-b border-white/[0.04]">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-sm text-[11px] font-medium whitespace-nowrap transition-colors ${
                activeTab === "all"
                  ? "bg-red-500/[0.1] text-red-400 border border-red-500/20"
                  : "bg-white/[0.02] text-white/30 hover:text-white/60 border border-white/[0.04]"
              }`}
            >
              <Sparkles className="h-3 w-3 inline mr-1" />
              All ({countByLanguage.all || 0})
            </button>
            {availableLanguages.map((lang) => (
              <button
                key={lang}
                onClick={() => setActiveTab(lang)}
                className={`px-3 py-1.5 rounded-sm text-[11px] font-medium whitespace-nowrap transition-colors ${
                  activeTab === lang
                    ? "bg-red-500/[0.1] text-red-400 border border-red-500/20"
                    : "bg-white/[0.02] text-white/30 hover:text-white/60 border border-white/[0.04]"
                }`}
              >
                {getLanguageLabel(lang)} ({countByLanguage[lang] || 0})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-6 py-3">
        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/15" />
          <input
            type="text"
            placeholder="Search by title, description, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white/[0.02] border border-white/[0.04] rounded-sm text-[12px] text-white/60 placeholder:text-white/15 focus:outline-none focus:border-white/[0.08]"
          />
        </div>
      </div>

      {/* Pattern cards */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm py-16 text-center">
            <Code2 className="h-10 w-10 text-white/[0.05] mx-auto mb-3" />
            <p className="text-[14px] text-white/30 font-medium mb-1">
              {patterns.length === 0
                ? "No patterns yet"
                : "No patterns match"}
            </p>
            <p className="text-[12px] text-white/15">
              {patterns.length === 0
                ? "Click 'New Pattern' to save your first one"
                : "Try a different tab or search term"}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map((pattern) => (
              <motion.div
                key={pattern.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm overflow-hidden group hover:border-red-500/10 transition-colors"
              >
                {/* Header */}
                <div className="px-4 py-3 border-b border-white/[0.04] flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-[13px] font-semibold text-white/85">{pattern.title}</h3>
                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-red-500/[0.06] text-red-400/80 border border-red-500/10">
                        {getLanguageLabel(pattern.language)}
                      </span>
                      {pattern.favorite && (
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                      )}
                    </div>
                    {pattern.description && (
                      <p className="text-[11px] text-white/40 leading-snug">{pattern.description}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => toggleFavorite(pattern)}
                      className="p-1.5 rounded-sm hover:bg-white/[0.04] text-white/30 hover:text-amber-400 transition-colors"
                      title="Favorite"
                    >
                      <Star className={`h-3.5 w-3.5 ${pattern.favorite ? "fill-amber-400 text-amber-400" : ""}`} />
                    </button>
                    <button
                      onClick={() => openEditForm(pattern)}
                      className="p-1.5 rounded-sm hover:bg-white/[0.04] text-white/30 hover:text-white/70 transition-colors"
                      title="Edit"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(pattern.id)}
                      className="p-1.5 rounded-sm hover:bg-red-500/[0.06] text-white/30 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => copyToClipboard(pattern.code, pattern.id)}
                      className="p-1.5 rounded-sm hover:bg-white/[0.04] text-white/30 hover:text-white/70 transition-colors"
                      title="Copy code"
                    >
                      {copiedId === pattern.id
                        ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                        : <Copy className="h-3.5 w-3.5" />
                      }
                    </button>
                  </div>
                </div>

                {/* Code */}
                <div className="bg-black/40 relative">
                  <CodeBlock code={pattern.code} language={pattern.language} />
                </div>

                {/* Footer tags */}
                {pattern.tags.length > 0 && (
                  <div className="px-4 py-2 border-t border-white/[0.04] flex items-center gap-1.5 flex-wrap">
                    {pattern.tags.map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 bg-white/[0.03] rounded-sm text-[10px] text-white/40">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
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
              className="bg-[#0a0a0a] border border-white/[0.06] rounded-sm w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              {/* Modal header */}
              <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-white/90">
                  {editingPattern ? "Edit Pattern" : "New Pattern"}
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1.5 rounded-sm text-white/30 hover:text-white/70 hover:bg-white/[0.04]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Form body */}
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. SSR-safe Zustand store"
                    className="w-full mt-1.5 px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white/80 rounded-sm text-[13px] placeholder:text-white/15 focus:outline-none focus:border-red-500/20"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Brief explanation of what this pattern solves"
                    className="w-full mt-1.5 px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white/80 rounded-sm text-[13px] placeholder:text-white/15 focus:outline-none focus:border-red-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
                      Language
                    </label>
                    <select
                      value={formLanguage}
                      onChange={(e) => setFormLanguage(e.target.value)}
                      className="w-full mt-1.5 px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white/80 rounded-sm text-[13px] focus:outline-none focus:border-red-500/20 cursor-pointer"
                    >
                      {SUPPORTED_LANGUAGES.map((l) => (
                        <option key={l.key} value={l.key}>{l.label}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-white/15 mt-1">
                      A tab appears for each language used
                    </p>
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
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
                      Code
                    </label>
                    <span className="text-[10px] text-white/15">
                      {formCode.length} chars · tab to indent
                    </span>
                  </div>
                  <textarea
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    onKeyDown={(e) => {
                      // Allow tab to indent instead of changing focus
                      if (e.key === "Tab") {
                        e.preventDefault();
                        const ta = e.currentTarget;
                        const start = ta.selectionStart;
                        const end = ta.selectionEnd;
                        const next = formCode.slice(0, start) + "  " + formCode.slice(end);
                        setFormCode(next);
                        setTimeout(() => {
                          ta.selectionStart = ta.selectionEnd = start + 2;
                        }, 0);
                      }
                    }}
                    placeholder="// Paste your code here. Formatting is applied on save."
                    rows={14}
                    className="w-full px-3 py-2 bg-black/40 border border-white/[0.06] text-white/85 rounded-sm text-[12.5px] placeholder:text-white/15 focus:outline-none focus:border-red-500/20 font-mono leading-relaxed resize-y"
                    spellCheck={false}
                  />
                </div>

                {/* Live preview of formatted code */}
                {formCode.trim() && (
                  <div>
                    <p className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium mb-1.5">
                      Preview (syntax highlighted)
                    </p>
                    <div className="bg-black/40 rounded-sm border border-white/[0.04] max-h-[200px] overflow-y-auto">
                      <CodeBlock code={formCode} language={formLanguage} />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/[0.04] flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] text-white/40 hover:text-white/70 text-[12px] rounded-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={submitting || !formTitle.trim() || !formCode.trim()}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-[12px] font-medium rounded-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? "Saving..." : editingPattern ? "Save Changes" : "Create Pattern"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
