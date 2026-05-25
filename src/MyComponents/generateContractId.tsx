/**
 * generateContractId.tsx — Convergent Contract Generator (Void dark theme).
 *
 * Full-page form to build service agreements with:
 *   - Client info, project details, pricing, features
 *   - AI-generated features based on project title
 *   - Load client from DB (mocked for now — hooks up to Supabase later)
 *   - Contract preview view with print + email
 *
 * All the original logic (TanStack Form, feature array helpers, AI generator,
 * email flow) is preserved. The light/white theme is replaced with the Void
 * palette: bg-background page, bg-card cards, red-500 accents, white-opacity
 * typography. The print view retains a light background internally so printed
 * output still looks clean on paper.
 */

import { useState, useRef, JSX } from "react";
import {
  FileText, DollarSign, Code, CheckCircle, Printer, Users, Plus, Minus,
  Wand2, Save, Mail, Database, Calendar, Briefcase, TrendingUp, Sparkles,
  ArrowLeft,
} from "lucide-react";
import { useForm } from "@tanstack/react-form";

// ── Types ──
interface ContractData {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  clientCompany: string;
  projectTitle: string;
  projectDescription: string;
  businessModel: string;
  targetMarket: string;
  revenueStreams: string;
  contractType: "development" | "partnership" | "maintenance";
  initialPayment: string;
  monthlyMaintenance: string;
  revenueSharing: string;
  coreFeatures: string[];
  advancedFeatures: string[];
  partnershipDuration: string;
  specialArrangements: string;
}

// ── Void section card wrapper ──
const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accent?: "red" | "blue" | "amber";
}> = ({ icon, title, subtitle, children, accent = "red" }) => {
  const accents = {
    red: "bg-primary/[0.08] text-primary border-primary/15",
    blue: "bg-blue-500/[0.08] text-blue-400 border-blue-500/15",
    amber: "bg-amber-500/[0.08] text-amber-400 border-amber-500/15",
  };
  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center gap-3">
        <div className={`p-1.5 rounded-sm border ${accents[accent]}`}>
          {icon}
        </div>
        <div>
          <h2 className="text-[14px] font-semibold text-foreground/85">{title}</h2>
          {subtitle && <p className="text-[11px] text-muted-foreground/50">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
};

// ── Void input styles ──
const inputBase =
  "w-full px-3 py-2 bg-muted/30 border border-border text-foreground/80 rounded-sm text-[13px] placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/20 transition-colors";

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div>
    <label className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.12em] font-medium block mb-1.5">
      {label}
    </label>
    {children}
  </div>
);

