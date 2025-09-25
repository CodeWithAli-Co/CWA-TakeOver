import React, { useState, useRef, RefObject } from 'react';
import { useForm } from '@tanstack/react-form';
import {
  Target,
  Settings,
  Send,
  Copy,
  RefreshCw,
  Plus,
  Minus,
  Users,
  Building,
  TrendingUp,
  Database,
  Save,
  Upload,
  Filter,
  BarChart,
  Brain,
  Lightbulb
} from 'lucide-react';

// Enhanced Button component with proper typing
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  disabled, 
  className = "", 
  variant = "default", 
  size = "default", 
  type = "button", 
  ...props 
}) => {
  const baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background";
  
  const variants = {
    default: "bg-red-600 text-white hover:bg-red-700",
    outline: "border border-red-950 hover:bg-red-900/20 hover:text-red-300 text-white",
    ghost: "hover:bg-red-900/20 hover:text-red-300 text-white",
  };
  
  const sizes = {
    default: "h-10 py-2 px-4",
    sm: "h-9 px-3 rounded-md",
    lg: "h-11 px-8 rounded-md",
  };
  
  return (
    <button
      type={type}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

// Card components with proper typing
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  ref?: RefObject<HTMLDivElement | null>;
}

const Card: React.FC<CardProps> = ({ children, className = "", ...props }) => (
  <div className={`rounded-lg border border-red-950 bg-card text-card-foreground shadow-sm ${className}`} {...props}>
    {children}
  </div>
);

const CardHeader: React.FC<CardProps> = ({ children, className = "", ...props }) => (
  <div className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props}>
    {children}
  </div>
);

const CardTitle: React.FC<CardProps> = ({ children, className = "", ...props }) => (
  <h3 className={`text-2xl font-semibold leading-none tracking-tight ${className}`} {...props}>
    {children}
  </h3>
);

const CardContent: React.FC<CardProps> = ({ children, className = "", ...props }) => (
  <div className={`p-6 pt-0 ${className}`} {...props}>
    {children}
  </div>
);

// Input components with proper typing
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input: React.FC<InputProps> = ({ className = "", type = "text", ...props }) => (
  <input
    type={type}
    className={`flex h-10 w-full rounded-md border border-red-950 bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
);

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
}

const Label: React.FC<LabelProps> = ({ children, className = "", ...props }) => (
  <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`} {...props}>
    {children}
  </label>
);

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea: React.FC<TextareaProps> = ({ className = "", ...props }) => (
  <textarea
    className={`flex min-h-[80px] w-full rounded-md border border-red-950 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
);

// Enhanced Select component with proper typing
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
  onValueChange?: (value: string) => void;
}

const Select: React.FC<SelectProps> = ({ children, value, onValueChange, ...props }) => {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-red-950 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
    </div>
  );
};

const SelectContent: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
const SelectItem: React.FC<{ children: React.ReactNode; value: string }> = ({ children, value }) => <option value={value}>{children}</option>;
const SelectTrigger: React.FC<{ children: React.ReactNode; className?: string }> = ({ children }) => <>{children}</>;
const SelectValue: React.FC<{ placeholder: string }> = ({ placeholder }) => <option value="">{placeholder}</option>;

// Badge component with proper typing
interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
}

const Badge: React.FC<BadgeProps> = ({ children, className = "", variant = "default" }) => {
  const variants = {
    default: "bg-red-600 text-white",
    secondary: "bg-red-800 text-red-100",
    destructive: "bg-red-700 text-white",
    outline: "text-red-300 border border-red-950",
  };
  
  return (
    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
};

// Tabs components with proper typing
interface TabsProps {
  children: React.ReactNode;
  defaultValue: string;
  className?: string;
}

interface TabsContextType {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const Tabs: React.FC<TabsProps> = ({ children, defaultValue, className = "" }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  
  return (
    <div className={className} data-active-tab={activeTab}>
      {React.Children.map(children, child =>
        React.isValidElement(child) ? React.cloneElement(child, { activeTab, setActiveTab } as any) : child
      )}
    </div>
  );
};

interface TabsListProps extends Partial<TabsContextType> {
  children: React.ReactNode;
  className?: string;
}

const TabsList: React.FC<TabsListProps> = ({ children, className = "", activeTab, setActiveTab }) => (
  <div className={`inline-flex h-10 items-center justify-center rounded-md bg-red-950 border border-red-950 p-1 text-red-200 ${className}`}>
    {React.Children.map(children, child =>
      React.isValidElement(child) ? React.cloneElement(child, { activeTab, setActiveTab } as any) : child
    )}
  </div>
);

interface TabsTriggerProps extends Partial<TabsContextType> {
  children: React.ReactNode;
  value: string;
  className?: string;
}

const TabsTrigger: React.FC<TabsTriggerProps> = ({ children, value, className = "", activeTab, setActiveTab }) => (
  <button
    type="button"
    className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
      activeTab === value ? 'bg-red-600 text-white shadow-sm' : 'text-red-200 hover:bg-red-800'
    } ${className}`}
    onClick={() => setActiveTab?.(value)}
  >
    {children}
  </button>
);

