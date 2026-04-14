/**
 * CodeBlock.tsx — Syntax-highlighted code display for patterns.
 *
 * Wraps react-syntax-highlighter with our Void theme and dynamically picks
 * the correct language. The `atomOneDark` style is tuned for dark bg readability.
 *
 * Used for displaying saved patterns. For input (textarea), we use a plain
 * monospace textarea since full in-browser editors (CodeMirror/Monaco) are
 * heavyweight and overkill for our use case.
 */

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface Props {
  code: string;
  language: string;
  className?: string;
}

export const CodeBlock: React.FC<Props> = ({ code, language, className = "" }) => {
  // react-syntax-highlighter expects specific language identifiers
  // Normalize a few common aliases.
  const normalized = language === "csharp" ? "cs" : language;

  return (
    <div className={`overflow-x-auto text-[12.5px] ${className}`}>
      <SyntaxHighlighter
        language={normalized}
        style={atomDark}
        customStyle={{
          margin: 0,
          padding: "1rem",
          background: "transparent",
          fontSize: "12.5px",
          lineHeight: "1.6",
        }}
        codeTagProps={{
          style: {
            fontFamily:
              "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
          },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};
