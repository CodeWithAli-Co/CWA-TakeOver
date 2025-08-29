import React, { useState, useRef, useEffect, JSX } from 'react';
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
import  { useForm } from  '@tanstack/react-form'
import { Label } from '@/components/ui/shadcnComponents/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/shadcnComponents/select';
import { Badge } from '@/components/ui/shadcnComponents/badge';

// typescript interfacesoo
interface ContractData {
  // Client Info
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  clientCompany: string;
  
  // Project Details
  projectTitle: string;
  projectDescription: string;
  businessModel: string;
  targetMarket: string;
  revenueStreams: string;
  
  // Pricing
   contractType: 'development' | 'partnership' | 'maintenance';
  initialPayment: string;
  monthlyMaintenance: string;
  revenueSharing: string;
  
  // Features
  coreFeatures: string[];
  advancedFeatures: string[];
  
  // Contract Terms
  partnershipDuration: string;
  specialArrangements: string;
}

interface EmailData {
  to: string;
  subject: string;
  htmlContent: string;
  contractData: ContractData & { contractId: string };
  attachments: any[];
}

// interface ContractWithId extends ContractData {
//     id: string;
//     createdAt: string;
//     status: 'draft' | 'sent' | 'signed' | 'completed';
// }

// Tauri function types (I can def do it in the frontend or we can just implement these in your Rust backend)
// declare global {
//   function invoke(cmd: 'save_contract', args: { contract: ContractWithId }): Promise<string>;
//   function invoke(cmd: 'send_contract_email', args: EmailData): Promise<string>;
//   function invoke(cmd: 'get_clients'): Promise<any[]>;
//   function invoke(cmd: 'generate_pdf', args: { htmlContent: string }): Promise<string>;
//   function invoke(cmd: 'generate_features', args: { projectDescription: string }): Promise<{ coreFeatures: string[], advancedFeatures: string[] }>;
// }

// Simple signature pad component
// const SignaturePad: React.FC<SignaturePadProps> = ({ onSignatureChange, signature, placeholder, disabled = false }) => {
//   const canvasRef = useRef<HTMLCanvasElement>(null);
//   const [isDrawing, setIsDrawing] = useState<boolean>(false);

//   useEffect(() => {
//     const canvas = canvasRef.current;
//     if (!canvas) return;

//     const ctx = canvas.getContext('2d');
//     if (!ctx) return;

//     ctx.strokeStyle = '#000000';
//     ctx.lineWidth = 2;
//     ctx.lineCap = 'round';
    
//     // Set canvas size
//     canvas.width = canvas.offsetWidth;
//     canvas.height = 120;
    
//     // Clear with white background
//     ctx.fillStyle = '#ffffff';
//     ctx.fillRect(0, 0, canvas.width, canvas.height);
//   }, []);

//   const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
//     if (disabled) return;
//     setIsDrawing(true);
//     const canvas = canvasRef.current;
//     if (!canvas) return;

//     const rect = canvas.getBoundingClientRect();
//     const ctx = canvas.getContext('2d');
//     if (!ctx) return;
    
//     ctx.beginPath();
//     ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
//   };

//   const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
//     if (!isDrawing || disabled) return;
    
//     const canvas = canvasRef.current;
//     if (!canvas) return;

//     const rect = canvas.getBoundingClientRect();
//     const ctx = canvas.getContext('2d');
//     if (!ctx) return;
    
//     ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
//     ctx.stroke();
    
//     // Save signature data
//     const imageData = canvas.toDataURL();
//     onSignatureChange(imageData);
//   };

//   const stopDrawing = () => {
//     setIsDrawing(false);
//   };

//   const clearSignature = () => {
//     if (disabled) return;
//     const canvas = canvasRef.current;
//     if (!canvas) return;

//     const ctx = canvas.getContext('2d');
//     if (!ctx) return;

