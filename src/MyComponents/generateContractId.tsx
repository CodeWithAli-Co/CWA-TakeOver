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
        contractType: '' ,
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
        // clientSignature: '',
        // providerSignature: '',
        // signatureDate: '',
    
        // Dates
        contractDate: new Date().toLocaleDateString('en-US'),
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      }
           
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
                    className='bg-blue-100 border-black'
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
  )
}





































}