// I added 'className' to the interface and 'TabsContent' const's class ?ali
interface TabsContentProps extends Partial<TabsContextType> {
  children: React.ReactNode;
  value: string;
  className?: string;
}

const TabsContent: React.FC<TabsContentProps> = ({ children, value, activeTab, className }) => 
  activeTab === value ? <div className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${className}`}>{children}</div> : null;

// TypeScript interfaces
interface EmailTemplate {
  subject: string;
  body: string;
  followUpSubject: string;
  followUpBody: string;
  callToAction: string;
  personalizedOpening: string;
  valueProposition: string;
  socialProof: string;
  urgencyElement: string;
  painPointsIntegration: string;
  competitorMention: string;
}

interface LeadData {
  companyName: string;
  industry: string;
  contactName: string;
  contactEmail: string;
  companySize: string;
  website: string;
  phoneNumber: string;
  painPoints: string[];
  recentNews: string;
  competitors: string[];
  estimatedBudget: string;
  decisionMaker: boolean;
  timeframe: string;
  linkedinProfile?: string;
  companyDescription?: string;
}

interface EmailSettings {
  tone: 'professional' | 'friendly' | 'casual' | 'consultative';
  length: 'short' | 'medium' | 'detailed';
  focusArea: 'website' | 'mobile-app' | 'dashboard' | 'full-stack' | 'partnership';
  includeCaseStudy: boolean;
  includePricing: boolean;
  includeCalendlyLink: boolean;
  personalizedResearch: boolean;
  followUpSequence: boolean;
  complianceMode: boolean;
  urgencyLevel: 'low' | 'medium' | 'high';
  includeStatistics: boolean;
}

interface CampaignStats {
  emailsSent: number;
  opened: number;
  replied: number;
  meetings: number;
  openRate: number;
  replyRate: number;
  conversionRate: number;
}

interface FormData {
  leadData: LeadData;
  emailSettings: EmailSettings;
}

// Smart pricing calculation based on complexity
const calculateSmartPricing = (leadData: LeadData, emailSettings: EmailSettings): string => {
  let baseScore = 0;
  
  // Add points based on pain points complexity
  const painPointsCount = leadData.painPoints.filter(p => p.trim()).length;
  baseScore += painPointsCount * 2;
  
  // Add points based on company size
  if (leadData.companySize === '1-10') baseScore += 1;
  else if (leadData.companySize === '11-50') baseScore += 3;
  else if (leadData.companySize === '51-200') baseScore += 5;
  else if (leadData.companySize === '201-1000') baseScore += 7;
  else if (leadData.companySize === '1000+') baseScore += 10;
  
  // Add points based on focus area complexity
  if (emailSettings.focusArea === 'website') baseScore += 2;
  else if (emailSettings.focusArea === 'mobile-app') baseScore += 4;
  else if (emailSettings.focusArea === 'dashboard') baseScore += 3;
  else if (emailSettings.focusArea === 'full-stack') baseScore += 6;
  else if (emailSettings.focusArea === 'partnership') baseScore += 8;
  
  // Add points for industry complexity
  const complexIndustries = ['healthcare', 'legal', 'financial'];
  if (complexIndustries.includes(leadData.industry.toLowerCase())) {
    baseScore += 3;
  }
  
  // Determine price range based on score
  if (baseScore <= 5) return '$1,000 - $5,000';
  else if (baseScore <= 10) return '$5,000 - $15,000';
  else if (baseScore <= 15) return '$15,000 - $30,000';
  else return '$30,000+';
};

// Enhanced template generation with pain points and competitors integration
const generateIndustryTemplate = (
  industry: string, 
  leadData: LeadData, 
  settings: EmailSettings
): EmailTemplate => {
  const painPointsText = leadData.painPoints.filter(p => p.trim()).length > 0 
    ? leadData.painPoints.filter(p => p.trim()).slice(0, 2).join(' and ')
    : 'operational inefficiencies';
    
  const competitorMention = leadData.competitors.filter(c => c.trim()).length > 0
    ? `Unlike ${leadData.competitors.filter(c => c.trim())[0]}, we focus on`
    : 'Our approach focuses on';

  const smartPrice = leadData.estimatedBudget || calculateSmartPricing(leadData, settings);

  // Missing 'body' field in the objects @ali
  const industryTemplates: Record<string, Omit<EmailTemplate, 'followUpSubject' | 'followUpBody'>> = {
    restaurant: {
      subject: `${leadData.contactName ? leadData.contactName + ', ' : ''}${leadData.companyName} could be missing 67% of potential customers`,
      personalizedOpening: `I noticed ${leadData.companyName} ${leadData.recentNews ? `recently ${leadData.recentNews.toLowerCase()}, which is exciting! However, I also noticed` : 'and noticed'} you might be facing challenges with ${painPointsText}.`,
      painPointsIntegration: leadData.painPoints.filter(p => p.trim()).length > 0 
        ? `Most restaurants struggle with ${painPointsText}, which directly impacts revenue. We've seen this pattern repeatedly in the industry.`
        : `Most restaurants struggle with online ordering systems and customer retention, which directly impacts revenue.`,
      competitorMention: `${competitorMention} seamless integration between online ordering, table management, and customer loyalty programs.`,
      valueProposition: 'Custom restaurant technology that increases orders by 40% within 90 days',
      socialProof: 'We recently helped Bella Vista Restaurant increase delivery orders by 156% and reduce no-shows by 30%',
      urgencyElement: settings.urgencyLevel === 'high' ? 'Only 3 spots available for Q1 2025 restaurant projects' : 'Limited availability for restaurant projects',
      callToAction: 'Book a 15-minute restaurant growth strategy call'
    },
    healthcare: {
      subject: `${leadData.contactName ? leadData.contactName + ', ' : ''}Patient acquisition insights for ${leadData.companyName}`,
      personalizedOpening: `I was reviewing healthcare practices in your area and noticed ${leadData.companyName} ${leadData.recentNews ? `recently ${leadData.recentNews.toLowerCase()}. While researching, I discovered` : 'could significantly benefit from addressing'} ${painPointsText}.`,
      painPointsIntegration: `Healthcare practices dealing with ${painPointsText} typically lose 3-4 new patients per week to competitors with better digital experiences.`,
      competitorMention: `${competitorMention} HIPAA-compliant solutions that actually improve patient outcomes while increasing bookings.`,
      valueProposition: 'HIPAA-compliant patient portals that increase new patient bookings by 85%',
      socialProof: 'Dr. Sarah Chen at Valley Medical saw a 200% increase in online appointments and 40% improvement in patient satisfaction scores',
      urgencyElement: 'Healthcare compliance updates for 2025 require immediate attention',
      callToAction: 'Schedule a healthcare technology consultation'
    },
    ecommerce: {
      subject: `${leadData.contactName ? leadData.contactName + ', ' : ''}${leadData.companyName} conversion rate analysis`,
      personalizedOpening: `I analyzed ${leadData.companyName} and found you could potentially increase revenue by 45% by addressing ${painPointsText}.`,
      painPointsIntegration: `E-commerce sites struggling with ${painPointsText} typically lose 70% of potential customers at checkout. This represents significant missed revenue.`,
      competitorMention: `${competitorMention} advanced conversion optimization that goes beyond basic checkout improvements.`,
      valueProposition: 'E-commerce optimization that turns 45% more visitors into paying customers',
      socialProof: 'We helped TechGear Online go from $50K to $180K monthly revenue in 4 months',
      urgencyElement: 'Q4 optimization window closing - act before holiday season',
      callToAction: 'Claim your free conversion rate audit'
    }
  };

  const template = industryTemplates[industry] || industryTemplates.restaurant;
  
  const bodyParts = [
    `Hi ${leadData.contactName || 'there'},`,
    '',
    template.personalizedOpening,
    '',
    template.painPointsIntegration,
    '',
    template.competitorMention + ' ' + template.valueProposition.toLowerCase() + '.',
    '',
    template.socialProof + '.',
    '',
    settings.includeStatistics ? 'Industry data shows that businesses addressing these issues see an average ROI of 340% within 6 months.' : '',
    settings.includeStatistics ? '' : '',
    `Would you be interested in a brief call to discuss how we could help ${leadData.companyName} achieve similar results?`,
    '',
    settings.includePricing ? `Based on your requirements, project investment would typically be in the ${smartPrice} range.` : '',
    settings.includePricing ? '' : '',
    'Best regards,',
    'Ali Alibrahimi',
    'CEO, Convergent',
    settings.includeCalendlyLink ? 'Schedule a call: https://calendly.com/convergent-consult' : 'contact@convergent.dev'
  ].filter(line => line !== null);

  const followUpBodyParts = [
    `Hi ${leadData.contactName || 'there'},`,
    '',
    `Following up on my message about ${painPointsText} at ${leadData.companyName}.`,
    '',
    `Most businesses we work with initially hesitate, then realize they were losing significant revenue due to these exact issues.`,
    '',
    `Quick question: What's your biggest priority for addressing ${painPointsText.split(' and ')[0]} right now?`,
    '',
    'Best,',
    'Ali'
  ];

  return {
    subject: template.subject,
    body: bodyParts.join('\n'),
    followUpSubject: `Following up: ${painPointsText} solution for ${leadData.companyName}`,
    followUpBody: followUpBodyParts.join('\n'),
    callToAction: template.callToAction,
    personalizedOpening: template.personalizedOpening,
    valueProposition: template.valueProposition,
    socialProof: template.socialProof,
    urgencyElement: template.urgencyElement,
    painPointsIntegration: template.painPointsIntegration,
    competitorMention: template.competitorMention
  };
};