//     ctx.fillStyle = '#ffffff';
//     ctx.fillRect(0, 0, canvas.width, canvas.height);
//     onSignatureChange('');
//   };
//   return (
//     <div className="signature-pad">
//       <div className="relative border border-gray-300 rounded-lg bg-white">
//         <canvas
//           ref={canvasRef}
//           className={`w-full h-[120px] cursor-crosshair ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
//           onMouseDown={startDrawing}
//           onMouseMove={draw}
//           onMouseUp={stopDrawing}
//           onMouseLeave={stopDrawing}
//         />
//         {!signature && (
//           <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-400 text-sm">
//             {placeholder}
//           </div>
//         )}
//       </div>
//       {!disabled && (
//         <Button
//           type="button"
//           variant="outline"
//           size="sm"
//           onClick={clearSignature}
//           className="mt-2 text-red-600 hover:text-red-700"
//         >
//           <Trash2 className="w-4 h-4 mr-2" />
//           Clear Signature
//         </Button>
//       )}
//     </div>
//   );
// };

export default function NexusContractGenerator(): JSX.Element {
   const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showContract, setShowContract] = useState<boolean>(false);
  const [emailStatus, setEmailStatus] = useState<string>('');
  const [currentDate] = useState(new Date().toLocaleDateString('en-US'));

  const form = useForm({
    defaultValues: {
      // Client Info
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      clientAddress: '',
      clientCompany: '',
      
      // Project Details
      projectTitle: '',
      projectDescription: '',
      businessModel: '',
      targetMarket: '',
      revenueStreams: '',
      
      // Pricing
      contractType: 'development' as const,
      initialPayment: '',
      monthlyMaintenance: '',
      revenueSharing: '',
      
      // Features
      coreFeatures: [''],
      advancedFeatures: [''],
      
      // Contract Terms
      partnershipDuration: 'Ongoing with 30-day termination notice',
      specialArrangements: '',
    } as ContractData,
    onSubmit: async ({ value }) => {
      console.log('Contract data:', value);
      setShowContract(true);
    },
  });

    const contractRef = useRef<HTMLDivElement>(null);

    const generateContractId = (): string => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `NC-${year}${month}${day}-${random}`;
  };

  // React version ( the study of nodes begins )
  // const handleInputChange =  (field: keyof ContractData, value: string) : void => {
  //   setContractData(prev => ({
  //       ...prev, [field] : value
  //   }));
  // } ;

  // const handleFeatureChange = (type: 'coreFeatures' | 'advancedFeatures', index: number, value: string): void => {
  //   setContractData(prev => ({
  //     ...prev,
  //     [type]: prev[type].map((item, i) => i === index ? value : item)
  //   }));
  // };

  // const addFeature = (type: 'coreFeatures'  | 'advancedFeatures'): void => {
  //   setContractData(prev => ({
  //     ...prev, 
  //     [type]: [...prev[type], ''] 
  //   }));
  // } ;
  // const removeFeature = (type: 'coreFeatures' | 'advancedFeatures', index: number): void => {
  //   setContractData(prev => ({
  //     ...prev,
  //     [type]: prev[type].filter((_, i) => i !== index)
  //   }));
  // };

  // we would have a client database table, for now Im imagining you would have to manually enter information into the supabase  in itself
  // later on the client will have to fill out a form to which then the information will automatically go straight into  the database
  // and this code grabs it through supabaase ( meaning everything will be automated without us havaing to write in the database )
  const  loadClientFromDB = async (): Promise<void> =>{

    try {
        // simulaating  loadding client ddata 
        form.setFieldValue("clientName",  "Blaze Hunter");
        form.setFieldValue("clientEmail", "blazehunter@gmail.com");
        form.setFieldValue("clientPhone",  "+31 6 4588 0030");
        form.setFieldValue("clientAddress", "Netherlands");
        form.setFieldValue("clientCompany", "Convergent LLC");
      } catch (error) {
      console.error('Failed to load client', error);
    }
  };
  
  // Feature Generation ( Convergent AI )
  const generateFromAI = async (): Promise<void> => {
    setIsGenerating(true);
    try {
      const projectTitle = form.getFieldValue("projectTitle").toLowerCase();
      let coreFeatures: string[] = [];
      let advancedFeatures: string[] = [];

      if (projectTitle.includes('ecommerce') || projectTitle.includes('shop')) {
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
      } else if (projectTitle.includes("dashboard") || projectTitle.includes('admin')) {
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
      } else if (projectTitle.includes('app') || projectTitle.includes('mobile')) {
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
        form.setFieldValue('coreFeatures', coreFeatures)
        form.setFieldValue('advancedFeatures', advancedFeatures)
        setIsGenerating(false);
      }, 1500);

    } catch (error) {
      console.error('AI generation failed:',  error);
      setIsGenerating(false);
    }
  };

