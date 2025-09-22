import React, { useState, useRef, useEffect } from 'react';
import {
  Mail,
  Target,
  Zap,
  Settings,
  Send,
  Eye,
  Copy,
  Download,
  RefreshCw,
  Plus,
  Minus,
  Users,
  Building,
  TrendingUp,
  Database,
  FileText,
  Wand2,
  Save,
  Upload,
  Filter,
  Globe,
  Phone,
  Calendar,
  CheckCircle,
  AlertTriangle,
  BarChart
} from 'lucide-react';
import { Button } from '@/components/ui/shadcnComponents/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/shadcnComponents/card';
import { Input } from '@/components/ui/shadcnComponents/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/shadcnComponents/select';
import { Badge } from '@/components/ui/shadcnComponents/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/shadcnComponents/tabs';
import { Switch } from '@/components/ui/shadcnComponents/switch';
import { Label } from '@/components/ui/shadcnComponents/label';

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
}

interface EmailSettings {
  tone: 'professional' | 'friendly' | 'casual' | 'consultative';
  length: 'short' | 'medium' | 'detailed';
  focusArea: 'website' | 'mobile-app' | 'dashboard' | 'full-stack' | 'partnership';
  includeCasestudy: boolean;
  includePricing: boolean;
  includeCalendlyLink: boolean;
  personalizedResearch: boolean;
  followUpSequence: boolean;
  complianceMode: boolean;
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

export default function ColdEmailGenerator(): JSX.Element {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [showBulkMode, setShowBulkMode] = useState<boolean>(false);
  const [currentDate] = useState(new Date().toLocaleDateString('en-US'));
  
  // Form state
  const [leadData, setLeadData] = useState<LeadData>({
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
    timeframe: ''
  });

  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    tone: 'professional',
    length: 'medium',
    focusArea: 'website',
    includeCasestudy: true,
    includePricing: false,
    includeCalendlyLink: true,
    personalizedResearch: true,
    followUpSequence: true,
    complianceMode: true
  });

  const [generatedTemplate, setGeneratedTemplate] = useState<EmailTemplate>({
    subject: '',
    body: '',
    followUpSubject: '',
    followUpBody: '',
    callToAction: '',
    personalizedOpening: '',
    valueProposition: '',
    socialProof: '',
    urgencyElement: ''
  });

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

  // Industry-specific email generation
  const generateEmailTemplate = async (): Promise<void> => {
    setIsGenerating(true);
    
    try {
      // Simulate AI generation based on industry and settings
      let template: EmailTemplate;
      
      switch (leadData.industry.toLowerCase()) {
        case 'restaurant':
        case 'food':
          template = generateRestaurantTemplate();
          break;
        case 'healthcare':
        case 'medical':
          template = generateHealthcareTemplate();
          break;
        case 'ecommerce':
        case 'retail':
          template = generateEcommerceTemplate();
          break;
        case 'real estate':
          template = generateRealEstateTemplate();
          break;
        case 'legal':
        case 'law':
          template = generateLegalTemplate();
          break;
        case 'fitness':
        case 'gym':
          template = generateFitnessTemplate();
          break;
        case 'education':
          template = generateEducationTemplate();
          break;
        case 'manufacturing':
          template = generateManufacturingTemplate();
          break;
        case 'nonprofit':
          template = generateNonprofitTemplate();
          break;
        default:
          template = generateGenericTemplate();
      }
      
      // Apply personalization and settings
      template = personalizeTemplate(template);
      
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

  const generateRestaurantTemplate = (): EmailTemplate => {
    const templates = {
      professional: {
        subject: `${leadData.contactName ? leadData.contactName + ', ' : ''}Quick question about ${leadData.companyName}'s online ordering`,
        body: `Hi ${leadData.contactName || 'there'},

I was looking at ${leadData.companyName} and noticed you might be missing out on the 67% of customers who research restaurants online before visiting.

Most restaurants we work with see a 40% increase in orders within 3 months of launching a proper online ordering system.

We recently helped a local Italian restaurant increase their delivery orders by 156% by building them a custom website with integrated ordering and table reservations.

Would you be interested in a 15-minute call to see how we could help ${leadData.companyName} capture more online orders?

Best regards,
Ali Alibrahimi
CEO, Convergent
contact@convergent.dev`,
        callToAction: 'Book a 15-minute strategy call',
        personalizedOpening: `I noticed ${leadData.companyName} has great reviews, but your website could be converting more visitors into customers.`,
        valueProposition: 'Custom restaurant websites that turn browsers into buyers',
        socialProof: 'Helped 50+ restaurants increase online orders by an average of 40%'
      }
    };
    
    return {
      ...templates.professional,
      followUpSubject: `Following up: Online ordering solution for ${leadData.companyName}`,
      followUpBody: `Hi ${leadData.contactName || 'there'},

I sent you a message last week about increasing online orders for ${leadData.companyName}.

I understand you're busy running the restaurant, but this is exactly why most restaurant owners we work with wish they'd acted sooner.

Quick question: What's your biggest challenge with online orders right now?

Best,
Ali`,
      urgencyElement: 'Limited spots available for Q1 2025 projects'
    };
  };

  const generateHealthcareTemplate = (): EmailTemplate => {
    return {
      subject: `${leadData.contactName ? leadData.contactName + ', ' : ''}Patient experience insights for ${leadData.companyName}`,
      body: `Hi ${leadData.contactName || 'there'},

I was reviewing healthcare websites in your area and noticed ${leadData.companyName} could significantly improve patient acquisition with a few strategic changes.

We've helped medical practices increase new patient bookings by 85% through HIPAA-compliant websites with integrated scheduling.

Dr. Sarah Chen at Valley Medical saw a 200% increase in online appointment bookings after we redesigned their patient portal.

Would you be open to a brief call to discuss how we could help ${leadData.companyName} attract more patients online?

Best regards,
Ali Alibrahimi
CEO, Convergent`,
      followUpSubject: `Quick follow-up: Patient acquisition for ${leadData.companyName}`,
      followUpBody: `Hi ${leadData.contactName},

Following up on my message about improving patient experience for ${leadData.companyName}.

Many healthcare providers we work with initially hesitate, then realize they were losing 3-4 new patients per week to competitors with better online experiences.

What's your current biggest challenge with patient acquisition?

Best,
Ali`,
      callToAction: 'Schedule a healthcare strategy session',
      personalizedOpening: 'Healthcare patients expect seamless digital experiences',
      valueProposition: 'HIPAA-compliant websites that convert visitors into patients',
      socialProof: 'Trusted by 25+ healthcare practices',
      urgencyElement: 'Q1 healthcare compliance updates require action'
    };
  };

  const generateEcommerceTemplate = (): EmailTemplate => {
    return {
      subject: `${leadData.contactName ? leadData.contactName + ', ' : ''}${leadData.companyName}'s conversion rate optimization`,
      body: `Hi ${leadData.contactName || 'there'},

I was analyzing e-commerce sites in your industry and found that ${leadData.companyName} could potentially increase revenue by 45% with some strategic improvements.

We recently helped an online retailer go from $50K to $180K monthly revenue by optimizing their checkout flow and mobile experience.

Most e-commerce sites lose 70% of customers at checkout. We've solved this problem for 40+ online stores.

Would you be interested in a free conversion audit for ${leadData.companyName}?

Best regards,
Ali Alibrahimi
CEO, Convergent`,
      followUpSubject: `Free conversion audit for ${leadData.companyName}`,
      followUpBody: `Hi ${leadData.contactName},

Still interested in that free conversion audit for ${leadData.companyName}?

I've reserved a spot for you this week. The audit alone typically reveals $10K+ in missed revenue opportunities.

No strings attached - just actionable insights you can implement immediately.

Interested?

Best,
Ali`,
      callToAction: 'Claim your free conversion audit',
      personalizedOpening: 'E-commerce success depends on conversion optimization',
      valueProposition: 'Turn more visitors into paying customers',
      socialProof: 'Increased revenue for 40+ online stores',
      urgencyElement: 'Limited free audits available this month'
    };
  };

  const generateRealEstateTemplate = (): EmailTemplate => {
    return {
      subject: `${leadData.contactName ? leadData.contactName + ', ' : ''}Lead generation insight for ${leadData.companyName}`,
      body: `Hi ${leadData.contactName || 'there'},

I noticed ${leadData.companyName} and wanted to share something interesting: 95% of home buyers start their search online, but most real estate websites fail to capture these leads.

We recently helped a local realtor increase qualified leads by 150% with a website that actually converts visitors into clients.

The key? Interactive property search, automated lead nurturing, and mobile-first design.

Would you be open to seeing how we could help ${leadData.companyName} capture more online leads?

Best regards,
Ali Alibrahimi
CEO, Convergent`,
      followUpSubject: `Following up: Lead generation for ${leadData.companyName}`,
      followUpBody: `Hi ${leadData.contactName},

Quick follow-up about increasing online leads for ${leadData.companyName}.

Most realtors we work with are surprised to learn they're losing 60-80% of potential clients due to poor website experience.

What's your biggest challenge with online lead generation right now?

Best,
Ali`,
      callToAction: 'Schedule a real estate lead strategy call',
      personalizedOpening: 'Real estate success starts with online lead capture',
      valueProposition: 'Websites that turn property browsers into qualified leads',
      socialProof: 'Helped realtors generate 1000+ qualified leads',
      urgencyElement: 'Spring buying season preparation'
    };
  };

  const generateLegalTemplate = (): EmailTemplate => {
    return {
      subject: `${leadData.contactName ? leadData.contactName + ', ' : ''}Client acquisition strategy for ${leadData.companyName}`,
      body: `Hi ${leadData.contactName || 'there'},

I was researching law firms in your area and noticed ${leadData.companyName} could be attracting significantly more qualified clients online.

We recently helped a personal injury firm increase case inquiries by 120% through a website that builds trust and demonstrates expertise.

The legal industry is becoming increasingly competitive online. Firms with professional, conversion-optimized websites are capturing most of the high-value cases.

Would you be interested in discussing how we could help ${leadData.companyName} attract better clients?

Best regards,
Ali Alibrahimi
CEO, Convergent`,
      followUpSubject: `Quick follow-up: Client acquisition for ${leadData.companyName}`,
      followUpBody: `Hi ${leadData.contactName},

Following up on client acquisition strategies for ${leadData.companyName}.

Many attorneys we work with initially think referrals are enough, then realize they're missing out on thousands of potential clients searching online every month.

What's your current approach to attracting new clients?

Best,
Ali`,
      callToAction: 'Schedule a legal marketing consultation',
      personalizedOpening: 'Legal clients expect professional online presence',
      valueProposition: 'Professional websites that attract high-value clients',
      socialProof: 'Trusted by 15+ law firms',
      urgencyElement: 'Legal marketing landscape changing rapidly'
    };
  };

  const generateFitnessTemplate = (): EmailTemplate => {
    return {
      subject: `${leadData.contactName ? leadData.contactName + ', ' : ''}Member retention insight for ${leadData.companyName}`,
      body: `Hi ${leadData.contactName || 'there'},

I was looking at fitness businesses in your area and noticed ${leadData.companyName} could potentially increase member retention by 40% with the right digital tools.

We recently helped a local gym reduce membership cancellations by 60% through a custom member portal with workout tracking and community features.

Most gym members cancel because they lose motivation. We solve this with engagement-focused websites and apps.

Would you be interested in learning how we could help ${leadData.companyName} keep members longer?

Best regards,
Ali Alibrahimi
CEO, Convergent`,
      followUpSubject: `Member retention solution for ${leadData.companyName}`,
      followUpBody: `Hi ${leadData.contactName},

Still thinking about member retention for ${leadData.companyName}?

Every month you wait, you're potentially losing members who would have stayed with the right digital experience.

Quick question: What's your current member retention rate?

Best,
Ali`,
      callToAction: 'Book a fitness industry strategy call',
      personalizedOpening: 'Fitness success depends on member engagement',
      valueProposition: 'Digital solutions that keep members motivated',
      socialProof: 'Helped gyms improve retention by average 40%',
      urgencyElement: 'New Year resolution season approaching'
    };
  };

  const generateEducationTemplate = (): EmailTemplate => {
    return {
      subject: `${leadData.contactName ? leadData.contactName + ', ' : ''}Student engagement solution for ${leadData.companyName}`,
      body: `Hi ${leadData.contactName || 'there'},

I was reviewing educational websites and noticed ${leadData.companyName} could significantly improve student engagement with modern digital tools.

We recently helped a training institute increase course completion rates by 75% through an interactive learning platform.

Students today expect seamless digital experiences. Institutions that adapt are seeing higher enrollment and retention.

Would you be open to discussing how we could help ${leadData.companyName} better serve students?

Best regards,
Ali Alibrahimi
CEO, Convergent`,
      followUpSubject: `Digital transformation for ${leadData.companyName}`,
      followUpBody: `Hi ${leadData.contactName},

Following up about digital solutions for ${leadData.companyName}.

Education is rapidly evolving. Institutions that don't adapt to student expectations risk being left behind.

What's your biggest challenge with student engagement?

Best,
Ali`,
      callToAction: 'Schedule an education technology consultation',
      personalizedOpening: 'Modern students expect digital-first experiences',
      valueProposition: 'EdTech solutions that improve student outcomes',
      socialProof: 'Helped educational institutions serve 10,000+ students',
      urgencyElement: 'Academic year planning window'
    };
  };

  const generateManufacturingTemplate = (): EmailTemplate => {
    return {
      subject: `${leadData.contactName ? leadData.contactName + ', ' : ''}B2B lead generation for ${leadData.companyName}`,
      body: `Hi ${leadData.contactName || 'there'},

I was researching manufacturing companies and noticed ${leadData.companyName} could be generating significantly more B2B leads online.

We recently helped a precision parts manufacturer increase qualified inquiries by 200% through a website that showcases capabilities and builds trust with potential buyers.

Most manufacturing websites look outdated and fail to convert visitors into leads. Industrial buyers research extensively online before contacting suppliers.

Would you be interested in discussing how we could help ${leadData.companyName} attract better clients?

Best regards,
Ali Alibrahimi
CEO, Convergent`,
      followUpSubject: `B2B lead generation for ${leadData.companyName}`,
      followUpBody: `Hi ${leadData.contactName},

Quick follow-up about B2B lead generation for ${leadData.companyName}.

Many manufacturers we work with underestimate how much business they're losing to competitors with more professional online presence.

What's your current approach to attracting new clients?

Best,
Ali`,
      callToAction: 'Schedule a manufacturing marketing consultation',
      personalizedOpening: 'B2B buyers research suppliers online before making contact',
      valueProposition: 'Professional websites that showcase manufacturing capabilities',
      socialProof: 'Helped manufacturers generate millions in new business',
      urgencyElement: 'Supply chain relationships being re-evaluated industry-wide'
    };
  };

  const generateNonprofitTemplate = (): EmailTemplate => {
    return {
      subject: `${leadData.contactName ? leadData.contactName + ', ' : ''}Donor engagement strategy for ${leadData.companyName}`,
      body: `Hi ${leadData.contactName || 'there'},

I was looking at nonprofit websites and noticed ${leadData.companyName} could potentially increase online donations by 80% with some strategic improvements.

We recently helped a local charity increase monthly donations by 150% through a website that tells their story more effectively and makes giving effortless.

Modern donors want to see impact and give through seamless digital experiences. Organizations that adapt raise significantly more funds.

Would you be interested in discussing how we could help ${leadData.companyName} reach more donors?

Best regards,
Ali Alibrahimi
CEO, Convergent`,
      followUpSubject: `Fundraising optimization for ${leadData.companyName}`,
      followUpBody: `Hi ${leadData.contactName},

Following up about fundraising optimization for ${leadData.companyName}.

Every month without optimized donation flow, you're potentially missing thousands in donations from people who want to support your cause.

What's your biggest challenge with online fundraising?

Best,
Ali`,
      callToAction: 'Schedule a nonprofit fundraising consultation',
      personalizedOpening: 'Nonprofit success depends on effective digital storytelling',
      valueProposition: 'Websites that inspire action and increase donations',
      socialProof: 'Helped nonprofits raise $500K+ additional funding',
      urgencyElement: 'Year-end giving season approaching'
    };
  };

  const generateGenericTemplate = (): EmailTemplate => {
    return {
      subject: `${leadData.contactName ? leadData.contactName + ', ' : ''}Business growth opportunity for ${leadData.companyName}`,
      body: `Hi ${leadData.contactName || 'there'},

I was researching companies in your industry and noticed ${leadData.companyName} could benefit from a stronger online presence.

We help businesses increase revenue through custom websites and digital solutions that actually convert visitors into customers.

Our recent client saw a 65% increase in qualified leads within 90 days of launching their new website.

Would you be open to a brief conversation about how we could help ${leadData.companyName} grow online?

Best regards,
Ali Alibrahimi
CEO, Convergent`,
      followUpSubject: `Quick follow-up: Growth opportunity for ${leadData.companyName}`,
      followUpBody: `Hi ${leadData.contactName},

Following up on my message about digital growth opportunities for ${leadData.companyName}.

Most businesses we work with are surprised by how much revenue they're missing due to poor online presence.

What's your biggest challenge with attracting customers online?

Best,
Ali`,
      callToAction: 'Schedule a business growth consultation',
      personalizedOpening: 'Business growth today requires strong digital presence',
      valueProposition: 'Custom digital solutions that drive real business results',
      socialProof: 'Helped 100+ businesses increase online revenue',
      urgencyElement: 'Digital competition increasing rapidly'
    };
  };

  const personalizeTemplate = (template: EmailTemplate): EmailTemplate => {
    let personalizedTemplate = { ...template };
    
    // Apply tone adjustments
    if (emailSettings.tone === 'casual') {
      personalizedTemplate.body = personalizedTemplate.body.replace(/Best regards,/g, 'Cheers,');
    } else if (emailSettings.tone === 'friendly') {
      personalizedTemplate.body = personalizedTemplate.body.replace(/Hi /g, 'Hey ');
    }
    
    // Apply length adjustments
    if (emailSettings.length === 'short') {
      const sentences = personalizedTemplate.body.split('. ');
      personalizedTemplate.body = sentences.slice(0, 4).join('. ') + '.';
    }
    
    // Add case study if enabled
    if (emailSettings.includeCaseStudy) {
      personalizedTemplate.socialProof += ' - Featured case study available upon request';
    }
    
    // Add pricing info if enabled
    if (emailSettings.includePricing) {
      personalizedTemplate.body += '\n\nProject investments typically range from $5,000-$25,000 depending on scope and complexity.';
    }
    
    // Add Calendly link if enabled
    if (emailSettings.includeCalendlyLink) {
      personalizedTemplate.callToAction += ' - https://calendly.com/convergent-consult';
    }
    
    return personalizedTemplate;
  };

  // Utility functions
  const addPainPoint = (): void => {
    setLeadData(prev => ({
      ...prev,
      painPoints: [...prev.painPoints, '']
    }));
  };

  const removePainPoint = (index: number): void => {
    if (leadData.painPoints.length > 1) {
      setLeadData(prev => ({
        ...prev,
        painPoints: prev.painPoints.filter((_, i) => i !== index)
      }));
    }
  };

  const updatePainPoint = (index: number, value: string): void => {
    setLeadData(prev => ({
      ...prev,
      painPoints: prev.painPoints.map((item, i) => i === index ? value : item)
    }));
  };

  const addCompetitor = (): void => {
    setLeadData(prev => ({
      ...prev,
      competitors: [...prev.competitors, '']
    }));
  };

  const removeCompetitor = (index: number): void => {
    if (leadData.competitors.length > 1) {
      setLeadData(prev => ({
        ...prev,
        competitors: prev.competitors.filter((_, i) => i !== index)
      }));
    }
  };

  const updateCompetitor = (index: number, value: string): void => {
    setLeadData(prev => ({
      ...prev,
      competitors: prev.competitors.map((item, i) => i === index ? value : item)
    }));
  };

  const copyToClipboard = async (): Promise<void> => {
    const emailContent = `Subject: ${generatedTemplate.subject}\n\n${generatedTemplate.body}`;
    await navigator.clipboard.writeText(emailContent);
  };

  const exportTemplate = (): void => {
    const dataStr = JSON.stringify(generatedTemplate, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `email-template-${leadData.companyName || 'template'}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const loadSampleData = (): void => {
    setLeadData({
      companyName: 'Bella Vista Restaurant',
      industry: 'restaurant',
      contactName: 'Maria Rodriguez',
      contactEmail: 'maria@bellavista.com',
      companySize: '10-50 employees',
      website: 'bellavista.com',
      phoneNumber: '+1 (555) 123-4567',
      painPoints: ['Limited online ordering', 'Poor mobile experience', 'No table reservations online'],
      recentNews: 'Recently expanded to second location',
      competitors: ['Local Italian Kitchen', 'Giuseppe\'s Bistro'],
      estimatedBudget: '$5,000 - $15,000',
      decisionMaker: true,
      timeframe: '3-6 months'
    });
  };

  if (!showPreview) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              Cold Email Lead Generator
            </h1>
            <p className="text-xl text-red-200">
              AI-powered personalized outreach for CodeWithAli/Convergent
            </p>
          </div>

          {/* Campaign Stats Dashboard */}
          <Card className="mb-8 bg-zinc-950 border-red-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart className="w-5 h-5 text-red-400" />
                Campaign Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-zinc-950 rounded-lg">
                  <div className="text-2xl font-bold text-white">{campaignStats.emailsSent}</div>
                  <div className="text-sm text-red-300">Emails Sent</div>
                </div>
                <div className="text-center p-4 bg-zinc-950 rounded-lg">
                  <div className="text-2xl font-bold text-green-400">{campaignStats.openRate}%</div>
                  <div className="text-sm text-red-300">Open Rate</div>
                </div>
                <div className="text-center p-4 bg-zinc-950 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-400">{campaignStats.replyRate}%</div>
                  <div className="text-sm text-red-300">Reply Rate</div>
                </div>
                <div className="text-center p-4 bg-zinc-950 rounded-lg">
                  <div className="text-2xl font-bold text-purple-400">{campaignStats.meetings}</div>
                  <div className="text-sm text-red-300">Meetings Booked</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="single" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-zinc-950">
              <TabsTrigger value="single" className="data-[state=active]:bg-red-600">Single Email</TabsTrigger>
              <TabsTrigger value="bulk" className="data-[state=active]:bg-red-600">Bulk Campaign</TabsTrigger>
              <TabsTrigger value="analytics" className="data-[state=active]:bg-red-600">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-6">
              {/* Quick Actions */}
              <Card className="bg-zinc-950 border-red-500/30">
                <CardContent className="p-4">
                  <div className="flex gap-3 justify-center">
                    <Button onClick={loadSampleData} variant="outline" className="border-red-500 text-red-300">
                      <Database className="w-4 h-4 mr-2" />
                      Load Sample Data
                    </Button>
                    <Button onClick={generateEmailTemplate} disabled={isGenerating} className="bg-red-600 hover:bg-red-700">
                      <Wand2 className="w-4 h-4 mr-2" />
                      {isGenerating ? "Generating..." : "Generate Email"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Lead Information */}
                <Card className="bg-zinc-950 border-red-500/30">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Target className="w-5 h-5 text-red-400" />
                      Lead Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-red-200">Company Name</Label>
                        <Input
                          placeholder="Acme Corp"
                          value={leadData.companyName}
                          onChange={(e) => setLeadData(prev => ({ ...prev, companyName: e.target.value }))}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-red-200">Industry</Label>
                        <Select value={leadData.industry} onValueChange={(value) => setLeadData(prev => ({ ...prev, industry: value }))}>
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                          <SelectContent>
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
                            <SelectItem value="consulting">Consulting</SelectItem>
                            <SelectItem value="automotive">Automotive</SelectItem>
                            <SelectItem value="construction">Construction</SelectItem>
                            <SelectItem value="financial">Financial Services</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-red-200">Contact Name</Label>
                        <Input
                          placeholder="John Smith"
                          value={leadData.contactName}
                          onChange={(e) => setLeadData(prev => ({ ...prev, contactName: e.target.value }))}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-red-200">Contact Email</Label>
                        <Input
                          placeholder="john@acmecorp.com"
                          type="email"
                          value={leadData.contactEmail}
                          onChange={(e) => setLeadData(prev => ({ ...prev, contactEmail: e.target.value }))}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-red-200">Company Size</Label>
                        <Select value={leadData.companySize} onValueChange={(value) => setLeadData(prev => ({ ...prev, companySize: value }))}>
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1-10">1-10 employees</SelectItem>
                            <SelectItem value="11-50">11-50 employees</SelectItem>
                            <SelectItem value="51-200">51-200 employees</SelectItem>
                            <SelectItem value="201-1000">201-1000 employees</SelectItem>
                            <SelectItem value="1000+">1000+ employees</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-red-200">Website</Label>
                        <Input
                          placeholder="acmecorp.com"
                          value={leadData.website}
                          onChange={(e) => setLeadData(prev => ({ ...prev, website: e.target.value }))}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-red-200">Recent News/Updates</Label>
                      <Textarea
                        placeholder="Recently raised funding, expanded to new location, etc."
                        value={leadData.recentNews}
                        onChange={(e) => setLeadData(prev => ({ ...prev, recentNews: e.target.value }))}
                        className="bg-slate-700 border-slate-600 text-white"
                        rows={2}
                      />
                    </div>

                    {/* Pain Points */}
                    <div>
                      <Label className="text-red-200 mb-2 block">Pain Points/Challenges</Label>
                      {leadData.painPoints.map((painPoint, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                          <Input
                            placeholder="e.g., Low online visibility, poor website performance"
                            value={painPoint}
                            onChange={(e) => updatePainPoint(index, e.target.value)}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removePainPoint(index)}
                            disabled={leadData.painPoints.length === 1}
                            className="border-red-500 hover:bg-red-500/20"
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
                        className="border-green-500 text-green-400 hover:bg-green-500/20"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Pain Point
                      </Button>
                    </div>

                    {/* Competitors */}
                    <div>
                      <Label className="text-red-200 mb-2 block">Known Competitors</Label>
                      {leadData.competitors.map((competitor, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                          <Input
                            placeholder="Competitor name"
                            value={competitor}
                            onChange={(e) => updateCompetitor(index, e.target.value)}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeCompetitor(index)}
                            disabled={leadData.competitors.length === 1}
                            className="border-red-500 hover:bg-red-500/20"
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
                        className="border-green-500 text-green-400 hover:bg-green-500/20"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Competitor
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Email Settings */}
                <Card className="bg-zinc-950 border-red-500/30">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Settings className="w-5 h-5 text-red-400" />
                      Email Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-red-200">Tone</Label>
                        <Select value={emailSettings.tone} onValueChange={(value: 'professional' | 'friendly' | 'casual' | 'consultative') => setEmailSettings(prev => ({ ...prev, tone: value }))}>
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="friendly">Friendly</SelectItem>
                            <SelectItem value="casual">Casual</SelectItem>
                            <SelectItem value="consultative">Consultative</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-red-200">Length</Label>
                        <Select value={emailSettings.length} onValueChange={(value: 'short' | 'medium' | 'detailed') => setEmailSettings(prev => ({ ...prev, length: value }))}>
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="short">Short (2-3 sentences)</SelectItem>
                            <SelectItem value="medium">Medium (4-6 sentences)</SelectItem>
                            <SelectItem value="detailed">Detailed (7+ sentences)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-red-200">Focus Area</Label>
                      <Select value={emailSettings.focusArea} onValueChange={(value: 'website' | 'mobile-app' | 'dashboard' | 'full-stack' | 'partnership') => setEmailSettings(prev => ({ ...prev, focusArea: value }))}>
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="website">Website Development</SelectItem>
                          <SelectItem value="mobile-app">Mobile App Development</SelectItem>
                          <SelectItem value="dashboard">Business Dashboard</SelectItem>
                          <SelectItem value="full-stack">Full-Stack Solution</SelectItem>
                          <SelectItem value="partnership">Development Partnership</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-red-200">Include Case Study</Label>
                        <Switch
                          checked={emailSettings.includeCasestudy}
                          onCheckedChange={(checked) => setEmailSettings(prev => ({ ...prev, includeCaseStudy: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-red-200">Include Pricing</Label>
                        <Switch
                          checked={emailSettings.includePricing}
                          onCheckedChange={(checked) => setEmailSettings(prev => ({ ...prev, includePricing: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-red-200">Include Calendly Link</Label>
                        <Switch
                          checked={emailSettings.includeCalendlyLink}
                          onCheckedChange={(checked) => setEmailSettings(prev => ({ ...prev, includeCalendlyLink: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-red-200">Personalized Research</Label>
                        <Switch
                          checked={emailSettings.personalizedResearch}
                          onCheckedChange={(checked) => setEmailSettings(prev => ({ ...prev, personalizedResearch: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-red-200">Follow-up Sequence</Label>
                        <Switch
                          checked={emailSettings.followUpSequence}
                          onCheckedChange={(checked) => setEmailSettings(prev => ({ ...prev, followUpSequence: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-red-200">GDPR Compliance Mode</Label>
                        <Switch
                          checked={emailSettings.complianceMode}
                          onCheckedChange={(checked) => setEmailSettings(prev => ({ ...prev, complianceMode: checked }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-red-200">Estimated Budget</Label>
                        <Select value={leadData.estimatedBudget} onValueChange={(value) => setLeadData(prev => ({ ...prev, estimatedBudget: value }))}>
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                            <SelectValue placeholder="Select budget" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="$1K-$5K">$1,000 - $5,000</SelectItem>
                            <SelectItem value="$5K-$15K">$5,000 - $15,000</SelectItem>
                            <SelectItem value="$15K-$30K">$15,000 - $30,000</SelectItem>
                            <SelectItem value="$30K+">$30,000+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-red-200">Project Timeframe</Label>
                        <Select value={leadData.timeframe} onValueChange={(value) => setLeadData(prev => ({ ...prev, timeframe: value }))}>
                          <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                            <SelectValue placeholder="Select timeframe" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ASAP">ASAP</SelectItem>
                            <SelectItem value="1-3 months">1-3 months</SelectItem>
                            <SelectItem value="3-6 months">3-6 months</SelectItem>
                            <SelectItem value="6+ months">6+ months</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="bulk" className="space-y-6">
              <Card className="bg-zinc-950 border-red-500/30">
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
                      <Button variant="outline" className="border-red-500 text-red-300">
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
                      <p className="text-sm mt-2">Coming soon in v2.0</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <Card className="bg-zinc-950 border-red-500/30">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-red-400" />
                    Campaign Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-400">
                    <BarChart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-xl mb-2">Advanced Analytics</h3>
                    <p>Track open rates, reply rates, conversion metrics, and ROI across all campaigns.</p>
                    <p className="text-sm mt-2">Coming soon in v2.0</p>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Action Bar */}
        <div className="flex justify-between items-center mb-6 bg-zinc-950 rounded-lg p-4">
          <div className="flex gap-3">
            <Button onClick={() => setShowPreview(false)} variant="outline" className="border-red-500 text-red-300">
              ← Back to Generator
            </Button>
            <Button onClick={() => window.print()} variant="outline" className="border-green-500 text-green-300">
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button onClick={copyToClipboard} variant="outline" className="border-yellow-500 text-yellow-300">
              <Copy className="w-4 h-4 mr-2" />
              Copy Email
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Badge className="bg-green-600">
              Email Generated Successfully
            </Badge>
            <Button onClick={exportTemplate} className="bg-red-600 hover:bg-red-700">
              <Download className="w-4 h-4 mr-2" />
              Export Template
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Email Preview */}
          <div className="lg:col-span-2">
            <Card className="bg-white text-black">
              <CardContent className="p-8" ref={emailPreviewRef}>
                <div className="border-b pb-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-600">
                      <strong>From:</strong> Ali Alibrahimi &lt;ali@convergent.dev&gt;
                    </div>
                    <div className="text-sm text-gray-600">
                      {currentDate}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <strong>To:</strong> {leadData.contactEmail || 'prospect@company.com'}
                  </div>
                  <div className="text-lg font-semibold">
                    <strong>Subject:</strong> {generatedTemplate.subject}
                  </div>
                </div>

                <div className="whitespace-pre-line text-gray-900 leading-relaxed">
                  {generatedTemplate.body}
                </div>

                {emailSettings.followUpSequence && (
                  <div className="mt-8 pt-6 border-t">
                    <h3 className="font-semibold mb-4 text-gray-700">Follow-up Email:</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
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

          {/* Email Analysis */}
          <div className="space-y-6">
            <Card className="bg-zinc-950 border-red-500/30">
              <CardHeader>
                <CardTitle className="text-white text-sm">Email Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-red-200 text-sm">Subject Length</span>
                  <Badge className="bg-green-600">
                    {generatedTemplate.subject.length} chars
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-red-200 text-sm">Body Word Count</span>
                  <Badge className="bg-red-600">
                    {generatedTemplate.body.split(' ').length} words
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-red-200 text-sm">Personalization</span>
                  <Badge className="bg-purple-600">High</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-red-200 text-sm">Spam Score</span>
                  <Badge className="bg-green-600">Low</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-950 border-red-500/30">
              <CardHeader>
                <CardTitle className="text-white text-sm">Campaign Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-red-200 text-sm">Industry</span>
                  <span className="text-white text-sm">{leadData.industry}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-200 text-sm">Tone</span>
                  <span className="text-white text-sm">{emailSettings.tone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-200 text-sm">Focus</span>
                  <span className="text-white text-sm">{emailSettings.focusArea}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-200 text-sm">Length</span>
                  <span className="text-white text-sm">{emailSettings.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-950 border-red-500/30">
              <CardHeader>
                <CardTitle className="text-white text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </Button>
                <Button className="w-full" variant="outline">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Send
                </Button>
                <Button className="w-full" variant="outline">
                  <Save className="w-4 h-4 mr-2" />
                  Save to Templates
                </Button>
                <Button className="w-full" variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerate
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-red-300 text-sm">
          Generated by Convergent Cold Email AI • {currentDate}
        </div>
      </div>
    </div>
  );
}