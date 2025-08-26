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
    clientCompany?: '',

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
    steContractData(prev => ({
        ...prev, [field] : value
    }));
  } ;

  const handleFeatureChange = (type: 'coreFeatures' | 'advancedFeatures', index: number, value: string): void => {
    setContractData(prev => ({
      ...prev,
      [type]: prev[type].map((item, i) => i === index ? value : item)
    }));
  };

  const addFeature = (type: 'core') 
}