// Feature management functions
const addFeature = (type: 'coreFeatures'  | 'advancedFeatures'): void => {
  const currentFeatures = form.getFieldValue(type);
  form.setFieldValue(type, [...currentFeatures, '']);
};

const removeFeature = (type: 'coreFeatures' | 'advancedFeatures', index: number): void => {
  const currentFeatures = form.getFieldValue(type);
  if (currentFeatures.length > 1) {
      form.setFieldValue(type, currentFeatures.filter((_, i) => i !== index));
    }
};

// I'll explaain this part to you blaze so listen up
const updateFeature =  (type: 'coreFeatures' | 'advancedFeatures', index: number, value: string):void => {
  // 1. Get the current array of features from the form state 
  const currentFeatures =  form.getFieldValue(type);
  // 2. Create a new array where ONLY the item at `index`
  //    is replaced with the new `value`
  // Ex.  
  // imagine we had this form state, 
  // form.getFieldValue('coreFeatures') 
  // ["Fast", "Secure", "Scalable"]

  // now we call,  
  // updateFeature('coreFeatures', 1, "Reliable");
  // currentFeatures = ["Fast", "Secure", "Scalable"]
  // .map() loops through:
  // index 0: not equal to 1, keep "Fast"
  // index 1: equals 1, replace "Secure" with "Reliable"
  // index 2: not equal, keep "Scalable"
  // updated = ["Fast", "Reliable", "Scalable"]
  // form.setFieldValue('coreFeatures', updated) updates the form state.
  const updated = currentFeatures.map((item, i) => i === index ? value : item)
   // 3. Set the new array back into the form state
  form.setFieldValue(type, updated)
}

