/**
 * extractTarball.ts — fetches and extracts a .tgz in the browser.
 * Zero deps: built-in `fetch`, `DecompressionStream` for gzip, and a
 * minimal tar parser (tar format is just 512-byte headers + padding).
 *
 * Returns a flat list of file entries with paths normalized and
 * directories skipped. Binary files are returned as Uint8Array;
 * text files (detected by null-byte absence) as decoded strings.
 *
 * The USTAR format we emit (from node-tar on the CLI side) has:
 *   · 100 bytes filename
 *   · 24 bytes mode/owner/group (octal, null-terminated)
 *   · 12 bytes file size (octal)
 *   · 12 bytes mtime
 *   ·  8 bytes checksum
 *   ·  1 byte type flag
 *   · 100 bytes linkname
 *   ·  6 bytes "ustar\0"
 *   ·  2 bytes version
 *   · 32 bytes uname
 *   · 32 bytes gname
 *   · 16 bytes devmajor/devminor
 *   · 155 bytes filename prefix
 *   · 12 bytes padding → 512 total
 * Then file data, padded to a 512-byte multiple.
 *
 * Long filenames (>100 chars) use a GNU longlink type 'L' entry —
 * we handle that case too.
 */

export interface TarEntry {
  /** Normalized forward-slash path. Leading "./" stripped. */
  path: string;
  /** File size in bytes. */
  size: number;
  /** True if this entry is textual (no embedded nulls). */
  isText: boolean;
  /** Text content, if isText. */
  text?: string;
  /** Raw bytes, always. */
  bytes: Uint8Array;
}

/** Decompress a .tgz ArrayBuffer via DecompressionStream. */
async function gunzip(buf: ArrayBuffer): Promise<Uint8Array> {
  const ds = new (globalThis as any).DecompressionStream("gzip") as ReadableWritablePair<Uint8Array, Uint8Array>;
  const stream = new Response(buf).body!.pipeThrough(ds);
  const out = await new Response(stream).arrayBuffer();
  return new Uint8Array(out);
}

/** Read an octal-encoded null-terminated string from a buffer slice. */
function readOctal(bytes: Uint8Array): number {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if (c === 0 || c === 0x20) break;
    s += String.fromCharCode(c);
  }
  return s.length === 0 ? 0 : parseInt(s, 8);
}

/** Read null-terminated string from buffer slice (ASCII). */
function readStr(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) break;
    s += String.fromCharCode(bytes[i]);
  }
  return s;
}

/** Normalize tar-internal paths — forward slashes, strip "./". */
function normalizePath(p: string): string {
  let n = p.replace(/\\/g, "/");
  if (n.startsWith("./")) n = n.slice(2);
  return n;
}

/** Best-effort text detection — no nulls in first 2 KiB. */
function looksText(bytes: Uint8Array): boolean {
  const limit = Math.min(2048, bytes.length);
  for (let i = 0; i < limit; i++) {
    if (bytes[i] === 0) return false;
  }
  return true;
}

/** Parse an uncompressed USTAR buffer into file entries. */
function parseTar(buf: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  let longPath: string | null = null;
  const decoder = new TextDecoder("utf-8", { fatal: false });

  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);

    // End of archive — two consecutive zero blocks.
    let empty = true;
    for (let i = 0; i < 512; i++) {
      if (header[i] !== 0) { empty = false; break; }
    }
    if (empty) break;

    const namePart = readStr(header.subarray(0, 100));
    const sizeStr  = header.subarray(124, 136);
    const typeFlag = String.fromCharCode(header[156]);
    const prefix   = readStr(header.subarray(345, 500));

    const size = readOctal(sizeStr);
    const dataStart = offset + 512;
    const dataEnd   = dataStart + size;

    // Defensive: corrupted header → bail.
    if (dataEnd > buf.length) break;

    // GNU long-name header: next entry's real path is this block's data.
    if (typeFlag === "L") {
      const pathBytes = buf.subarray(dataStart, dataEnd);
      longPath = normalizePath(readStr(pathBytes));
      offset = dataEnd + paddingFor(size);
      continue;
    }

    // Regular files only: "0", "\0", or unset.
    const isFile = typeFlag === "0" || typeFlag === "\0" || typeFlag === "";

    if (isFile) {
      const rawName = longPath ?? (prefix ? `${prefix}/${namePart}` : namePart);
      const path = normalizePath(rawName);
      const bytes = buf.subarray(dataStart, dataEnd).slice();  // own copy
      const isText = looksText(bytes);
      entries.push({
        path,
        size,
        isText,
        text: isText ? decoder.decode(bytes) : undefined,
        bytes,
      });
    }

    longPath = null;
    offset = dataEnd + paddingFor(size);
  }

  return entries;
}

/** Tar pads each file to a 512-byte multiple. */
function paddingFor(size: number): number {
  const rem = size % 512;
  return rem === 0 ? 0 : 512 - rem;
}

/** End-to-end: URL → list of entries. */
export async function extractTarballFromUrl(url: string): Promise<TarEntry[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Tarball fetch failed: ${res.status} ${res.statusText}`);
  }
  const buf = await res.arrayBuffer();
  const decompressed = await gunzip(buf);
  return parseTar(decompressed);
}

// ── Small helpers for consumers ────────────────────────────────────

/** Find README.md (any case, any depth) — returns first hit. */
export function findReadme(entries: TarEntry[]): TarEntry | null {
  return entries.find((e) => /^(?:.*\/)?readme\.md$/i.test(e.path)) ?? null;
}

/** Find the most likely "main" component file — a top-level .tsx/.jsx
 *  whose base name (sans extension) resembles a component. Falls back
 *  to the first .tsx/.jsx file. */
export function findMainComponent(entries: TarEntry[]): TarEntry | null {
  const code = entries.filter((e) =>
    /\.(tsx|jsx)$/i.test(e.path) && !/\.(test|spec|stories)\.(tsx|jsx)$/i.test(e.path),
  );
  if (code.length === 0) return null;
  // Prefer top-level (no slash in path).
  const topLevel = code.filter((e) => !e.path.includes("/"));
  return topLevel[0] ?? code[0];
}

/** Build a path-tree structure for a file browser. */
export interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
  entry?: TarEntry;
}

export function buildFileTree(entries: TarEntry[]): FileNode {
  const root: FileNode = { name: "", path: "", type: "dir", children: [] };
  for (const e of entries) {
    const parts = e.path.split("/").filter(Boolean);
    let cursor = root;
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      const name = parts[i];
      const pathSoFar = parts.slice(0, i + 1).join("/");
      let child = cursor.children?.find((c) => c.name === name);
      if (!child) {
        child = isLast
          ? { name, path: pathSoFar, type: "file", entry: e }
          : { name, path: pathSoFar, type: "dir", children: [] };
        cursor.children!.push(child);
      }
      cursor = child;
    }
  }
  // Sort: dirs first, then files, alphabetically.
  const sort = (node: FileNode) => {
    if (!node.children) return;
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sort);
  };
  sort(root);
  return root;
}

/** Pick a Prism / highlight.js-compatible language name from a path. */
export function languageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "tsx": case "ts": return "tsx";
    case "jsx": case "js": return "jsx";
    case "json":           return "json";
    case "css":            return "css";
    case "scss":           return "scss";
    case "md":             return "markdown";
    case "yml": case "yaml": return "yaml";
    case "html":           return "html";
    case "sh": case "bash": return "bash";
    case "rs":             return "rust";
    case "py":             return "python";
    case "sql":            return "sql";
    case "toml":           return "toml";
    default:               return "text";
  }
}