const EnhancedColdEmailGenerator: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [generatedTemplate, setGeneratedTemplate] = useState<EmailTemplate | null>(null);
  const [currentDate] = useState(new Date().toLocaleDateString('en-US'));
  
  const [campaignStats] = useState<CampaignStats>({
    emailsSent: 247,
    opened: 89,
    replied: 23,
    meetings: 8,
    openRate: 36.0,
    replyRate: 9.3,
    conversionRate: 3.2
  });

  const emailPreviewRef = useRef<HTMLDivElement>(null);

  // TanStack Form setup with proper typing

  // This looks good so i'll disable the TS error here ?ali
  // @ts-expect-error ( all fields are written )
  const form = useForm<FormData>({
    defaultValues: {
      leadData: {
        companyName: '',
        industry: '',
        contactName: '',
        contactEmail: '',
        companySize: '',
        website: '',
        phoneNumber: '',
        painPoints: [''],
        recentNews: '',
        competitors: [''],
        estimatedBudget: '',
        decisionMaker: false,
        timeframe: '',
        linkedinProfile: '',
        companyDescription: ''
      },
      emailSettings: {
        tone: 'professional',
        length: 'medium',
        focusArea: 'website',
        includeCaseStudy: true,
        includePricing: false,
        includeCalendlyLink: true,
        personalizedResearch: true,
        followUpSequence: true,
        complianceMode: true,
        urgencyLevel: 'medium',
        includeStatistics: true
      }
    },
    onSubmit: async ({ value }) => {
      await generateEmailTemplate(value.leadData, value.emailSettings);
    }
  });

  const generateEmailTemplate = async (leadData: LeadData, emailSettings: EmailSettings): Promise<void> => {
    setIsGenerating(true);
    
    try {
      // Enhanced template generation with better industry detection and personalization
      const template = generateIndustryTemplate(leadData.industry.toLowerCase(), leadData, emailSettings);
      
      setTimeout(() => {
        setGeneratedTemplate(template);
        setIsGenerating(false);
        setShowPreview(true);
      }, 2000);
      
    } catch (error) {
      console.error('Email generation failed:', error);
      setIsGenerating(false);
    }
  };

  const loadSampleData = (): void => {
    form.setFieldValue('leadData', {
      companyName: 'Bella Vista Restaurant',
      industry: 'restaurant',
      contactName: 'Maria Rodriguez',
      contactEmail: 'maria@bellavista.com',
      companySize: '10-50 employees',
      website: 'bellavista.com',
      phoneNumber: '+1 (555) 123-4567',
      painPoints: ['Limited online ordering', 'Poor mobile experience', 'No table reservations online'],
      recentNews: 'expanded to second location',
      competitors: ['Local Italian Kitchen', 'Giuseppe\'s Bistro'],
      estimatedBudget: '$5,000 - $15,000',
      decisionMaker: true,
      timeframe: '3-6 months',
      linkedinProfile: 'linkedin.com/in/maria-rodriguez-chef',
      companyDescription: 'Family-owned Italian restaurant focusing on authentic cuisine'
    });
  };

  const addPainPoint = (): void => {
    const currentPainPoints = form.getFieldValue('leadData.painPoints') || [''];
    form.setFieldValue('leadData.painPoints', [...currentPainPoints, '']);
  };

  const removePainPoint = (index: number): void => {
    const currentPainPoints = form.getFieldValue('leadData.painPoints') || [''];
    if (currentPainPoints.length > 1) {
      form.setFieldValue('leadData.painPoints', currentPainPoints.filter((_, i) => i !== index));
    }
  };

  const addCompetitor = (): void => {
    const currentCompetitors = form.getFieldValue('leadData.competitors') || [''];
    form.setFieldValue('leadData.competitors', [...currentCompetitors, '']);
  };

  const removeCompetitor = (index: number): void => {
    const currentCompetitors = form.getFieldValue('leadData.competitors') || [''];
    if (currentCompetitors.length > 1) {
      form.setFieldValue('leadData.competitors', currentCompetitors.filter((_, i) => i !== index));
    }
  };

  const copyToClipboard = async (): Promise<void> => {
    if (generatedTemplate) {
      const emailContent = `Subject: ${generatedTemplate.subject}\n\n${generatedTemplate.body}`;
      await navigator.clipboard.writeText(emailContent);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    form.handleSubmit();
  };

  if (!showPreview) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              AI-Powered Cold Email Generator
            </h1>
            <p className="text-xl text-white">
              Advanced personalization with pain point & competitor analysis
            </p>
          </div>

          {/* Campaign Stats Dashboard */}
          <Card className="mb-8 bg-zinc-950 border-red-950">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart className="w-5 h-5 text-red-400" />
                Campaign Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-zinc-900 rounded-lg border border-red-950">
                  <div className="text-2xl font-bold text-white">{campaignStats.emailsSent}</div>
                  <div className="text-sm text-gray-300">Emails Sent</div>
                </div>
                <div className="text-center p-4 bg-zinc-900 rounded-lg border border-red-950">
                  <div className="text-2xl font-bold text-green-400">{campaignStats.openRate}%</div>
                  <div className="text-sm text-gray-300">Open Rate</div>
                </div>
                <div className="text-center p-4 bg-zinc-900 rounded-lg border border-red-950">
                  <div className="text-2xl font-bold text-yellow-400">{campaignStats.replyRate}%</div>
                  <div className="text-sm text-gray-300">Reply Rate</div>
                </div>
                <div className="text-center p-4 bg-zinc-900 rounded-lg border border-red-950">
                  <div className="text-2xl font-bold text-purple-400">{campaignStats.meetings}</div>
                  <div className="text-sm text-gray-300">Meetings Booked</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="single" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-zinc-950 border border-red-950">
              <TabsTrigger value="single">Single Email</TabsTrigger>
              <TabsTrigger value="bulk">Bulk Campaign</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-6">
              {/* Quick Actions */}
              <Card className="bg-zinc-950 border-red-950">
                <CardContent className="p-4">
                  <div className="flex gap-3 justify-center">
                    <Button onClick={loadSampleData} variant="outline" className="border-red-950 text-white">
                      <Database className="w-4 h-4 mr-2" />
                      Load Sample Data
                    </Button>
                    <Button onClick={handleSubmit} disabled={isGenerating} className="bg-red-600 hover:bg-red-700">
                      <Brain className="w-4 h-4 mr-2" />
                      {isGenerating ? "Generating..." : "Generate AI Email"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Lead Information */}
                <Card className="bg-zinc-950 border-red-950">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Target className="w-5 h-5 text-red-400" />
                      Lead Intelligence
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <form.Field name="leadData.companyName">
                        {(field) => (
                          <div>
                            <Label className="text-white">Company Name</Label>
                            <Input
                              placeholder="Acme Corp"
                              value={field.state.value}
                              onChange={(e) => field.handleChange(e.target.value)}
                              className="bg-black border-red-950 text-white"
                            />
                          </div>
                        )}
                      </form.Field>
                      
                      <form.Field name="leadData.industry">
                        {(field) => (
                          <div>
                            <Label className="text-white">Industry</Label>
                            <Select value={field.state.value} onValueChange={(value) => field.handleChange(value)}>
                              <SelectValue placeholder="Select industry" />
                              <SelectItem value="">Select industry</SelectItem>
                              <SelectItem value="restaurant">Restaurant/Food</SelectItem>
                              <SelectItem value="healthcare">Healthcare</SelectItem>
                              <SelectItem value="ecommerce">E-commerce/Retail</SelectItem>
                              <SelectItem value="real estate">Real Estate</SelectItem>
                              <SelectItem value="legal">Legal/Law</SelectItem>
                              <SelectItem value="fitness">Fitness/Gym</SelectItem>
                              <SelectItem value="education">Education</SelectItem>
                              <SelectItem value="manufacturing">Manufacturing</SelectItem>
                              <SelectItem value="nonprofit">Nonprofit</SelectItem>
                              <SelectItem value="technology">Technology</SelectItem>
                            </Select>
                          </div>
                        )}
                      </form.Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <form.Field name="leadData.contactName">
                        {(field) => (
                          <div>
                            <Label className="text-white">Contact Name</Label>
                            <Input
                              placeholder="John Smith"
                              value={field.state.value}
                              onChange={(e) => field.handleChange(e.target.value)}
                              className="bg-black border-red-950 text-white"
                            />
                          </div>
                        )}
                      </form.Field>
                      
                      <form.Field name="leadData.contactEmail">
                        {(field) => (
                          <div>
                            <Label className="text-white">Contact Email</Label>
                            <Input
                              placeholder="john@acmecorp.com"
                              type="email"
                              value={field.state.value}
                              onChange={(e) => field.handleChange(e.target.value)}
                              className="bg-black border-red-950 text-white"
                            />
                          </div>
                        )}
                      </form.Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <form.Field name="leadData.companySize">
                        {(field) => (
                          <div>
                            <Label className="text-white">Company Size</Label>
                            <Select value={field.state.value}  onValueChange={(value) => field.handleChange(value)}>
                              <SelectValue placeholder="Select size" />
                              <SelectItem value="">Select size</SelectItem>
                              <SelectItem value="1-10">1-10 employees</SelectItem>
                              <SelectItem value="11-50">11-50 employees</SelectItem>
                              <SelectItem value="51-200">51-200 employees</SelectItem>
                              <SelectItem value="201-1000">201-1000 employees</SelectItem>
                              <SelectItem value="1000+">1000+ employees</SelectItem>
                            </Select>
                          </div>
                        )}
                      </form.Field>

                      <form.Field name="leadData.website">
                        {(field) => (
                          <div>
                            <Label className="text-white">Website</Label>
                            <Input
                              placeholder="acmecorp.com"
                              value={field.state.value}
                              onChange={(e) => field.handleChange(e.target.value)}
                              className="bg-black border-red-950 text-white"
                            />
                          </div>
                        )}
                      </form.Field>
                    </div>

                    <form.Field name="leadData.recentNews">
                      {(field) => (
                        <div>
                          <Label className="text-white">Recent News/Updates</Label>
                          <Textarea
                            placeholder="Recently raised funding, expanded to new location, etc."
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            className="bg-black border-red-950 text-white"
                            rows={2}
                          />
                        </div>
                      )}
                    </form.Field>

                    {/* Enhanced Pain Points Section */}
                    <div>
                      <Label className="text-white mb-2 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-yellow-400" />
                        Pain Points/Challenges (Used in email content)
                      </Label>
                      <form.Field name="leadData.painPoints">
                        {(field) => (
                          <div>
                            {field.state.value.map((painPoint: string, index: number) => (
                              <div key={index} className="flex gap-2 mb-2">
                                <Input
                                  placeholder="e.g., Low online visibility, poor website performance"
                                  value={painPoint}
                                  onChange={(e) => {
                                    const newPainPoints = [...field.state.value];
                                    newPainPoints[index] = e.target.value;
                                    field.handleChange(newPainPoints);
                                  }}
                                  className="bg-black border-red-950 text-white"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removePainPoint(index)}
                                  disabled={field.state.value.length === 1}
                                  className="border-red-950 hover:bg-red-900/20"
                                >
                                  <Minus className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={addPainPoint}
                              className="border-green-600 text-green-400 hover:bg-green-500/20"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Pain Point
                            </Button>
                          </div>
                        )}
                      </form.Field>
                    </div>

                    {/* Enhanced Competitors Section */}
                    <div>
                      <Label className="text-white mb-2 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                        Known Competitors (Referenced in positioning)
                      </Label>
                      <form.Field name="leadData.competitors">
                        {(field) => (
                          <div>
                            {field.state.value.map((competitor: string, index: number) => (
                              <div key={index} className="flex gap-2 mb-2">
                                <Input
                                  placeholder="Competitor name"
                                  value={competitor}
                                  onChange={(e) => {
                                    const newCompetitors = [...field.state.value];
                                    newCompetitors[index] = e.target.value;
                                    field.handleChange(newCompetitors);
                                  }}
                                  className="bg-black border-red-950 text-white"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeCompetitor(index)}
                                  disabled={field.state.value.length === 1}
                                  className="border-red-950 hover:bg-red-900/20"
                                >
                                  <Minus className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={addCompetitor}
                              className="border-green-600 text-green-400 hover:bg-green-500/20"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Competitor
                            </Button>
                          </div>
                        )}
                      </form.Field>
                    </div>
                  </CardContent>
                </Card>

                {/* Enhanced Email Settings */}
                <Card className="bg-zinc-950 border-red-950">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Settings className="w-5 h-5 text-red-400" />
                      AI Email Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <form.Field name="emailSettings.tone">
                        {(field) => (
                          <div>
                            <Label className="text-white">Tone</Label>
                            <Select value={field.state.value} onValueChange={(value) => field.handleChange(value as typeof field.state.value)}>
                              <SelectValue placeholder="Select tone" />
                              <SelectItem value="professional">Professional</SelectItem>
                              <SelectItem value="friendly">Friendly</SelectItem>
                              <SelectItem value="casual">Casual</SelectItem>
                              <SelectItem value="consultative">Consultative</SelectItem>
                            </Select>
                          </div>
                        )}
                      </form.Field>
                      
                      <form.Field name="emailSettings.length">
                        {(field) => (
                          <div>
                            <Label className="text-white">Length</Label>
                            <Select value={field.state.value} onValueChange={(value) => field.handleChange(value as typeof field.state.value)}>
                              <SelectValue placeholder="Select length" />
                              <SelectItem value="short">Short (2-3 sentences)</SelectItem>
                              <SelectItem value="medium">Medium (4-6 sentences)</SelectItem>
                              <SelectItem value="detailed">Detailed (7+ sentences)</SelectItem>
                            </Select>
                          </div>
                        )}
                      </form.Field>
                    </div>

                    <form.Field name="emailSettings.focusArea">
                      {(field) => (
                        <div>
                          <Label className="text-white">Focus Area</Label>
                          <Select value={field.state.value} onValueChange={(value) => field.handleChange(value as typeof field.state.value)}>
                            <SelectValue placeholder="Select focus area" />
                            <SelectItem value="website">Website Development</SelectItem>
                            <SelectItem value="mobile-app">Mobile App Development</SelectItem>
                            <SelectItem value="dashboard">Business Dashboard</SelectItem>
                            <SelectItem value="full-stack">Full-Stack Solution</SelectItem>
                            <SelectItem value="partnership">Development Partnership</SelectItem>
                          </Select>
                        </div>
                      )}
                    </form.Field>

                    <div className="grid grid-cols-2 gap-4">
                      <form.Field name="leadData.estimatedBudget">
                        {(field) => (
                          <div>
                            <Label className="text-white">Estimated Budget</Label>
                            <Select 
                              value={field.state.value} 
                              onValueChange={(value) => field.handleChange(value)}
                            >
                              <SelectValue placeholder="Auto-calculated or manual" />
                              <SelectItem value="">Auto-calculate based on complexity</SelectItem>
                              <SelectItem value="$1,000 - $5,000">$1,000 - $5,000</SelectItem>
                              <SelectItem value="$5,000 - $15,000">$5,000 - $15,000</SelectItem>
                              <SelectItem value="$15,000 - $30,000">$15,000 - $30,000</SelectItem>
                              <SelectItem value="$30,000+">$30,000+</SelectItem>
                            </Select>
                          </div>
                        )}
                      </form.Field>
                      
                      <form.Field name="leadData.timeframe">
                        {(field) => (
                          <div>
                            <Label className="text-white">Project Timeframe</Label>
                            <Select value={field.state.value} onValueChange={(value) => field.handleChange(value)}>
                              <SelectValue placeholder="Select timeframe" />
                              <SelectItem value="">Select timeframe</SelectItem>
                              <SelectItem value="ASAP">ASAP</SelectItem>
                              <SelectItem value="1-3 months">1-3 months</SelectItem>
                              <SelectItem value="3-6 months">3-6 months</SelectItem>
                              <SelectItem value="6+ months">6+ months</SelectItem>
                            </Select>
                          </div>
                        )}
                      </form.Field>
                    </div>

                    <div className="space-y-3">
                      <form.Field name="emailSettings.includeStatistics">
                        {(field) => (
                          <div className="flex items-center justify-between">
                            <Label className="text-white">Include Industry Statistics</Label>
                            <input
                              type="checkbox"
                              checked={field.state.value}
                              onChange={(e) => field.handleChange(e.target.checked)}
                              className="w-4 h-4 accent-red-600"
                            />
                          </div>
                        )}
                      </form.Field>

                      <form.Field name="emailSettings.includeCaseStudy">
                        {(field) => (
                          <div className="flex items-center justify-between">
                            <Label className="text-white">Include Case Study</Label>
                            <input
                              type="checkbox"
                              checked={field.state.value}
                              onChange={(e) => field.handleChange(e.target.checked)}
                              className="w-4 h-4 accent-red-600"
                            />
                          </div>
                        )}
                      </form.Field>

                      <form.Field name="emailSettings.includePricing">
                        {(field) => (
                          <div className="flex items-center justify-between">
                            <Label className="text-white">Include Pricing Range</Label>
                            <input
                              type="checkbox"
                              checked={field.state.value}
                              onChange={(e) => field.handleChange(e.target.checked)}
                              className="w-4 h-4 accent-red-600"
                            />
                          </div>
                        )}
                      </form.Field>

                      <form.Field name="emailSettings.includeCalendlyLink">
                        {(field) => (
                          <div className="flex items-center justify-between">
                            <Label className="text-white">Include Calendly Link</Label>
                            <input
                              type="checkbox"
                              checked={field.state.value}
                              onChange={(e) => field.handleChange(e.target.checked)}
                              className="w-4 h-4 accent-red-600"
                            />
                          </div>
                        )}
                      </form.Field>

                      <form.Field name="emailSettings.followUpSequence">
                        {(field) => (
                          <div className="flex items-center justify-between">
                            <Label className="text-white">Generate Follow-up Email</Label>
                            <input
                              type="checkbox"
                              checked={field.state.value}
                              onChange={(e) => field.handleChange(e.target.checked)}
                              className="w-4 h-4 accent-red-600"
                            />
                          </div>
                        )}
                      </form.Field>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="bulk" className="space-y-6">
              <Card className="bg-zinc-950 border-red-950">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-red-400" />
                    Bulk Campaign Management
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <Button className="bg-green-600 hover:bg-green-700">
                        <Upload className="w-4 h-4 mr-2" />
                        Import CSV
                      </Button>
                      <Button variant="outline" className="border-red-950 text-white">
                        <Filter className="w-4 h-4 mr-2" />
                        Filter Leads
                      </Button>
                      <Button variant="outline" className="border-purple-500 text-purple-300">
                        <Send className="w-4 h-4 mr-2" />
                        Schedule Campaign
                      </Button>
                    </div>
                    <div className="text-center py-12 text-gray-400">
                      <Building className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-xl mb-2">Bulk Campaign Features</h3>
                      <p>Upload lead lists, schedule campaigns, and track performance at scale.</p>
                      <p className="text-sm mt-2">Enhanced features coming in v2.0</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <Card className="bg-zinc-950 border-red-950">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-red-400" />
                    Campaign Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-400">
                    <BarChart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-xl mb-2">Advanced Analytics Dashboard</h3>
                    <p>Track open rates, reply rates, conversion metrics, and ROI across all campaigns.</p>
                    <p className="text-sm mt-2">Advanced analytics coming in v2.0</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  // Email Preview Page
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-red-900 to-black p-6">
      <div className="max-w-6xl mx-auto">
        {/* Action Bar */}
        <div className="flex justify-between items-center mb-6 bg-zinc-950 rounded-lg p-4 border border-red-950">
          <div className="flex gap-3">
            <Button onClick={() => setShowPreview(false)} variant="outline" className="border-red-950 text-white">
              ← Back to Generator
            </Button>
            <Button onClick={copyToClipboard} variant="outline" className="border-yellow-500 text-yellow-300">
              <Copy className="w-4 h-4 mr-2" />
              Copy Email
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Badge className="bg-green-600">
              Email Generated with AI Analysis
            </Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Email Preview */}
          <div className="lg:col-span-2">
            <Card className="bg-white text-white border-red-950">
              <CardContent className="p-8" ref={emailPreviewRef}>
                <div className="border-b border-red-950 pb-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-200">
                      <strong>From:</strong> Ali Alibrahimi &lt;ali@convergent.dev&gt;
                    </div>
                    <div className="text-sm text-gray-200">
                      {currentDate}
                    </div>
                  </div>
                  <div className="text-sm text-gray-200 mb-2">
                    <strong>To:</strong> {form.getFieldValue('leadData.contactEmail') || 'prospect@company.com'}
                  </div>
                  <div className="text-lg font-semibold">
                    <strong>Subject:</strong> {generatedTemplate?.subject}
                  </div>
                </div>

                <div className="whitespace-pre-line text-gray-900 leading-relaxed">
                  {generatedTemplate?.body}
                </div>

                {form.getFieldValue('emailSettings.followUpSequence') && generatedTemplate && (
                  <div className="mt-8 pt-6 border-t border-red-950">
                    <h3 className="font-semibold mb-4 text-gray-700">Follow-up Email:</h3>
                    <div className="bg-gray-50 p-4 rounded-lg border border-red-950">
                      <div className="text-sm font-semibold mb-2">
                        <strong>Subject:</strong> {generatedTemplate.followUpSubject}
                      </div>
                      <div className="whitespace-pre-line text-gray-800">
                        {generatedTemplate.followUpBody}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Analysis Panel */}
          <div className="space-y-6">
            <Card className="bg-zinc-950 border-red-950">
              <CardHeader>
                <CardTitle className="text-white text-sm">AI Analysis Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-white text-xs">Pain Points Used</span>
                  <Badge className="bg-green-600">
                    {form.getFieldValue('leadData.painPoints')?.filter((p: string) => p.trim()).length || 0}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white text-xs">Competitor Analysis</span>
                  <Badge className="bg-blue-600">
                    {form.getFieldValue('leadData.competitors')?.filter((c: string) => c.trim()).length > 0 ? 'Integrated' : 'Generic'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white text-xs">Smart Pricing</span>
                  <Badge className="bg-purple-600">
                    {form.getFieldValue('leadData.estimatedBudget') || calculateSmartPricing(form.getFieldValue('leadData'), form.getFieldValue('emailSettings'))}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white text-xs">Personalization Score</span>
                  <Badge className="bg-green-600">High</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-950 border-red-950">
              <CardHeader>
                <CardTitle className="text-white text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </Button>
                <Button onClick={() => setShowPreview(false)} className="w-full" variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerate with AI
                </Button>
                <Button className="w-full" variant="outline">
                  <Save className="w-4 h-4 mr-2" />
                  Save Template
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-white text-sm">
          Generated by Convergent AI Cold Email Engine • Enhanced with Pain Point & Competitor Analysis • {currentDate}
        </div>
      </div>
    </div>
  );
};

export default EnhancedColdEmailGenerator;