// save contract to local database ( for now: supabase later )
const saveContract = async (): Promise<void> => {
  try {
    // save in tauri ( since your learning tauri if not just save it the way we normally do after creating a table in supabase )
    // for now gotta go with the lovely alert/console log code :)
    alert("Contract saved to database!");
    console.log("contract saved:");
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
    const clientEmail = form.getFieldValue('clientEmail');

    if (!clientEmail) {
      alert('Please enter client email address');
      return;
    }

    setIsSending(true);
    setEmailStatus('Generating PDF and preparing email...');

    try {
      const contractId = generateContractId();
      const emailData: EmailData = {
        to: clientEmail,
        subject: `Service Agreement - ${form.getFieldValue('projectTitle') || 'Professional Services'}`,
        htmlContent: contractRef.current?.innerHTML || '',
        contractData: { ...form.state.values, contractId },
        attachments: [] // PDF will be attached by Tauri backend
      };

      // Simulate email sending - replace with actual Tauri call
      // await invoke('send_contract_email', emailData);
      setTimeout(() => {
        setEmailStatus('Contract PDF sent successfully!');
        setIsSending(false);
        saveContract();
        setTimeout(() => setEmailStatus(''), 3000);
      }, 2000);

    } catch (error) {
      console.error('Failed to send email:', error);
      setEmailStatus('Failed to send email');
      setIsSending(false);
      setTimeout(() => setEmailStatus(''), 3000);
    }
  };

  const getContractTypeTitle = (): string => {
    const contractType = form.getFieldValue('contractType');
    switch (contractType) {
      case 'development': return 'SERVICE AGREEMENT';
      case 'partnership': return 'SERVICE & PARTNERSHIP AGREEMENT';
      case 'maintenance': return 'MAINTENANCE & SUPPORT AGREEMENT';
      default: return 'SERVICE AGREEMENT';
    }
  };

 const getContractTypeBadge = (): string => {
    const contractType = form.getFieldValue('contractType');
    switch (contractType) {
      case 'development': return 'Development Services';
      case 'partnership': return 'Development & Revenue-Sharing Agreement';
      case 'maintenance': return 'Maintenance & Support Services';
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
              <form.Field
              name ="clientName"
              >
                {(field) => (
                  <div>
                    <Label className='block text-sm font-medium text-black mb-2'>Client Name</Label>
                    <Input placeholder='Enter Client Name' 
                    value={field.state.value}  
                    onChange={(e) => field.handleChange(e.target.value)}/>
                  </div>
                )}
              </form.Field>

              {/* client company */}
              <form.Field
                name="clientCompany"
              >
                {(Field) => (
                  <div>
                    <Label className="text-sm font-medium text-black block mb-2">Client Company</Label>
                    <Input placeholder='Enter Client Company' 
                    value={Field.state.value}
                    onChange={(e) => Field.handleChange(e.target.value)}
                    />
                  </div>
                )}

              </form.Field>

              {/* Client email */}
              <form.Field
                name="clientEmail"
              >
                {(Field) => (
                  <div>
                    <Label className="text-sm  font-medium text-black block  mb-2">Client Email</Label>
                    <Input placeholder='Enter client Email' 
                    value={Field.state.value}
                    onChange={(e) => Field.handleChange(e.target.value)}
                    />
                  </div>
                )}
              </form.Field>
              
              {/* Client Phone Number */}
              <form.Field
                name="clientPhone"
              >
                {(Field) =>  (
                  <div>
                    <Label className="text-sm font-medium text-black block mb-2">Client Phone</Label>
                    <Input placeholder='+1 (408) 123-4567'
                      type='tel'
                      value={Field.state.value}
                      onChange={(e) => Field.handleChange(e.target.value)}
                    />

                  </div>
                )}
              </form.Field>

              {/* Client Address */}
              <form.Field
                name="clientAddress"
              >
                {(Field) => (
                  <div>
                    <Label className="text-sm mb-2 font-medium text-black block">Client Address</Label>
                    <Input placeholder='Enter Client Address' 
                    value={Field.state.value}
                    onChange={(e) => Field.handleChange(e.target.value)}
                    />
                  </div>
                )}
              </form.Field>
            </div>
          </CardContent>
        </Card>

        {/* Project Details */}
        <Card className="mb-6 rounded-xs">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4  text-blue-800">
              <Code className="w-5 h-5 text-blue-800" />
              Project Details
            </h2>
            <div className="space-y-4">
              <form.Field
              name="projectTitle"
              >
                {(Field) => (
                  <div>
                    <Label className="block text-sm text-black font-medium gap-2 mb-2"> Project Details</Label>
                    <Input placeholder='Enter Project Title' 
                      value={Field.state.value}
                      onChange={(e) => Field.handleChange(e.target.value)}
                    />
                  </div>
                )}
                
              </form.Field>
              <form.Field
                name="projectDescription"
              >
                {(Field) => (
                  <div>
                    <Label className="block  text-sm font-medium mb-2 gap-2 text-black"> Project Description</Label>
                    <Textarea  placeholder="Detailed project description (used for AI feature generation)"
                    value={Field.state.value}
                    onChange={(e) => Field.handleChange(e.target.value)}
                    rows={4}
                    className='bg-blue-100 border-black text-black'
                    />
                  </div>
                )}
              </form.Field>

               <div className="grid md:grid-cols-3 gap-4">
                  <form.Field name="businessModel">
                    {(field) => (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Business Model
                        </label>
                        <Textarea
                          placeholder="How the business operates"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          rows={2}
                          className='text-black'
                        />
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="targetMarket">
                    {(field) => (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Target Market
                        </label>
                        <Textarea
                          placeholder="Who are the customers"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          rows={2}
                          className='text-black'
                        />
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="revenueStreams">
                    {(field) => (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Revenue Streams
                        </label>
                        <Textarea
                          placeholder="How money is made"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          rows={2}
                          className='text-black'
                        />
                      </div>
                    )}
                  </form.Field>
                </div>
              </div>
            </CardContent>

            {/* Contract & Pricing */}

        </Card>
        {/* shadow here */}
          <Card className="mb-6 rounded-xs shadow-lg">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold flex items-center text-blue-700 gap-2 mb-4">
                <DollarSign className="w-5 h-5 text-blue-800" />
                Contract & Pricing
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <form.Field name="contractType">
                  {(field) => (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contract Type
                      </label>
                      <Select 
                        value={field.state.value} 
                        onValueChange={(value: 'development' | 'partnership' | 'maintenance') => field.handleChange(value)}
                      
                      >
                        <SelectTrigger className='border  text-black'>
                          <SelectValue placeholder="Select contract type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="development">Development Only</SelectItem>
                          <SelectItem value="partnership">Development + Partnership</SelectItem>
                          <SelectItem value="maintenance">Maintenance Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>

                <form.Field name="initialPayment">
                  {(field) => (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Initial Payment
                      </label>
                      <Input
                        placeholder="e.g., $5,000 - $10,000"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name="monthlyMaintenance">
                  {(field) => (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Monthly Maintenance
                      </label>
                      <Input
                        placeholder="e.g., $500 - $1,000"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name="revenueSharing">
                  {(field) => (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Revenue Sharing
                      </label>
                      <Input
                        placeholder="e.g., 20% of affiliate revenue"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        disabled={form.getFieldValue('contractType') !== 'partnership'}
                      />
                    </div>
                  )}
                </form.Field>
              </div>

              <form.Field name="partnershipDuration">
                {(field) => (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contract Duration
                    </label>
                    <Input
                      placeholder="e.g., Ongoing with 30-day termination notice"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </div>
                )}
              </form.Field>
            </CardContent>
          </Card>

   {/* Project Features */}
          <Card className="mb-6 rounded-xs">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold flex items-center text-blue-800 gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-blue-800" />
                Project Features
              </h2>
              {/* updateFeature('adavncedFeatures', index, e.target.value)  we care about the index of the current value and what changes the user will make to it*/}
              {/* RemoveFeature('advancedFeatures', index) for this we just the need index to locate the value and delete*/}
              {/* addFeatures('advancedFeatures')          We are simply just adding another node, it'll automatically add a new feature in the next empty spot*/}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Core Features */}
                <div>
                  <h3 className=" mb-3 !text-[18px] text-red-600">Core Features</h3>
                    <form.Field
                    name="coreFeatures"
                    >
                      {/* Tanstack form value mapping  */}
                      {/* We are mapping so that we can update a default value at the chosen index by the developer */}
                      {(Field) => (
                        <div className="space-y-2">
                          {Field.state.value.map((feature: string, index: number) => (
                            <div key={index} className="flex gap-2" >
                              <Input placeholder='Core Feature' value={feature} onChange={(e) => updateFeature('coreFeatures', index, e.target.value)} />
                                <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeFeature('coreFeatures', index)}
                              // cannot delete unless we havae  more than one item
                              disabled={Field.state.value.length === 1}
                              className='hover:border-red-800 hover:bg-red-200'
                            >
                              <Minus className="w-4 h-4 text-red-500 " />
                            </Button>
                            </div>
                          ))}
                         <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addFeature('coreFeatures')}
                          className="mt-2 bg-green-600 hover:bg-green-700 text-black"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Core Feature
                        </Button>
                        </div>
                      )}
                    </form.Field>
                </div>

                {/* Advanced Features */}
                <div>

                <h3 className="mb-3 !text-[18px] text-blue-600 ">Advanced Features</h3>
                <form.Field
                name="advancedFeatures"
                >
                  {(Field) => (
                    <div className="space-y-2">
                      {Field.state.value.map((feature: string, index: number) => (
                        <div key={index} className='flex gap-2'>
                          <Input placeholder='Advanced Feature' 
                            value={feature}
                            onChange={(e) => updateFeature('advancedFeatures', index, e.target.value)}
                          />
                          {/* We are not entering a value for this button, just removing it at its index */}
                          <Button type='button' variant={"outline"} size={"sm"} onClick={() => removeFeature("advancedFeatures", index)}   className='hover:border-red-800 hover:bg-red-200'> <Minus className="w-4 h-4 text-red-500" /> </Button>
                        </div>
                      ))}
                      <Button 
                      type="button"
                      variant={"outline"}
                      size={"sm"}
                      onClick={() => addFeature("advancedFeatures")}
                      className='bg-green-600 text-black hover:bg-green-700'> <Plus className="w-4 h-4" />Add Advanced Feature </Button>
                    </div>
                  )}
                </form.Field>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Special Arrangements */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold flex text-blue-700 items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-blue-700" />
                Special Arrangements
              </h2>
              <form.Field name="specialArrangements">
                {(field) => (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Special Terms or Arrangements (Optional)
                    </label>
                    <Textarea
                      placeholder="Any special terms, payment arrangements, or custom clauses..."
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      rows={3}
                    />
                  </div>
                )}
              </form.Field>
            </CardContent>
          </Card>

          {/* Generate Button */}
          <div className="text-center mb-8">
            <Button onClick={form.handleSubmit} className="bg-blue-800 hover:bg-blue-900 text-white"
            > 
              <span>Generate Contract Preview</span></Button>
          
          </div>

      </div>
    </div>
  );
}

// contract preview ( 2nd page )
const contractId = generateContractId();
return (
  <>
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Action Bar */}
        <div className="flex justify-between items-center mb-6 no-print bg-gray-50 rounded-lg">
          <div className="flex gap-3">
            {/* back editor */}
            <Button onClick={() => setShowContract(false)} variant={"outline"} className='border text-gray-500'>
               ← Back to Editor
            </Button>
            {/* Print review */}
            <Button onClick={() => window.print()} variant={"outline"}  className="border border-green-800 text-green-800">
              <Printer className="2-4 h-4 mr-2 text-green-800"/>
              Print Preview</Button>
              {/* Save Contraact */}
            <Button onClick={saveContract} variant={"outline"} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="w-4 h-4 mr-1"/>
              Save Contract
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {emailStatus && (
              <Badge className={emailStatus.includes('success') ? 'bg-green-600' : emailStatus.includes('Failed') ? "bg-red-600" : "bg-blue-600"}>\
                {emailStatus}
              </Badge>
            )}
            <Button onClick={emailContract} disabled={isSending || !form.getFieldValue('clientEmail')} className="bg-green-600 hover:bg-green-700">
              <Mail className="w-4 h-4 mr-2"/>
              {isSending ? "Sending..." : "Email PDF to Client"}
            </Button>
          </div>
        </div>

        {/* Contract Document Now */}
            <Card>
              <CardContent className='rounded-xs p-8 ' ref={contractRef}>
                {/* Header */}
                <div className="text-center mb-8 border-b pb-6">
                  <h1 className="text-3xl font-bold text-black mb-2">
                    {form.getFieldValue("projectTitle").toUpperCase() || "PROFESSIONAL SERVICES"}
                  </h1>
                  <h2 className="text-2xl font-semibold text-blue-600 mb-2">
                    {getContractTypeTitle()}
                  </h2>
                  <div className="flex items-center justify-center gap-4 text-sm text-gray-700">
                    <span>Contract ID:  <strong>{contractId}</strong></span>
                    <span>•</span>
                    <span>Date: <strong>{currentDate}</strong></span>
                  </div>
                  <Badge className="mt-2 bg-blue-600 hover:bg-blue-600">
                    <FileText className="2-3 h-3 mr-1"/>
                    {getContractTypeBadge()}
                  </Badge>
                </div>

                {/* Parties Section */}
                <section className="mb-8">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-700">
                    <Users className="w-5 h-5 text-blue-600"/>
                    Contracting Parties
                  </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {/* CWA Party */}
                   <div className="bg-white p-4 rounded-lg border">
                      <h3 className="font-semibold mb-2 text-gray-900">Service Provider</h3>
                      <p className="text-gray-700"><strong>Convergent</strong></p>
                      <p className="text-gray-700">Professional Development Services</p>
                      <p className="text-gray-700">San Jose, California, United States</p>
                      <p className="text-gray-700">Email: contact@convergent.dev</p>
                      <p className="text-sm mt-2 text-red-600 font-medium">CEO: Ali Alibrahimi</p>
                    </div>
                    <div className="bg-white p-4 roundedd-lg border">
                      <h3 className="font-semibold mb-2 text-gray-900">Client</h3>
                      <p className="text-gray-700"> <strong> {form.getFieldValue('clientName') || "Client Name"} </strong> </p>
                      {form.getFieldValue("clientCompany") && <p className='text-gray-700'> {form.getFieldValue("clientCompany")} </p> }
                      <p className="text-gray-700"> {form.getFieldValue("clientEmail") || "Client Email"} </p>
                      <p className="text-gray-700"> {form.getFieldValue("clientPhone") || "+1 (123) 345-6789"} </p> 
                      <p className="text-sm mt-2 text-gray-700"> {form.getFieldValue("clientAddress") || "Client Address"} </p>
                      {/* Forgot to make this a variable ( I want to show you this asap so i'll let you Field.handleChange() *NO pun intended) */}
                      <p className="text-sm mt-2 text-blue-600 font-medium">Role: Project Owner </p>
                    </div>
               </div>
                </section>

                {/* Project  Overview */}
                  <section className="mb-8">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-700">
                      <Code className="w-5 h-5 text-blue-700" />
                      Project Overview
                    </h2>
                    <div className="bg-white p-6 rounded-lg border">
                      <h3 className="font-semibold text-lg mb-6 text-gray-900">
                        {form.getFieldValue('projectTitle') || 'Project Title'}
                      </h3>
                      <Badge className="mb-3 bg-red-500 hover:bg-red-600"> 
                          {getContractTypeBadge()}
                      </Badge>  

                      <div className="space-y-3 text-gray-700">
                        <p>
                          <strong>Project Description:</strong> {form.getFieldValue("projectDescription") || "Project description will be detailed here"}
                        </p>
                        {form.getFieldValue("businessModel") && (
                          <p>
                            <strong> Business Model: </strong> {form.getFieldValue("businessModel")}
                          </p>
                        )}
                        {form.getFieldValue("targetMarket") && (
                          <p>
                            <strong>Target Model:</strong> {form.getFieldValue("targetMarket")}
                          </p>
                        )} 
                        {form.getFieldValue("revenueStreams") &&
                        (
                          <p>
                            <strong>Revenue Streams:</strong> {form.getFieldValue("revenueStreams")}
                          </p>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Techinical Deliverables */}
                  <section className="mb-8">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-700">
                      <CheckCircle className="w-5 h-5 text-blue-700" />
                      Convergent Development Deliverables
                    </h2>
                        <div className="grid md:grid-cols-2 gap-6">
                          {/* core features */}
                          <div>
                            <h3 className="font-semibold mb-3  text-gray-900 ">Core Platform Features</h3>
                            <ul className="space-y-2">
                              {form.getFieldValue('coreFeatures').filter((f: string) => f.trim()).map((item: string, index: number) => (
                                <li key={index}  className="flex items-start gap-2 text-sm text-gray-700">
                                  <CheckCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                          {/* advanced features */}
                    <div>
                        <h3 className="font-semibold mb-3 text-gray-900">Advanced Features</h3>
                        <ul className="space-y-2">
                          {form.getFieldValue('advancedFeatures').filter((f: string) => f.trim()).map((item: string, index: number) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                              <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                        </div>
                  </section>
               {/* Financial Structure */}
              <section className="mb-8">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900">
                  <DollarSign className="w-5 h-5 text-red-600" />
                  Financial Structure
                </h2>
                
                <div className="mb-6">
                  <h3 className="font-semibold text-lg mb-3 text-gray-900">Service Fees</h3>
                  <div className="bg-white p-6 rounded-lg border">
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {form.getFieldValue('initialPayment') || '$TBD'}
                        </div>
                        <div className="text-sm text-gray-600">Initial Development (One-time)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-blue-600">
                          {form.getFieldValue('monthlyMaintenance') || '$TBD'}
                        </div>
                        <div className="text-sm text-gray-600">Monthly Maintenance & Support</div>
                      </div>
                    </div>
                    
                    {form.getFieldValue('contractType') === 'partnership' && form.getFieldValue('revenueSharing') && (
                      <div className="text-center border-t pt-4 border-gray-200">
                        <div className="text-lg font-bold text-purple-600">
                          {form.getFieldValue('revenueSharing')}
                        </div>
                        <div className="text-sm text-gray-600">Revenue Sharing Structure</div>
                      </div>
                    )}

                    <div className="border-t pt-4 border-gray-200 mt-4">
                      <h4 className="font-semibold mb-2 text-gray-900">Payment Terms</h4>
                      <ul className="text-sm space-y-1 text-gray-700">
                        <li>• 50% of development fee due upon contract signing</li>
                        <li>• 50% due upon project completion and launch</li>
                        <li>• Monthly maintenance billed in advance</li>
                        <li>• Late payments subject to 1.5% monthly service charge</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>

              {/* Special Arrangements */}
              {form.getFieldValue('specialArrangements') && (
                <section className="mb-8">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900">
                    <FileText className="w-5 h-5 text-yellow-600" />
                    Special Arrangements
                  </h2>
                  <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
                    <p className="text-sm text-yellow-700">
                      {form.getFieldValue('specialArrangements')}
                    </p>
                  </div>
                </section>
              )}

              {/* Signature Section - For Print Only */}
              <section className="border-t pt-8 border-gray-200">
                <h2 className="text-xl font-bold mb-6 text-center text-gray-900">Contract Execution</h2>
                
                <div className="mb-6 text-center">
                  <p className="text-gray-600">
                    Please review this agreement carefully. If you agree to these terms, please sign below and return via email.
                  </p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="text-center">
                    <div className="border-2 border-dashed border-gray-300 p-6 rounded-lg min-h-[150px] flex flex-col justify-between">
                      <div>
                        <h3 className="font-semibold mb-2 text-gray-900">Client Signature</h3>
                        <div className="h-16 flex items-center justify-center text-gray-400">
                          _________________________
                        </div>
                      </div>
                      <div>
                        <p className="text-sm mt-2 text-gray-700">{form.getFieldValue('clientName') || 'Client Name'}</p>
                        <p className="text-xs text-gray-500">Date: _______________</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-2 border-dashed border-gray-300 p-6 rounded-lg min-h-[150px] flex flex-col justify-between">
                      <div>
                        <h3 className="font-semibold mb-2 text-gray-900">Convergent Representative</h3>
                        <div className="h-16 flex items-center justify-center text-gray-400">
                          _________________________
                        </div>
                      </div>
                      <div>
                        <p className="text-sm mt-2 text-gray-700">Ali Alibrahimi</p>
                        <p className="text-xs text-gray-500">CEO, Convergent</p>
                        <p className="text-xs text-gray-500">Date: _______________</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <div className="inline-flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>Contract Generated: {currentDate}</span>
                  </div>
                </div>
              </section>

              {/* Footer */}
              <div className="mt-8 pt-4 border-t text-center text-xs text-gray-500 border-gray-200">
                <p>Contract ID: {contractId} | Generated: {currentDate}</p>
                <p>Convergent Professional Services | San Jose, CA | contact@convergent.dev</p>
                <p className="mt-2">Where all your technology needs converge</p>
                <p className="mt-1 font-medium">CONFIDENTIAL BUSINESS AGREEMENT</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          .max-w-6xl { 
            max-width: none !important; 
          }
          body { 
            -webkit-print-color-adjust: exact; 
          }
          .no-print { 
            display: none !important; 
          }
        }
      `}</style>
    </>
  );





































}