/**
 * OfferLetterPDF.tsx — Branded offer-letter PDF. Supports the two
 * company identities CWA (red) and Simplicity (teal) — header stripe,
 * letterhead typography, and footer all switch accordingly.
 *
 * Logo is passed as a URL (Tauri serves /public/* on the dev server
 * and bundles them in prod, so "/codewithali_logo.png" resolves both
 * places). If the image fetch fails, the PDF still renders — the
 * Image component just shows a blank box.
 */

import { Document, Page, StyleSheet, Text, View, Image } from "@react-pdf/renderer";

// ── Brand tokens ───────────────────────────────────────────────────
interface Brand {
  name: string;
  tagline: string;
  accent: string;       // primary hex for accent strip + signature rule
  accentSoft: string;   // soft tint for background ribbons
  ink: string;          // body text color (slightly warmer than pure black)
  footnote: string;     // muted footer color
  logoUrl: string;
}

const BRANDS: Record<"codeWithAli" | "simplicity", Brand> = {
  codeWithAli: {
    name: "CodeWithAli",
    tagline: "Software agency & media",
    accent: "#DC2626",       // red-600
    accentSoft: "#FEF2F2",
    ink: "#0F0F12",
    footnote: "#6B7280",
    logoUrl: "/codewithali_logo.png",
  },
  simplicity: {
    name: "Simplicity",
    tagline: "Finance & operations",
    accent: "#0D9488",       // teal-600
    accentSoft: "#F0FDFA",
    ink: "#0F1519",
    footnote: "#4B5563",
    logoUrl: "/simplicity_logo.png",
  },
};

// ── Styles builder (parameterized by brand) ────────────────────────
function buildStyles(brand: Brand) {
  return StyleSheet.create({
    page: {
      paddingTop: 0,
      paddingBottom: 80,
      fontFamily: "Times-Roman",
      fontSize: 11,
      lineHeight: 1.58,
      color: brand.ink,
    },
    // Top accent stripe that runs edge-to-edge — instantly branded.
    accentBar: {
      backgroundColor: brand.accent,
      height: 6,
      width: "100%",
    },
    letterhead: {
      paddingTop: 30,
      paddingHorizontal: 64,
      paddingBottom: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      borderBottom: `0.6px solid ${brand.accent}40`,
      marginBottom: 26,
    },
    logo: {
      height: 42,
      width: 42,
      objectFit: "contain",
    },
    letterheadRight: { flex: 1 },
    letterheadName: {
      fontSize: 18,
      fontFamily: "Helvetica-Bold",
      color: brand.accent,
      letterSpacing: 0.3,
    },
    letterheadTag: {
      fontSize: 9,
      fontFamily: "Helvetica",
      color: brand.footnote,
      marginTop: 1,
    },
    letterheadAddr: {
      fontSize: 9,
      fontFamily: "Helvetica",
      color: brand.footnote,
      marginTop: 6,
    },
    body: { paddingHorizontal: 64 },
    paragraph: { marginBottom: 11 },
    signatureBlock: {
      marginTop: 36,
      paddingTop: 22,
      borderTop: `0.6px solid ${brand.accent}30`,
    },
    sigRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 24,
      marginTop: 28,
    },
    sigCol: { flex: 1 },
    sigName: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 2 },
    sigMeta: { fontSize: 9, color: brand.footnote, fontFamily: "Helvetica" },
    sigHr: {
      borderBottom: `1px solid ${brand.accent}`,
      marginTop: 32,
      marginBottom: 4,
    },
    // Italic script-style representation of the typed signature.
    // Sits above sigHr so the signature "rests on" the line.
    sigScript: {
      fontFamily: "Times-Italic",
      fontSize: 15,
      color: brand.ink,
      marginBottom: 2,
    },
    sigStamp: {
      fontFamily: "Helvetica",
      fontSize: 8,
      color: brand.accent,
      letterSpacing: 0.3,
      textTransform: "uppercase",
      marginTop: 10,
    },
    footer: {
      position: "absolute",
      bottom: 24,
      left: 64,
      right: 64,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 10,
      borderTop: `0.6px solid ${brand.accent}30`,
    },
    footerText: {
      fontSize: 8,
      fontFamily: "Helvetica",
      color: brand.footnote,
    },
    footerBadge: {
      fontSize: 8,
      fontFamily: "Helvetica-Bold",
      color: brand.accent,
      letterSpacing: 0.4,
    },
  });
}

