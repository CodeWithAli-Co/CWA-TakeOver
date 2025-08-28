import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  DollarSign,
  Code,
  CheckCircle,
  AlertTriangle,
  Printer,
  Users,
  TrendingUp,
  Shield,
  Plus,
  Minus,
  Wand2,
  Save,
  Mail,
  Download,
  Eye,
  Database,
  Edit,
  Calendar,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/shadcnComponents/button';
import { set } from 'date-fns';
import { Card, CardContent } from '@/components/ui/shadcnComponents/card';
import { Input } from '@/components/ui/shadcnComponents/input';

// typescript interfacesoo
interface ContractData {
    // client info
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    clientAddress: string;
    clientCompany?: string;

    // project details
    projectTitle: string;
    projectDescription: string;
    businessModel: string;
    targetMarket: string;
    revenueStreams: string;

    // Pricing
    contractType: 'development' | 'Partnership' | 'maintenance'
    initialPament: string;
    monthlyMaintenance: string;
    revenueSharing: string
    paymentTerms: string;

    // features
    coreFeatures: string[];
    advancedFeatures: string[];

    // contract terms
    partnershipDuration: string;
    specialArrangements: string;

    // signatures
    clientSignature: string;
    providerSignature: string;
    signatureDate: string;

    // Dates
    contractDate: string;
    startDate: string;
}

interface SignaturePadProps {
    onSignatureChange: (signature: string) => void;
    signature: string;
    placeholder: string;
    disabled?: boolean;
}

interface EmailData {
  to: string;
  subject: string;
  htmlContent: string;
  contractData: ContractData & { contractId: string };
  attachments: any[];
}

interface ContractWithId extends ContractData {
    id: string;
    createdAt: string;
    status: 'draft' | 'sent' | 'signed' | 'completed';
}

// Tauri function types (I can def do it in the frontend or we can just implement these in your Rust backend)
// declare global {
//   function invoke(cmd: 'save_contract', args: { contract: ContractWithId }): Promise<string>;
//   function invoke(cmd: 'send_contract_email', args: EmailData): Promise<string>;
//   function invoke(cmd: 'get_clients'): Promise<any[]>;
//   function invoke(cmd: 'generate_pdf', args: { htmlContent: string }): Promise<string>;
//   function invoke(cmd: 'generate_features', args: { projectDescription: string }): Promise<{ coreFeatures: string[], advancedFeatures: string[] }>;
// }