// ══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════
export default function NexusContractGenerator(): JSX.Element {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [emailStatus, setEmailStatus] = useState("");
  const [currentDate] = useState(new Date().toLocaleDateString("en-US"));
  const contractRef = useRef<HTMLDivElement>(null);

  const form = useForm({
    defaultValues: {
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      clientAddress: "",
      clientCompany: "",
      projectTitle: "",
      projectDescription: "",
      businessModel: "",
      targetMarket: "",
      revenueStreams: "",
      contractType: "development",
      initialPayment: "",
      monthlyMaintenance: "",
      revenueSharing: "",
      coreFeatures: [""],
      advancedFeatures: [""],
      partnershipDuration: "Ongoing with 30-day termination notice",
      specialArrangements: "",
    } as ContractData,
    onSubmit: async () => {
      setShowContract(true);
    },
  });

  // Generate a stable contract ID per render of the preview
  const generateContractId = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `NC-${y}${m}${day}-${rand}`;
  };

  // Mocked DB lookup — replace with Supabase fetch later
  const loadClientFromDB = async () => {
    form.setFieldValue("clientName", "Blaze Hunter");
    form.setFieldValue("clientEmail", "blazehunter@gmail.com");
    form.setFieldValue("clientPhone", "+31 6 4588 0030");
    form.setFieldValue("clientAddress", "Netherlands");
    form.setFieldValue("clientCompany", "Convergent LLC");
  };

  // AI-generate features based on project title (pattern matching for now)
  const generateFromAI = async () => {
    setIsGenerating(true);
    const title = form.getFieldValue("projectTitle").toLowerCase();
    let core: string[] = [];
    let adv: string[] = [];

    if (title.includes("ecommerce") || title.includes("shop")) {
      core = [
        "Product catalog with search and filters",
        "Shopping cart and checkout system",
        "Stripe payment integration",
        "Customer account management",
        "Order tracking and management",
        "Mobile-responsive design",
        "SEO optimization and meta tags",
      ];
      adv = [
        "Inventory management system",
        "Advanced analytics dashboard",
        "Email marketing integration",
        "Multi-vendor marketplace features",
        "Automated tax calculations",
        "Review and ratings system",
      ];
    } else if (title.includes("dashboard") || title.includes("admin")) {
      core = [
        "User authentication and authorization",
        "Real-time data visualizations",
        "CRUD operations interface",
        "Responsive dashboard layout",
        "Export functionality (PDF/CSV)",
        "Search and filtering capabilities",
      ];
      adv = [
        "Advanced analytics and reporting",
        "Role-based access control",
        "API integrations",
        "Automated backup system",
        "Custom notifications system",
        "Multi-tenant architecture",
      ];
    } else if (title.includes("app") || title.includes("mobile")) {
      core = [
        "Cross-platform mobile application",
        "User registration and login",
        "Push notifications system",
        "Offline data synchronization",
        "In-app messaging/chat",
        "App store optimization",
      ];
      adv = [
        "Advanced security features",
        "Real-time location services",
        "Third-party API integrations",
        "Advanced analytics tracking",
        "Custom UI/UX animations",
        "Backend admin panel",
      ];
    } else {
      core = [
        "Modern responsive web design",
        "User authentication system",
        "Database integration",
        "Contact forms and validation",
        "SEO optimization",
        "Performance optimization",
      ];
      adv = [
        "Advanced security implementation",
        "Third-party integrations",
        "Analytics and reporting",
        "Content management system",
        "API development",
        "Automated deployment pipeline",
      ];
    }

    setTimeout(() => {
      form.setFieldValue("coreFeatures", core);
      form.setFieldValue("advancedFeatures", adv);
      setIsGenerating(false);
    }, 1500);
  };

  // Feature array helpers
  const addFeature = (type: "coreFeatures" | "advancedFeatures") => {
    const current = form.getFieldValue(type);
    form.setFieldValue(type, [...current, ""]);
  };
  const removeFeature = (type: "coreFeatures" | "advancedFeatures", index: number) => {
    const current = form.getFieldValue(type);
    if (current.length > 1) {
      form.setFieldValue(type, current.filter((_, i) => i !== index));
    }
  };
  const updateFeature = (type: "coreFeatures" | "advancedFeatures", index: number, value: string) => {
    const current = form.getFieldValue(type);
    form.setFieldValue(type, current.map((item, i) => (i === index ? value : item)));
  };

  // Actions
  const saveContract = async () => {
    try {
      alert("Contract saved!");
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const exportToPDF = async () => {
    try {
      window.print();
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const emailContract = async () => {
    const email = form.getFieldValue("clientEmail");
    if (!email) {
      alert("Please enter a client email address");
      return;
    }
    setIsSending(true);
    setEmailStatus("Generating PDF and preparing email...");
    try {
      // TODO: wire to Tauri `send_contract_email` command
      setTimeout(() => {
        setEmailStatus("Contract sent successfully!");
        setIsSending(false);
        saveContract();
        setTimeout(() => setEmailStatus(""), 3000);
      }, 2000);
    } catch (err) {
      console.error("Email failed:", err);
      setEmailStatus("Failed to send email");
      setIsSending(false);
    }
  };

  const getContractTypeTitle = (): string => {
    const t = form.getFieldValue("contractType");
    return t === "partnership"
      ? "SERVICE & PARTNERSHIP AGREEMENT"
      : t === "maintenance"
        ? "MAINTENANCE & SUPPORT AGREEMENT"
        : "SERVICE AGREEMENT";
  };

  const getContractTypeBadge = (): string => {
    const t = form.getFieldValue("contractType");
    return t === "partnership"
      ? "Development & Revenue-Sharing"
      : t === "maintenance"
        ? "Ongoing Maintenance"
        : "Development Services";
  };

  // ══════════════════════════════════════════════════════════════════
  // PREVIEW VIEW (rendered when showContract=true)
  // ══════════════════════════════════════════════════════════════════
  if (showContract) {
    const contractId = generateContractId();
    return (
      <>
        <div className="min-h-screen bg-background overflow-y-auto">
          {/* Action bar */}
          <div className="px-8 py-4 border-b border-border bg-card sticky top-0 z-10 no-print">
            <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowContract(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 hover:bg-muted/50 border border-border text-muted-foreground/80 hover:text-foreground/80 text-[12px] rounded-sm transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Editor
                </button>
                <button
                  onClick={exportToPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 hover:bg-muted/50 border border-border text-muted-foreground/80 hover:text-foreground/80 text-[12px] rounded-sm transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" /> Print / PDF
                </button>
                <button
                  onClick={saveContract}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 hover:bg-muted/50 border border-border text-muted-foreground/80 hover:text-foreground/80 text-[12px] rounded-sm transition-colors"
                >
                  <Save className="h-3.5 w-3.5" /> Save
                </button>
              </div>

              <div className="flex items-center gap-2">
                {emailStatus && (
                  <span
                    className={`text-[11px] px-2 py-1 rounded-sm border ${
                      emailStatus.includes("success")
                        ? "bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/15"
                        : emailStatus.includes("Failed")
                          ? "bg-primary/[0.08] text-primary border-primary/15"
                          : "bg-blue-500/[0.08] text-blue-400 border-blue-500/15"
                    }`}
                  >
                    {emailStatus}
                  </span>
                )}
                <button
                  onClick={emailContract}
                  disabled={isSending || !form.getFieldValue("clientEmail")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/15 border border-primary/20 text-primary text-[12px] font-medium rounded-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {isSending ? "Sending..." : "Email to Client"}
                </button>
              </div>
            </div>
          </div>

          {/* Contract document */}
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div
              ref={contractRef}
              className="bg-card border border-border rounded-sm p-10 text-foreground/80 print-contract"
            >
              {/* Header */}
              <div className="text-center pb-6 mb-8 border-b border-border">
                <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">
                  {form.getFieldValue("projectTitle").toUpperCase() || "PROFESSIONAL SERVICES"}
                </h1>
                <h2 className="text-xl font-semibold text-primary mb-3">
                  {getContractTypeTitle()}
                </h2>
                <div className="flex items-center justify-center gap-3 text-[12px] text-muted-foreground/70">
                  <span>Contract ID: <strong className="text-foreground/70">{contractId}</strong></span>
                  <span>·</span>
                  <span>Date: <strong className="text-foreground/70">{currentDate}</strong></span>
                </div>
                <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-primary/[0.08] border border-primary/15 text-primary text-[11px] rounded-sm">
                  <FileText className="h-3 w-3" />
                  {getContractTypeBadge()}
                </div>
              </div>

              {/* Parties */}
              <section className="mb-8">
                <h2 className="text-[14px] font-bold mb-4 flex items-center gap-2 text-primary">
                  <Users className="h-4 w-4" />
                  Contracting Parties
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-card p-4 rounded-sm border border-border">
                    <h3 className="text-[12px] font-semibold mb-2 text-foreground/80 uppercase tracking-wider">
                      Service Provider
                    </h3>
                    <p className="text-foreground/70 text-[13px] font-semibold">Convergent</p>
                    <p className="text-muted-foreground/80 text-[12px]">Professional Development Services</p>
                    <p className="text-muted-foreground/80 text-[12px]">San Jose, California, United States</p>
                    <p className="text-muted-foreground/80 text-[12px]">contact@convergent.dev</p>
                    <p className="text-[11px] mt-2 text-primary font-medium">CEO: Ali Alibrahimi</p>
                  </div>
                  <div className="bg-card p-4 rounded-sm border border-border">
                    <h3 className="text-[12px] font-semibold mb-2 text-foreground/80 uppercase tracking-wider">
                      Client
                    </h3>
                    <p className="text-foreground/70 text-[13px] font-semibold">
                      {form.getFieldValue("clientName") || "Client Name"}
                    </p>
                    {form.getFieldValue("clientCompany") && (
                      <p className="text-muted-foreground/80 text-[12px]">{form.getFieldValue("clientCompany")}</p>
                    )}
                    <p className="text-muted-foreground/80 text-[12px]">{form.getFieldValue("clientEmail") || "client@email.com"}</p>
                    <p className="text-muted-foreground/80 text-[12px]">{form.getFieldValue("clientPhone") || "+1 (xxx) xxx-xxxx"}</p>
                    <p className="text-[11px] mt-2 text-muted-foreground/80">{form.getFieldValue("clientAddress") || "Client Address"}</p>
                    <p className="text-[11px] mt-2 text-primary font-medium">Role: Project Owner</p>
                  </div>
                </div>
              </section>

              {/* Project overview */}
              <section className="mb-8">
                <h2 className="text-[14px] font-bold mb-4 flex items-center gap-2 text-primary">
                  <Code className="h-4 w-4" />
                  Project Overview
                </h2>
                <div className="bg-card p-5 rounded-sm border border-border">
                  <h3 className="font-semibold text-[15px] mb-3 text-foreground/85">
                    {form.getFieldValue("projectTitle") || "Project Title"}
                  </h3>
                  <div className="space-y-2 text-[13px] text-foreground/60">
                    <p>
                      <strong className="text-foreground/80">Description:</strong>{" "}
                      {form.getFieldValue("projectDescription") || "Project description will be detailed here."}
                    </p>
                    {form.getFieldValue("businessModel") && (
                      <p><strong className="text-foreground/80">Business Model:</strong> {form.getFieldValue("businessModel")}</p>
                    )}
                    {form.getFieldValue("targetMarket") && (
                      <p><strong className="text-foreground/80">Target Market:</strong> {form.getFieldValue("targetMarket")}</p>
                    )}
                    {form.getFieldValue("revenueStreams") && (
                      <p><strong className="text-foreground/80">Revenue Streams:</strong> {form.getFieldValue("revenueStreams")}</p>
                    )}
                  </div>
                </div>
              </section>

              {/* Deliverables */}
              <section className="mb-8">
                <h2 className="text-[14px] font-bold mb-4 flex items-center gap-2 text-primary">
                  <CheckCircle className="h-4 w-4" />
                  Development Deliverables
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-card p-4 rounded-sm border border-border">
                    <h3 className="text-[11px] uppercase tracking-wider font-semibold mb-3 text-foreground/70">
                      Core Features
                    </h3>
                    <ul className="space-y-1.5">
                      {form.getFieldValue("coreFeatures").filter((f) => f.trim()).map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] text-foreground/60">
                          <CheckCircle className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-card p-4 rounded-sm border border-border">
                    <h3 className="text-[11px] uppercase tracking-wider font-semibold mb-3 text-foreground/70">
                      Advanced Features
                    </h3>
                    <ul className="space-y-1.5">
                      {form.getFieldValue("advancedFeatures").filter((f) => f.trim()).map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] text-foreground/60">
                          <CheckCircle className="h-3 w-3 text-blue-400 mt-0.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              {/* Financial */}
              <section className="mb-8">
                <h2 className="text-[14px] font-bold mb-4 flex items-center gap-2 text-primary">
                  <DollarSign className="h-4 w-4" />
                  Financial Structure
                </h2>
                <div className="bg-card p-5 rounded-sm border border-border">
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {form.getFieldValue("initialPayment") || "$TBD"}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Initial Development (One-time)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">
                        {form.getFieldValue("monthlyMaintenance") || "$TBD"}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Monthly Maintenance</div>
                    </div>
                  </div>

                  {form.getFieldValue("contractType") === "partnership" &&
                    form.getFieldValue("revenueSharing") && (
                      <div className="text-center border-t border-border pt-4">
                        <div className="text-lg font-bold text-purple-400">
                          {form.getFieldValue("revenueSharing")}
                        </div>
                        <div className="text-[11px] text-muted-foreground">Revenue Sharing Structure</div>
                      </div>
                    )}

                  <div className="border-t border-border pt-4 mt-4">
                    <h4 className="text-[12px] font-semibold mb-2 text-foreground/80">Payment Terms</h4>
                    <ul className="text-[11px] text-muted-foreground/80 space-y-1">
                      <li>• 50% of development fee due upon contract signing</li>
                      <li>• 50% due upon project completion and launch</li>
                      <li>• Monthly maintenance billed in advance</li>
                      <li>• Late payments subject to 1.5% monthly service charge</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Special arrangements */}
              {form.getFieldValue("specialArrangements") && (
                <section className="mb-8">
                  <h2 className="text-[14px] font-bold mb-4 flex items-center gap-2 text-amber-400">
                    <FileText className="h-4 w-4" />
                    Special Arrangements
                  </h2>
                  <div className="bg-amber-500/[0.04] border-l-2 border-amber-500/40 px-4 py-3 rounded-sm">
                    <p className="text-[12px] text-amber-200/80">
                      {form.getFieldValue("specialArrangements")}
                    </p>
                  </div>
                </section>
              )}

              {/* Signatures */}
              <section className="pt-6 border-t border-border">
                <h2 className="text-[14px] font-bold mb-4 text-center text-foreground/85">Contract Execution</h2>
                <p className="text-center text-[12px] text-muted-foreground/70 mb-6">
                  Please review this agreement carefully. If you agree, sign below and return via email.
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="text-center">
                    <div className="border-2 border-dashed border-white/[0.1] p-5 rounded-sm min-h-[140px] flex flex-col justify-between">
                      <div>
                        <h3 className="text-[11px] uppercase tracking-wider font-semibold mb-2 text-foreground/70">
                          Client Signature
                        </h3>
                        <div className="h-14 flex items-center justify-center text-muted-foreground/60 text-[12px]">
                          _________________________
                        </div>
                      </div>
                      <div>
                        <p className="text-[12px] mt-2 text-foreground/60">{form.getFieldValue("clientName") || "Client Name"}</p>
                        <p className="text-[10px] text-muted-foreground">Date: _______________</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-2 border-dashed border-white/[0.1] p-5 rounded-sm min-h-[140px] flex flex-col justify-between">
                      <div>
                        <h3 className="text-[11px] uppercase tracking-wider font-semibold mb-2 text-foreground/70">
                          Convergent Representative
                        </h3>
                        <div className="h-14 flex items-center justify-center text-muted-foreground/60 text-[12px]">
                          _________________________
                        </div>
                      </div>
                      <div>
                        <p className="text-[12px] mt-2 text-foreground/60">Ali Alibrahimi</p>
                        <p className="text-[10px] text-muted-foreground">CEO, Convergent</p>
                        <p className="text-[10px] text-muted-foreground">Date: _______________</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Contract Generated: {currentDate}
                  </div>
                </div>
              </section>

              {/* Footer */}
              <div className="mt-8 pt-4 border-t border-border text-center text-[10px] text-muted-foreground">
                <p>Contract ID: {contractId} · Generated: {currentDate}</p>
                <p>Convergent Professional Services · San Jose, CA · contact@convergent.dev</p>
                <p className="mt-1 text-primary/50 font-medium tracking-wider uppercase">
                  Confidential Business Agreement
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Print styles — ensure PDF output stays legible on paper */}
        <style>{`
          @media print {
            body { -webkit-print-color-adjust: exact; background: white !important; }
            .no-print { display: none !important; }
            .print-contract {
              background: white !important;
              color: black !important;
              border: none !important;
            }
            .print-contract * {
              color: black !important;
              border-color: #ddd !important;
              background: transparent !important;
            }
            .print-contract strong { color: black !important; }
          }
        `}</style>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // EDITOR VIEW (default)
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      {/* Header */}
      <div className="px-8 pt-7 pb-2">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-primary/[0.08] border border-primary/15">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-[24px] font-bold text-foreground tracking-tight">Contract Generator</h1>
              <p className="text-[12px] text-muted-foreground/60 mt-0.5">
                Build service agreements with auto-generated terms and pricing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadClientFromDB}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 hover:bg-muted/50 border border-border text-muted-foreground/70 hover:text-foreground/70 text-[11px] font-medium rounded-sm transition-colors"
            >
              <Database className="h-3 w-3" /> Load Client
            </button>
            <button
              onClick={generateFromAI}
              disabled={isGenerating || !form.getFieldValue("projectTitle")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/15 border border-primary/20 text-primary text-[11px] font-medium rounded-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="h-3 w-3 animate-pulse" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-3 w-3" />
                  AI Generate Features
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Form body */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="px-8 py-5 pb-10 max-w-5xl mx-auto space-y-4"
      >
        {/* Client Information */}
        <SectionCard
          icon={<Users className="h-3.5 w-3.5" />}
          title="Client Information"
          subtitle="Who are you contracting with?"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field
              name="clientName"
              children={(field) => (
                <Field label="Client Name">
                  <input
                    className={inputBase}
                    placeholder="John Doe"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            />
            <form.Field
              name="clientCompany"
              children={(field) => (
                <Field label="Company">
                  <input
                    className={inputBase}
                    placeholder="Acme Inc."
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            />
            <form.Field
              name="clientEmail"
              children={(field) => (
                <Field label="Email">
                  <input
                    type="email"
                    className={inputBase}
                    placeholder="client@email.com"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            />
            <form.Field
              name="clientPhone"
              children={(field) => (
                <Field label="Phone">
                  <input
                    className={inputBase}
                    placeholder="+1 (xxx) xxx-xxxx"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            />
            <div className="md:col-span-2">
              <form.Field
                name="clientAddress"
                children={(field) => (
                  <Field label="Address">
                    <input
                      className={inputBase}
                      placeholder="Street, City, Country"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </Field>
                )}
              />
            </div>
          </div>
        </SectionCard>

        {/* Project Details */}
        <SectionCard
          icon={<Briefcase className="h-3.5 w-3.5" />}
          title="Project Details"
          subtitle="What are you building?"
          accent="blue"
        >
          <form.Field
            name="projectTitle"
            children={(field) => (
              <Field label="Project Title">
                <input
                  className={inputBase}
                  placeholder="e.g. E-commerce Platform, Dashboard, Mobile App"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </Field>
            )}
          />
          <form.Field
            name="projectDescription"
            children={(field) => (
              <Field label="Description">
                <textarea
                  rows={3}
                  className={`${inputBase} resize-y`}
                  placeholder="Brief overview of the project scope..."
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </Field>
            )}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <form.Field
              name="businessModel"
              children={(field) => (
                <Field label="Business Model">
                  <textarea
                    rows={2}
                    className={`${inputBase} resize-y`}
                    placeholder="B2B SaaS, marketplace..."
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            />
            <form.Field
              name="targetMarket"
              children={(field) => (
                <Field label="Target Market">
                  <textarea
                    rows={2}
                    className={`${inputBase} resize-y`}
                    placeholder="Small business owners..."
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            />
            <form.Field
              name="revenueStreams"
              children={(field) => (
                <Field label="Revenue Streams">
                  <textarea
                    rows={2}
                    className={`${inputBase} resize-y`}
                    placeholder="Subscriptions, licensing..."
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            />
          </div>
        </SectionCard>

        {/* Contract & Pricing */}
        <SectionCard
          icon={<DollarSign className="h-3.5 w-3.5" />}
          title="Contract & Pricing"
          subtitle="Terms and financial structure"
        >
          <form.Field
            name="contractType"
            children={(field) => (
              <Field label="Contract Type">
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: "development", label: "Development", icon: Code },
                    { key: "partnership", label: "Partnership", icon: TrendingUp },
                    { key: "maintenance", label: "Maintenance", icon: Sparkles },
                  ] as const).map(({ key, label, icon: Icon }) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => field.handleChange(key)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-sm text-[12px] font-medium transition-all border ${
                        field.state.value === key
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-muted/30 text-muted-foreground/70 border-border hover:text-foreground/70"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field
              name="initialPayment"
              children={(field) => (
                <Field label="Initial Payment">
                  <input
                    className={inputBase}
                    placeholder="$5,000"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            />
            <form.Field
              name="monthlyMaintenance"
              children={(field) => (
                <Field label="Monthly Maintenance">
                  <input
                    className={inputBase}
                    placeholder="$500"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            />
          </div>

          <form.Subscribe
            selector={(state) => [state.values.contractType]}
            children={([type]) =>
              type === "partnership" && (
                <form.Field
                  name="revenueSharing"
                  children={(field) => (
                    <Field label="Revenue Sharing">
                      <input
                        className={inputBase}
                        placeholder="e.g. 20% of net revenue for 24 months"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </Field>
                  )}
                />
              )
            }
          />

          <form.Field
            name="partnershipDuration"
            children={(field) => (
              <Field label="Duration">
                <input
                  className={inputBase}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </Field>
            )}
          />
        </SectionCard>

        {/* Features */}
        <SectionCard
          icon={<CheckCircle className="h-3.5 w-3.5" />}
          title="Project Features"
          subtitle="Deliverables for the contract"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Core Features */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] text-muted-foreground/70 uppercase tracking-wider font-medium">Core Features</h3>
                <button
                  type="button"
                  onClick={() => addFeature("coreFeatures")}
                  className="flex items-center gap-1 px-2 py-0.5 bg-primary/[0.08] hover:bg-red-500/[0.12] border border-primary/15 text-primary text-[10px] rounded-sm transition-colors"
                >
                  <Plus className="h-2.5 w-2.5" /> Add
                </button>
              </div>
              <form.Field
                name="coreFeatures"
                mode="array"
                children={(field) => (
                  <div className="space-y-1.5">
                    {field.state.value.map((_, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input
                          className={inputBase}
                          placeholder={`Core feature ${i + 1}`}
                          value={field.state.value[i]}
                          onChange={(e) => updateFeature("coreFeatures", i, e.target.value)}
                        />
                        {field.state.value.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeFeature("coreFeatures", i)}
                            className="p-2 text-muted-foreground/60 hover:text-primary hover:bg-primary/[0.06] rounded-sm transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* Advanced Features */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] text-muted-foreground/70 uppercase tracking-wider font-medium">Advanced Features</h3>
                <button
                  type="button"
                  onClick={() => addFeature("advancedFeatures")}
                  className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/[0.08] hover:bg-blue-500/[0.12] border border-blue-500/15 text-blue-400 text-[10px] rounded-sm transition-colors"
                >
                  <Plus className="h-2.5 w-2.5" /> Add
                </button>
              </div>
              <form.Field
                name="advancedFeatures"
                mode="array"
                children={(field) => (
                  <div className="space-y-1.5">
                    {field.state.value.map((_, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input
                          className={inputBase}
                          placeholder={`Advanced feature ${i + 1}`}
                          value={field.state.value[i]}
                          onChange={(e) => updateFeature("advancedFeatures", i, e.target.value)}
                        />
                        {field.state.value.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeFeature("advancedFeatures", i)}
                            className="p-2 text-muted-foreground/60 hover:text-primary hover:bg-primary/[0.06] rounded-sm transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              />
            </div>
          </div>
        </SectionCard>

        {/* Special arrangements */}
        <SectionCard
          icon={<FileText className="h-3.5 w-3.5" />}
          title="Special Arrangements"
          subtitle="Optional — anything else the contract should cover"
          accent="amber"
        >
          <form.Field
            name="specialArrangements"
            children={(field) => (
              <textarea
                rows={3}
                className={`${inputBase} resize-y`}
                placeholder="Equity, NDAs, specific deliverables, custom timelines..."
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            )}
          />
        </SectionCard>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/80 text-primary-foreground text-[13px] font-medium rounded-sm transition-colors"
          >
            <FileText className="h-4 w-4" />
            Generate Contract Preview
          </button>
        </div>
      </form>
    </div>
  );
}
