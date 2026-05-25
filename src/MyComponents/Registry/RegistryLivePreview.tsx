/**
 * RegistryLivePreview — live-renders a published component in a
 * sandboxed iframe. NOT a full build pipeline — designed for
 * self-contained React components that use stock React + Tailwind +
 * lucide-react + common primitives.
 *
 * Pipeline:
 *   1. Fetch + extract the tarball (via useTarball).
 *   2. Find the main component file (findMainComponent).
 *   3. Strip / rewrite imports (we can't resolve bare specifiers in
 *      the iframe — everything runs against the UMD React globals).
 *   4. Use @babel/standalone (loaded from CDN on demand) to compile
 *      TSX → JS.
 *   5. Inject the compiled source into an iframe with UMD React,
 *      Tailwind Play CDN, and a small bootstrap shim that renders
 *      the exported component.
 *
 * Limits (and the UI tells the user about them):
 *   · Only vanilla React + Tailwind + lucide icons are resolvable.
 *   · No shadcn/ui. No path aliases (@/). No shared helpers across
 *     files.
 *   · No runtime data fetching.
 *   · If the component imports something we can't resolve, the
 *     "compile error" pane surfaces the actual error so the dev
 *     can see exactly which import failed.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Play, RefreshCw, Loader2, Info } from "lucide-react";
import { useTarball } from "./lib/useTarball";
import { findMainComponent, type TarEntry } from "./lib/extractTarball";
import { registryTarballUrl } from "./queries";

interface Props {
  storagePath: string | null;
  itemName: string;
}

// Babel-standalone from jsDelivr. Cached after first load.
const BABEL_CDN = "https://cdn.jsdelivr.net/npm/@babel/standalone@7.25.6/babel.min.js";

// Globals the preview iframe can use — exposed by our shim below.
// Anything outside this list makes the imports rewriter punt and
// the compile error surface in the UI.
const ALLOWED_SPECIFIERS = new Set([
  "react",
  "react-dom",
  "react/jsx-runtime",
  "lucide-react",
]);

export function RegistryLivePreview({ storagePath, itemName }: Props) {
  const url = storagePath ? registryTarballUrl(storagePath) : null;
  const { data: entries, isLoading, error } = useTarball(url);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [key, setKey] = useState(0);  // bump to force remount

  const mainFile = useMemo(
    () => (entries ? findMainComponent(entries) : null),
    [entries],
  );

  // When entries load (or reload), rebuild the iframe.
  useEffect(() => {
    setCompileError(null);
    if (!mainFile || !iframeRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const Babel = await loadBabel();
        if (cancelled) return;
        const html = buildPreviewHtml(mainFile, Babel);
        const iframe = iframeRef.current;
        if (!iframe) return;
        iframe.srcdoc = html;
      } catch (e) {
        if (!cancelled) {
          setCompileError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [mainFile, key]);

  if (!url) {
    return (
      <div className="flex h-[320px] items-center justify-center text-[12px] text-muted-foreground">
        No published version to preview.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center gap-2 text-[12px] text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
        Unpacking tarball…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center gap-2 px-4 text-center">
        <AlertCircle className="h-5 w-5 text-red-400" />
        <p className="text-[12px] text-red-300">{(error as Error).message}</p>
      </div>
    );
  }

  if (!mainFile) {
    return (
      <div className="flex h-[320px] items-center justify-center text-center text-[12px] text-muted-foreground">
        No .tsx/.jsx file found in tarball.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Info banner */}
      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/90 leading-snug">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <div>
          Live preview runs with vanilla React + Tailwind + lucide-react only.
          Components with shadcn/ui, <code className="font-mono">@/</code> imports,
          or runtime data fetching won't compile here. Use the <strong>Code</strong>{" "}
          tab to read the source.
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 rounded-t-md border border-border/60 bg-muted/20 px-3 py-1.5 text-[11px]">
        <span className="truncate font-mono text-foreground/80">{mainFile.path}</span>
        <button
          type="button"
          onClick={() => setKey((k) => k + 1)}
          className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 hover:bg-muted transition-colors"
          title="Re-render"
        >
          <RefreshCw className="h-2.5 w-2.5" />
          Reload
        </button>
      </div>

      {/* Preview frame */}
      <div className="relative h-[420px] rounded-b-md border border-t-0 border-border/60 bg-card overflow-hidden">
        <iframe
          ref={iframeRef}
          key={key}
          title={`${itemName} preview`}
          sandbox="allow-scripts"
          className="h-full w-full border-0"
        />
        {compileError && (
          <div className="absolute inset-0 flex flex-col gap-2 overflow-auto bg-background/85 p-4 text-[11.5px] text-red-200">
            <div className="flex items-center gap-1.5 text-red-300">
              <AlertCircle className="h-3.5 w-3.5" />
              <strong>Compile error</strong>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[10.5px] leading-snug">
              {compileError}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Babel loader (cached) ──────────────────────────────────────────

type BabelStandalone = { transform: (code: string, opts: any) => { code: string } };
let babelPromise: Promise<BabelStandalone> | null = null;

function loadBabel(): Promise<BabelStandalone> {
  if (babelPromise) return babelPromise;
  babelPromise = new Promise((resolve, reject) => {
    const existing = (window as any).Babel as BabelStandalone | undefined;
    if (existing) return resolve(existing);
    const script = document.createElement("script");
    script.src = BABEL_CDN;
    script.async = true;
    script.onload = () => {
      const B = (window as any).Babel;
      if (B) resolve(B);
      else reject(new Error("Babel loaded but global Babel is missing."));
    };
    script.onerror = () => reject(new Error("Failed to load Babel standalone from CDN."));
    document.head.appendChild(script);
  });
  return babelPromise;
}

// ── TSX compile + iframe HTML builder ─────────────────────────────

function buildPreviewHtml(entry: TarEntry, Babel: BabelStandalone): string {
  const source = entry.text ?? "";

  // Extract + strip imports. We can't run the component's own
  // import statements because bare specifiers don't resolve inside
  // an iframe.  The shim below pre-populates globals for React,
  // jsx-runtime, and lucide icons so the transpiled code can refer
  // to them via our rewrites.
  const { rewritten, bailReason } = rewriteImports(source);
  if (bailReason) {
    // Let the iframe surface a friendly error page — cleaner than a
    // thrown exception in the host.
    return buildErrorPage(bailReason);
  }

  // Compile TSX → JS. We target the browser's native module-less
  // evaluation environment (just eval the final code inside the
  // iframe <script> block).
  let compiled: string;
  try {
    compiled = Babel.transform(rewritten, {
      presets: [
        ["env", { targets: { esmodules: true }, modules: false }],
        "react",
        "typescript",
      ],
      filename: entry.path,
    }).code;
  } catch (e) {
    return buildErrorPage(e instanceof Error ? e.message : String(e));
  }

  // Discover the exported component name via a regex scan on the
  // Babel output. Most common patterns after module-stripping:
  //   var _default = Foo;
  //   exports.default = Foo;
  //   exports.Foo = Foo;
  const defaultMatch = /(?:_default\w*|default_\d+)\s*=\s*([A-Z][A-Za-z0-9_]*)/.exec(compiled);
  const exportMatch  = /(?:exports\[["']default["']\]|exports\.default)\s*=\s*([A-Z][A-Za-z0-9_]*)/.exec(compiled);
  const fromNamed    = /exports\.([A-Z][A-Za-z0-9_]*)\s*=/.exec(compiled);
  const componentName =
    (defaultMatch && defaultMatch[1]) ||
    (exportMatch && exportMatch[1]) ||
    (fromNamed && fromNamed[1]) ||
    null;

  // Build the iframe document via array-join to avoid any nested
  // template-literal backtick fights. `compiled` is embedded as a
  // JSON-encoded string that we decode inside the iframe at runtime.
  const compiledJson = JSON.stringify(compiled);
  const nameJson = JSON.stringify(componentName);

  const parts: string[] = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width,initial-scale=1" />',
    '  <title>Preview</title>',
    '  <script src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js"></script>',
    '  <script src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js"></script>',
    '  <script src="https://cdn.tailwindcss.com"></script>',
    '  <style>',
    '    body { margin:0; padding:16px; background:#0a0a0a; color:#e5e5e5;',
    '      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }',
    '    #error { font-family: ui-monospace, "SF Mono", monospace; color:#fca5a5;',
    '      font-size:12px; white-space:pre-wrap; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <div id="root"></div>',
    '  <pre id="error" hidden></pre>',
    '  <script>',
    '  (function () {',
    '    var __compiled = ' + compiledJson + ';',
    '    var __componentName = ' + nameJson + ';',
    '    var __lucide = new Proxy({}, {',
    '      get: function (_, name) {',
    '        return function LucideShim(props) {',
    '          return React.createElement("span", {',
    '            style: {',
    '              display:"inline-block",',
    '              width: (props && props.size) || 16,',
    '              height:(props && props.size) || 16,',
    '              border:"1px dashed #666",',
    '              borderRadius:3,',
    '              textAlign:"center",',
    '              fontSize:9,',
    '              lineHeight:"14px",',
    '              color:"#888",',
    '            },',
    '            title: String(name),',
    '            children: String(name).slice(0,2),',
    '          });',
    '        };',
    '      },',
    '    });',
    '',
    '    try {',
    '      var exportsObj = {};',
    '      var ret = { value: null };',
    '      var bodyText = __compiled +',
    '        "\\ntry { if (__componentName && typeof eval(__componentName) !== \\"undefined\\") ret.value = eval(__componentName); } catch(_) {}" +',
    '        "\\nif (!ret.value && exports && exports.default) ret.value = exports.default;";',
    '      var fn = new Function("React","ReactDOM","lucide","exports","ret","__componentName", bodyText);',
    '      fn(React, ReactDOM, __lucide, exportsObj, ret, __componentName);',
    '      var Comp = ret.value || exportsObj.default;',
    '      if (!Comp) throw new Error("No exported component found. Use: export default <ComponentName>");',
    '      var root = ReactDOM.createRoot(document.getElementById("root"));',
    '      root.render(React.createElement(Comp));',
    '    } catch (err) {',
    '      var pre = document.getElementById("error");',
    '      pre.hidden = false;',
    '      pre.textContent = (err && err.message ? err.message : String(err)) + "\\n\\n" + (err && err.stack || "");',
    '    }',
    '  })();',
    '  </script>',
    '</body>',
    '</html>',
  ];
  return parts.join("\n");
}

function buildErrorPage(message: string): string {
  const safe = message.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  return `<!DOCTYPE html><html><head><style>
    body{background:#0a0a0a;color:#fca5a5;font:12px ui-monospace,monospace;padding:16px;margin:0;}
  </style></head><body><pre>${safe}</pre></body></html>`;
}

// ── Import rewriter ────────────────────────────────────────────────
/**
 * We remove (or rewrite) all import statements in the source so the
 * compiled output doesn't try to load anything at runtime. React /
 * jsx-runtime / lucide-react get remapped to our injected globals.
 * Anything else → bail with a readable error.
 */
function rewriteImports(src: string): { rewritten: string; bailReason: string | null } {
  let out = src;
  const importRe = /^\s*import\s+(?:([\w*{},\s]+)\s+from\s+)?["']([^"']+)["']\s*;?\s*$/gm;
  let m: RegExpExecArray | null;
  const disallowed: string[] = [];

  // Collect all specifiers first, then validate + rewrite.
  while ((m = importRe.exec(src)) !== null) {
    const spec = m[2];
    const clause = m[1] ?? "";
    if (!ALLOWED_SPECIFIERS.has(spec)) {
      // Path imports ( "./foo", "../bar" ) are always disallowed —
      // we don't resolve cross-file imports in the iframe.
      if (spec.startsWith(".") || spec.startsWith("/")) {
        disallowed.push(`relative import "${spec}"`);
      } else {
        disallowed.push(`"${spec}"`);
      }
      continue;
    }
    // Rewrite React imports as variable aliases to our globals.
    // e.g. `import React, { useState } from "react"`
    //   →  `const React = window.React; const { useState } = React;`
    if (spec === "react") {
      out = out.replace(m[0], `const React = window.React; const { useState, useEffect, useRef, useMemo, useCallback, useContext, useLayoutEffect, useReducer, useId, createContext, forwardRef, memo, Fragment } = React;`);
    } else if (spec === "react/jsx-runtime") {
      out = out.replace(m[0], `const __reactJsx = __reactJsxRuntime;`);
    } else if (spec === "react-dom") {
      out = out.replace(m[0], `const ReactDOM = window.ReactDOM;`);
    } else if (spec === "lucide-react") {
      // Extract named imports from the clause and alias them to our
      // proxy. Destructure is easy because the proxy returns for any key.
      out = out.replace(m[0], `const ${clause.includes("{") ? clause.replace(/as\s+\w+/g, "").replace(/\s+default\s*,?/, "") : `{ ${clause} }`} = lucide;`);
    }
  }

  if (disallowed.length > 0) {
    return {
      rewritten: "",
      bailReason:
        `Live preview can't resolve these imports:\n  ` +
        disallowed.slice(0, 10).join("\n  ") +
        (disallowed.length > 10 ? `\n  …and ${disallowed.length - 10} more` : "") +
        `\n\nThe live-preview sandbox only supports vanilla React + Tailwind + lucide-react.\n` +
        `Open the Code tab to read the source, or install via the CLI to run it in a real project.`,
    };
  }

  return { rewritten: out, bailReason: null };
}