// Simple signature pad component
const SignaturePad: React.FC<SignaturePadProps> = ({ onSignatureChange, signature, placeholder, disabled = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 120;
    
    // Clear with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    
    // Save signature data
    const imageData = canvas.toDataURL();
    onSignatureChange(imageData);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onSignatureChange('');
  };
  return (
    <div className="signature-pad">
      <div className="relative border border-gray-300 rounded-lg bg-white">
        <canvas
          ref={canvasRef}
          className={`w-full h-[120px] cursor-crosshair ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
        {!signature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-400 text-sm">
            {placeholder}
          </div>
        )}
      </div>
      {!disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearSignature}
          className="mt-2 text-red-600 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear Signature
        </Button>
      )}
    </div>
  );
};

export default function NexusContractGenerator(): JSX.Element {
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [isSending, setIsSending] = useState<boolean>(false);
    const [showContract, setShowContract] = useState<boolean>(false);
    const [emailStatus, setEmailStatus] = useState<string>('');

    const [contractData, setContractData] = useState<ContractData>({
           
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: '',
    clientCompany: '',

    // project details
    projectTitle: '',
    projectDescription: '',
    businessModel: '',
    targetMarket: '',
    revenueStreams: '',

    // Pricing
    contractType: 'development',
    initialPament: '',
    monthlyMaintenance: '',
    revenueSharing: '',
    paymentTerms: 'standard',

    // features
    coreFeatures: [''],
    advancedFeatures: [''],

    // contract terms
    partnershipDuration: 'Ongoing with 30-day termination notice',
    specialArrangements: '',

    // signatures
    clientSignature: '',
    providerSignature: '',
    signatureDate: '',

    // Dates
    contractDate: new Date().toLocaleDateString('en-US'),
    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });

    const conctractRef = useRef<HTMLDivElement>(null);

    const generateContractId = (): string => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `NC-${year}${month}${day}-${random}`;
  };

  const handleInputChange =  (field: keyof ContractData, value: string) : void => {
    setContractData(prev => ({
        ...prev, [field] : value
    }));
  } ;

  const handleFeatureChange = (type: 'coreFeatures' | 'advancedFeatures', index: number, value: string): void => {
    setContractData(prev => ({
      ...prev,
      [type]: prev[type].map((item, i) => i === index ? value : item)
    }));
  };

  const addFeature = (type: 'coreFeatures'  | 'advancedFeatures'): void => {
    setContractData(prev => ({
      ...prev, 
      [type]: [...prev[type], ''] 
    }));
  } ;
  const removeFeature = (type: 'coreFeatures' | 'advancedFeatures', index: number): void => {
    setContractData(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  // we would have a client database table, for now Im imagining you would have to manually enter information into the supabase  in itself
  // later on the client will have to fill out a form to which then the information will automatically go straight into  the database
  // and this code grabs it through supabaase ( meaning everything will be automated without us havaing to write in the database )
  const  loadClientFromDB = async (): Promise<void> =>{

    try {
      // this should caall for our backend
      // const clients  = await invoke('get_clients');
      // im just gonna make a demo version of this for noww
      setContractData(prev => ({
        ...prev,
        clientName: "Blaze Hunter",
        clientEmail: "blazehunterhp@gmail.com",
        clientPhone: "+31 6 4588 0030",
        clientAddress: "Netherlands",
        clientCompany: "Convergent"
      }));
      
    } catch (error) {
      console.error('Failed to load client', error);
    }
  };
  
  // Feature Generation ( Convergent AI )
  const generateFromAI = async (): Promise<void> => {
    setIsGenerating(true);
    try {
      const keywords = contractData.projectTitle.toLowerCase();
      let coreFeatures: string[] = [];
      let advancedFeatures: string[] = [];

      if (keywords.includes('ecommerce') || keywords.includes('shop')) {
        coreFeatures = [
          "Product catalog with search and filters",
          "Shopping cart and checkout system",
          "Stripe payment integeration",
          "Customer account management",
          "Order tracking and management",
          "Mobile-responsinve design",
          "SEO  optimization and metaa tags",
        ];
        advancedFeatures = [
          "Inventory management system",
          "Advancedd analytics dashboard",
          "Email  marketing integeration",
          "Multi-vendor marketplaace features",
          "Automatedd tax calculations",
          "Review and ratings system",
        ]
      } else if (keywords.includes("dashboard") || keywords.includes('admin')) {
        coreFeatures = [
          "User authentication and authorization",
          "Real-time data visualizations",
          "CRUD operations interface",
          "Responsive dashboard layout",
          "Export functionality  (PDF/CSV)",
          "Search and filtering capabalities"
        ];
        advancedFeatures = [
          "Advanced analytics and reporting",
          "Role-based  access control",
          "API integerations",
          "Automated backup system",
          "Custom notifications system",
          "Multi-tenant architecture"
        ];
      } else if (keywords.includes('app') || keywords.includes('mobile')) {
        coreFeatures = [
          "Cross-platform mobile applications",
          "Cross-platform  mobile application",
          "User registration and login",
          "Push notifications system",
          "Offline data synchronizations",
          "In-app messaging/chat",
          "App store optimization"
          
        ];
        advancedFeatures = [
          'Advanced security features',
          'Real-time location services',
          'Third-party API integrations',
          'Advanced analytics tracking',
          'Custom UI/UX animations',
          'Backend admin panel'
        ];
      } else {
        // Default web application features
        coreFeatures = [
          'Modern responsive web design',
          'User authentication system',
          'Database integration',
          'Contact forms and validation',
          'SEO optimization',
          'Performance optimization'
        ];
        advancedFeatures = [
          'Advanced security implementation',
          'Third-party integrations',
          'Analytics and reporting',
          'Content management system',
          'API development',
          'Automated deployment pipeline'
        ];
      }
      // until we grab the nodes of the core and advanced featuresthen generate if not don't and wait 1.5 second
      setTimeout(() => {
        setContractData(prev => ({
          ...prev,
          coreFeatures,
          advancedFeatures
        }));
        setIsGenerating(false);
      }, 1500);

    } catch (error) {
      console.error('AI generation failed:',  error);
      setIsGenerating(false);
    }
  };

// save contract to local database ( for now: supabase later )
const saveContract = async (): Promise<void> => {
  try {
    const contractWithId: ContractWithId = {
      ...contractData,
      id: generateContractId(),
      createdAt: new Date().toISOString(),
      status: 'draft'
    };

    // save in tauri ( since your learning tauri if not just save it the way we normally do after creating a table in supabase )
    // for now gotta go with the lovely alert/console log code :)
    alert("Contract saved to database!");
    console.log("contract saved:", contractWithId);
  } catch (error) {
    console.error("Failed to save the contract", error)
  }
};

// Export contract as PDF ( tauri wwouldd handle this )
const exportToPDF = async (): Promise<void> => {
  try {
    window.print();
  } catch (error) {
    console.error("Failed to export PDF: ", error);
  }
};

// Email contract to client
const emailContract = async (): Promise<void> => {
  if (!contractData.clientEmail) {
    alert("Please enter client email address");
    return;
  }

  // if (!contractData.clientSignature || !contractData.providerSignature) {
  //   alert("Both signatures are required before sending");
  //   return;
  // }
setIsSending(true);
setEmailStatus('Preparing contract...')

try {
  const contractId = generateContractId();
  const emailData : EmailData = {
    to: contractData.clientEmail,
    subject: `Service Agreement - ${contractData.projectTitle || "Professional Services"}`,
    htmlContent: conctractRef.current?.innerHTML  || '',
    contractData: { ...contractData, contractId},
    attachments: []
  }

  // simulate the email sending
  setTimeout(() => {
    setEmailStatus('Email sent Successfully!');
    setIsSending(false);

    // alaso save to database when emailed
    saveContract();

    setTimeout(() => setEmailStatus(''), 3000);
  }, 2000);

} catch (error) {
  console.error("Failed to send email:", error);
  setEmailStatus("Failed to send email");
  setIsSending(false);
  setTimeout(() => setEmailStatus(''), 3000);
}
};

const getContractTypeTitle = (): string => {
  switch (contractData.contractType) {
    case 'development' : return 'SERVICE AGREEMENT';
    case 'Partnership' : return 'SERVICE & PARTNERSHIP AGREEEMENT';
    case "maintenance" : return "MAINTENANCE & SUPPORT AGREEMENT";
    default: return "SERVICE AGREEMENT";  
  }
};

const getContractTypeBadge = (): string => {
  switch (contractData.contractType)  {
    case 'development' : return "Development Services";
    case 'Partnership' : return "Development & Revenue-Sharing Agreement";
    case 'maintenance' : return "Maintenace & Support Services";
    default: return 'Professional Services';
  }
};

if (!showContract) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-sans font-medium text-black mb-4">
            Convergent Contract Generator
          </h1>
          <p className="text-lg text-black">
            Generate and email professional service agreements
          </p>
        </div>

        {/* quick actions bar  */}
        <Card className="mb-6 rounded-xs  ">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 justify-center">
              <Button onClick={loadClientFromDB} variant="outline" className="flex items-center gap-2 text-black">
                <Database className="w-4 h-4 text-blue-700" />
                Load client from DB
              </Button>
              <Button onClick={generateFromAI} disabled={isGenerating} className="bg-blue-600 hover:bg-blue-700">
                <FileText className="w-4 h-4 text-white" />
                {isGenerating ? "Generating..." : "Convergent AI Generator"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 rounded-xs">
          <CardContent className="p-6">
            {/* Client Informaton  */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex text-blue-900 items-center gap-2">
                <Users className="w-5 h-5 text-blue-900" />
                Client Information
              </h2>
              <Input 
              placeholder='Client Name'
              value={contractData.clientName}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}





































}