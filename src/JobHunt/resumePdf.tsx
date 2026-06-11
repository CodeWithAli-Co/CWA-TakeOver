/**
 * resumePdf.tsx — render a tailored resume / cover letter (markdown-ish text)
 * to a clean A4 PDF Blob via @react-pdf/renderer. Lazy-imported so the heavy
 * renderer only loads when the user actually exports.
 */
import { pdf, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { paddingVertical: 38, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 10, color: "#1a1a1a", lineHeight: 1.45 },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  h2: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 4, letterSpacing: 1, color: "#000" },
  h3: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 7, marginBottom: 2 },
  p: { marginBottom: 4 },
  bulletRow: { flexDirection: "row", marginBottom: 2.5, paddingLeft: 4 },
  bulletDot: { width: 10, fontSize: 10 },
  bulletText: { flex: 1 },
  hr: { borderBottomWidth: 0.7, borderBottomColor: "#cfcfcf", marginVertical: 7 },
});

const clean = (s: string) => s.replace(/\*\*/g, "").replace(/`/g, "").replace(/^\s*[-*]\s+/, "").trim();

function Doc({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {lines.map((line, i) => {
          const t = line.trim();
          if (t === "") return <View key={i} style={{ height: 3 }} />;
          if (/^-{3,}$/.test(t)) return <View key={i} style={styles.hr} />;
          if (t.startsWith("### ")) return <Text key={i} style={styles.h3}>{clean(t.slice(4))}</Text>;
          if (t.startsWith("## ")) return <Text key={i} style={styles.h2}>{clean(t.slice(3))}</Text>;
          if (t.startsWith("# ")) return <Text key={i} style={styles.h1}>{clean(t.slice(2))}</Text>;
          if (/^[-*]\s+/.test(t)) return (
            <View key={i} style={styles.bulletRow}><Text style={styles.bulletDot}>•</Text><Text style={styles.bulletText}>{clean(t)}</Text></View>
          );
          return <Text key={i} style={styles.p}>{clean(t)}</Text>;
        })}
      </Page>
    </Document>
  );
}

export async function renderResumePdf(markdown: string): Promise<Blob> {
  return pdf(<Doc markdown={markdown} />).toBlob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export const safeFile = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").trim();
