/**
 * simplicityQueries.ts — Supabase CRUD for the Simplicity CLI page.
 *
 * Replaces localStorage-based storage for:
 *   - Code patterns (simplicity_patterns table)
 *   - Resource bookmarks (simplicity_resources table)
 *
 * Run these migrations in Supabase before using:
 *
 *   CREATE TABLE IF NOT EXISTS simplicity_patterns (
 *     id BIGSERIAL PRIMARY KEY,
 *     user_id UUID,
 *     title TEXT NOT NULL,
 *     description TEXT DEFAULT '',
 *     code TEXT NOT NULL,
 *     language TEXT NOT NULL DEFAULT 'typescript',
 *     tags TEXT[] DEFAULT '{}',
 *     favorite BOOLEAN DEFAULT false,
 *     created_at TIMESTAMPTZ DEFAULT NOW(),
 *     updated_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 *
 *   CREATE TABLE IF NOT EXISTS simplicity_resources (
 *     id BIGSERIAL PRIMARY KEY,
 *     user_id UUID,
 *     title TEXT NOT NULL,
 *     url TEXT NOT NULL,
 *     description TEXT DEFAULT '',
 *     category TEXT DEFAULT 'other',
 *     type TEXT DEFAULT 'docs',
 *     tags TEXT[] DEFAULT '{}',
 *     read_later BOOLEAN DEFAULT false,
 *     completed BOOLEAN DEFAULT false,
 *     favorite BOOLEAN DEFAULT false,
 *     notes TEXT DEFAULT '',
 *     snippet TEXT DEFAULT '',
 *     created_at TIMESTAMPTZ DEFAULT NOW(),
 *     updated_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 */

import { useSuspenseQuery } from "@tanstack/react-query";
import { companySupabase } from "@/MyComponents/supabase";

// ── Types ──
export interface Pattern {
  id: number;
  title: string;
  description: string;
  code: string;
  language: string;
  tags: string[];
  favorite: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Resource {
  id: number;
  title: string;
  url: string;
  description: string;
  category: string;
  type: string;
  tags: string[];
  read_later: boolean;
  completed: boolean;
  favorite: boolean;
  notes: string;
  snippet: string;
  created_at?: string;
  updated_at?: string;
}

// ── Pattern queries ──
const fetchPatterns = async (): Promise<Pattern[]> => {
  const { data, error } = await companySupabase    .from("simplicity_patterns")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching patterns:", error.message);
    return [];
  }
  return (data as Pattern[]) || [];
};

export const PatternsQuery = () => {
  return useSuspenseQuery({
    queryKey: ["simplicity-patterns"],
    queryFn: fetchPatterns,
  });
};

export const addPattern = async (
  pattern: Omit<Pattern, "id" | "created_at" | "updated_at">
) => {
  const { data, error } = await companySupabase    .from("simplicity_patterns")
    .insert(pattern)
    .select()
    .single();
  if (error) throw error;
  return data as Pattern;
};

export const updatePattern = async (id: number, patch: Partial<Pattern>) => {
  const { error } = await companySupabase    .from("simplicity_patterns")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
};

export const deletePattern = async (id: number) => {
  const { error } = await companySupabase    .from("simplicity_patterns")
    .delete()
    .eq("id", id);
  if (error) throw error;
};

// ── Resource queries ──
const fetchResources = async (): Promise<Resource[]> => {
  const { data, error } = await companySupabase    .from("simplicity_resources")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching resources:", error.message);
    return [];
  }
  return (data as Resource[]) || [];
};

export const ResourcesQuery = () => {
  return useSuspenseQuery({
    queryKey: ["simplicity-resources"],
    queryFn: fetchResources,
  });
};

export const addResource = async (
  resource: Omit<Resource, "id" | "created_at" | "updated_at">
) => {
  const { data, error } = await companySupabase    .from("simplicity_resources")
    .insert(resource)
    .select()
    .single();
  if (error) throw error;
  return data as Resource;
};

export const updateResource = async (id: number, patch: Partial<Resource>) => {
  const { error } = await companySupabase    .from("simplicity_resources")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
};

export const deleteResource = async (id: number) => {
  const { error } = await companySupabase    .from("simplicity_resources")
    .delete()
    .eq("id", id);
  if (error) throw error;
};

// ── Language constants ──
// List of languages the pattern library supports.
// Language tabs only appear if at least one pattern exists for that language.
export const SUPPORTED_LANGUAGES = [
  { key: "typescript", label: "TypeScript" },
  { key: "javascript", label: "JavaScript" },
  { key: "rust", label: "Rust" },
  { key: "python", label: "Python" },
  { key: "go", label: "Go" },
  { key: "java", label: "Java" },
  { key: "csharp", label: "C#" },
  { key: "cpp", label: "C++" },
  { key: "sql", label: "SQL" },
  { key: "html", label: "HTML" },
  { key: "css", label: "CSS" },
  { key: "bash", label: "Bash" },
  { key: "json", label: "JSON" },
  { key: "yaml", label: "YAML" },
  { key: "markdown", label: "Markdown" },
] as const;

export const getLanguageLabel = (key: string): string => {
  const found = SUPPORTED_LANGUAGES.find((l) => l.key === key);
  return found?.label || key;
};