interface Props {
  brand?: "codeWithAli" | "simplicity";
  employerLegalName: string;
  employerAddress?: string;
  employerSignerName?: string;
  employerSignerTitle?: string;
  candidateName: string;
  body: string;
  /** Typed legal name the employer used to counter-sign this offer.
   *  When present, the PDF renders the employer column as already
   *  signed — /s/ name on the signature line, with the timestamp.
   *  Candidate receives a dual-signed document and only adds theirs. */
  employerSignatureName?: string;
  /** ISO timestamp when the employer counter-signed. */
  employerSignatureAt?: string;
}

export function OfferLetterPDF({
  brand = "codeWithAli",
  employerLegalName,
  employerAddress,
  employerSignerName,
  employerSignerTitle,
  candidateName,
  body,
  employerSignatureName,
  employerSignatureAt,
}: Props) {
  const b = BRANDS[brand];
  const styles = buildStyles(b);

  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const counterSigned =
    !!employerSignatureName && !!employerSignatureAt;

  // Localized date for the Signed: field. `toLocaleDateString`
  // with undefined locale uses the build machine's locale; for
  // consistency across builds we lock to en-US.
  const signedDateText = employerSignatureAt
    ? new Date(employerSignatureAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <Document
      title={`Offer letter — ${candidateName}`}
      author={employerLegalName}
      subject={`Employment offer from ${b.name}`}
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.accentBar} fixed />

        <View style={styles.letterhead} fixed>
          <Image src={b.logoUrl} style={styles.logo} />
          <View style={styles.letterheadRight}>
            <Text style={styles.letterheadName}>{employerLegalName}</Text>
            <Text style={styles.letterheadTag}>
              {b.name.toUpperCase()} · {b.tagline}
            </Text>
            {employerAddress && (
              <Text style={styles.letterheadAddr}>{employerAddress}</Text>
            )}
          </View>
        </View>

        <View style={styles.body}>
          {paragraphs.map((p, i) => (
            <Text key={i} style={styles.paragraph}>
              {p}
            </Text>
          ))}

          <View style={styles.signatureBlock}>
            <View style={styles.sigRow}>
              {/* Employer column — when counter-signed, we render
                  the typed name in italic above the signature line
                  (acts as the "drawn signature" stand-in) plus a
                  small "E-SIGNED" stamp beneath with the date. */}
              <View style={styles.sigCol}>
                {counterSigned ? (
                  <Text style={styles.sigScript}>
                    {`/s/ ${employerSignatureName}`}
                  </Text>
                ) : null}
                <View style={styles.sigHr} />
                <Text style={styles.sigName}>
                  {employerSignatureName || employerSignerName || "—"}
                </Text>
                <Text style={styles.sigMeta}>
                  {employerSignerTitle ? `${employerSignerTitle}, ` : ""}
                  {employerLegalName}
                </Text>
                {counterSigned ? (
                  <>
                    <Text style={styles.sigMeta}>{`Date: ${signedDateText}`}</Text>
                    <Text style={styles.sigStamp}>E-Signed · ESIGN Act</Text>
                  </>
                ) : (
                  <Text style={styles.sigMeta}>Date: _______________</Text>
                )}
              </View>
              {/* Candidate column — always blank in the PDF; the
                  real candidate signature happens on the accept page. */}
              <View style={styles.sigCol}>
                <View style={styles.sigHr} />
                <Text style={styles.sigName}>{candidateName}</Text>
                <Text style={styles.sigMeta}>Candidate signature</Text>
                <Text style={styles.sigMeta}>Date: _______________</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{employerLegalName} · Confidential</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
          <Text style={styles.footerBadge}>{b.name.toUpperCase()}</Text>
        </View>
      </Page>
    </Document>
  );
}
