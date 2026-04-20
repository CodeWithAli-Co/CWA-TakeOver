/**
 * useTarball — TanStack Query hook that lazy-loads + extracts a
 * registry tarball. Cached per tarball URL so re-opening the drawer
 * doesn't re-download.
 */

import { useQuery } from "@tanstack/react-query";
import { extractTarballFromUrl, type TarEntry } from "./extractTarball";

export function useTarball(url: string | null) {
  return useQuery<TarEntry[]>({
    queryKey: ["registry-tarball", url],
    queryFn: async () => {
      if (!url) return [];
      return extractTarballFromUrl(url);
    },
    enabled: !!url,
    // Tarballs are immutable per URL (storage_path includes version),
    // so we can cache them for the whole session.
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30,  // 30 min idle eviction
    retry: 1,
  });
}
