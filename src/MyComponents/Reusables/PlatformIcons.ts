import React from "react";
import type { JSX } from "react";
import {
  Github,
  Globe,
  Twitter,
  Linkedin,
  Facebook,
  Instagram,
  ArrowBigUp,
  Mail,
  Store,
  FileCode2,
  Cloud,
  Heading,
  AtSign,
  DollarSign,
  BookOpen,
  Briefcase,
  Code,
  Layout,
  Server,
  Youtube,
  MessageCircle,
  Image,
  Music,
  TrendingUp,
  AreaChart,
  Cpu,
  Zap
} from "lucide-react";
import { calendlyLogo, CanvaLogo, cloudflareLogo, discordLogo, fiverrLogo, gmailLogo, hostingerLogo, netlifyLogo, npmLogo, patreonLogo, paypalLogo, redditLogo, stripeLogo, tiktokLogo, twitchLogo, upworkLogo, vercelLogo } from "../ImgToIcon";

// Type definitions
type IconComponent = React.FC<React.SVGProps<SVGSVGElement>>;

// Platform style type
interface PlatformStyle {
  color: string;
  gradient: string;
  shadowColor: string;
}

// Expanded platform icon mapping
export const platformIcons: Record<string, IconComponent> = {
  // Original platforms
  github: Github,
  twitter: Twitter,
  linkedin: Linkedin,
  facebook: Facebook,
  gmail: gmailLogo,
  upwork: upworkLogo,
  fiverr: fiverrLogo,
  patreon: patreonLogo,
  dev: FileCode2,
  hostinger: hostingerLogo,
  hostingeremail: Mail,
  instagram: Instagram,
  
  // New platforms
  youtube: Youtube,
  twitch: twitchLogo,
  medium: BookOpen,
  substack: MessageCircle,
  behance: Image,
  dribbble: Image,
  slack: MessageCircle,
  discord: discordLogo,
  wordpress: Layout,
  shopify: Store,
  etsy: Store,
  pinterest: Image,
  tiktok: tiktokLogo,
  snapchat: Image,
  reddit: redditLogo,
  quora: MessageCircle,
  whatsapp: MessageCircle,
  telegram: MessageCircle,
  hubspot: AreaChart,
  salesforce: Cloud,
  mailchimp: Mail,
  stripe: stripeLogo,
  paypal: paypalLogo,
  aws: Server,
  azure: Cloud,
  googlecloud: Cloud,
  digitalocean: Cloud,
  netlify: netlifyLogo,
  vercel: vercelLogo,
  heroku: Server,
  cloudflare: cloudflareLogo,
  namecheap: Globe,
  godaddy: Globe,
  stackexchange: Code,
  stackoverflow: Code,
  codepen: Code,
  npm: npmLogo,
  gitlab: Code,
  bitbucket: Code,
  trello: Layout,
  asana: Layout,
  jira: Layout,
  googleworkspace: AtSign,
  microsoftoffice: Briefcase,
  notion: BookOpen,
  airtable: Layout,
  canva: CanvaLogo,
  calendly: calendlyLogo,
  adobe: Image,
  coinbase: DollarSign,
  binance: DollarSign,
  robinhood: TrendingUp,
  
  // Default fallback
  default: Globe,
};

// Expanded platform styles with accurate brand colors
export const platformStyles: Record<string, PlatformStyle> = {
  github: {
    color: "#ffffff",
    gradient: "from-[#00000] to-[#ffffff]",
    shadowColor: "rgba(252, 252, 252, 0.2)",
  },
  twitter: {
    color: "#1DA1F2", 
    gradient: "from-[#1A8CD8] to-[#1DA1F2]",
    shadowColor: "rgba(29, 161, 242, 0.5)",
  },
  linkedin: {
    color: "#0A66C2",
    gradient: "from-[#0077B5] to-[#0A66C2]",
    shadowColor: "rgba(10, 102, 194, 0.5)",
  },
  facebook: {
    color: "#fff",
    gradient: "from-[#296fcc] to-[#1354aa]",
    shadowColor: "rgba(24, 119, 242, 0.5)",
  },
  instagram: {
    color: "#fff",
    gradient: "from-[#833AB4] via-[#FD1D1D] to-[#FCAF45]",
    shadowColor: "rgba(228, 64, 95, 0.5)",
  },
  youtube: {
    color: "#FF0000",
    gradient: "from-[#FF0000] to-[#FF3333]",
    shadowColor: "rgba(255, 0, 0, 0.5)",
  },
  gmail: {
    color: "#ffffff",
    gradient: "from-[#ffffff] to-[#ffffff]",
    shadowColor: "rgba(252, 252, 252, 0.5)",
  },
  upwork: {
    color: "#19a503",
    gradient: "from-[#19a503] to-[#19a503]",
    shadowColor: "rgba(25, 165, 3, 0.5)",
  },
  fiverr: {
    color: "#00b727",
    gradient: "from-[#00b727] to-[#00b727]",
    shadowColor: "rgba(0, 183, 39, 0.5)",
  },
  patreon: {
    color: "#ff4c1c",
    gradient: "from-[#ff4c1c] to-[#ff4c1c]",
    shadowColor: "rgba(255, 76, 28, 0.5)",
  },
  dev: {
    color: "#0A0A0A",
    gradient: "from-[#000000] to-[#0A0A0A]",
    shadowColor: "rgba(10, 10, 10, 0.5)",
  },
  hostinger: {
    color: "#742ff6",
    gradient: "from-[#fff] to-[#bd9aff]",
    shadowColor: "rgba(189, 154, 255, 0.5)",
  },
  hostingeremail: {
    color: "#742ff6",
    gradient: "from-[#fff] to-[#bd9aff]",
    shadowColor: "rgba(189, 154, 255, 0.5)",
  },
  medium: {
    color: "#000000",
    gradient: "from-[#000000] to-[#333333]",
    shadowColor: "rgba(0, 0, 0, 0.5)",
  },
  substack: {
    color: "#FF6719",
    gradient: "from-[#FF5500] to-[#FF6719]",
    shadowColor: "rgba(255, 103, 25, 0.5)",
  },
  slack: {
    color: "#4A154B",
    gradient: "from-[#3F0E3F] to-[#4A154B]",
    shadowColor: "rgba(74, 21, 75, 0.5)",
  },
  discord: {
    color: "#5865F2",
    gradient: "from-[#5865F2] to-[#5865F2]",
    shadowColor: "rgba(88, 101, 242, 0.5)",
  },
  twitch: {
    color: "#4d00bd",
    gradient: "from-[#4d00bd] to-[#4d00bd]",
    shadowColor: "rgba(77, 0, 189, 0.8)",
  },
  behance: {
    color: "#1769FF",
    gradient: "from-[#0057FF] to-[#1769FF]",
    shadowColor: "rgba(23, 105, 255, 0.5)",
  },
  dribbble: {
    color: "#EA4C89",
    gradient: "from-[#C32361] to-[#EA4C89]",
    shadowColor: "rgba(234, 76, 137, 0.5)",
  },
  wordpress: {
    color: "#21759B",
    gradient: "from-[#1A5B7D] to-[#21759B]",
    shadowColor: "rgba(33, 117, 155, 0.5)",
  },
  shopify: {
    color: "#7AB55C",
    gradient: "from-[#64A044] to-[#7AB55C]",
    shadowColor: "rgba(122, 181, 92, 0.5)",
  },
  etsy: {
    color: "#F16521",
    gradient: "from-[#EB5E28] to-[#F16521]",
    shadowColor: "rgba(241, 101, 33, 0.5)",
  },
  pinterest: {
    color: "#E60023",
    gradient: "from-[#BD081C] to-[#E60023]",
    shadowColor: "rgba(230, 0, 35, 0.5)",
  },
  tiktok: {
    color: "#000000",
    gradient: "from-black to-[#000000]",
    shadowColor: "rgba(252, 252, 252, 0.2)",
  },
  snapchat: {
    color: "#FFFC00",
    gradient: "from-[#FFFC00] to-[#FFEB3B]",
    shadowColor: "rgba(255, 252, 0, 0.5)",
  },
  reddit: {
    color: "#FF4500",
    gradient: "from-[#FF4500] to-[#FF4500]",
    shadowColor: "rgba(255, 69, 0, 0.5)",
  },
  quora: {
    color: "#B92B27",
    gradient: "from-[#A82400] to-[#B92B27]",
    shadowColor: "rgba(185, 43, 39, 0.5)",
  },
  whatsapp: {
    color: "#25D366",
    gradient: "from-[#128C7E] to-[#25D366]",
    shadowColor: "rgba(37, 211, 102, 0.5)",
  },
  telegram: {
    color: "#26A5E4",
    gradient: "from-[#0088CC] to-[#26A5E4]",
    shadowColor: "rgba(38, 165, 228, 0.5)",
  },
  hubspot: {
    color: "#FF7A59",
    gradient: "from-[#FF7A59] to-[#FF957A]",
    shadowColor: "rgba(255, 122, 89, 0.5)",
  },
  salesforce: {
    color: "#00A1E0",
    gradient: "from-[#009EDB] to-[#00A1E0]",
    shadowColor: "rgba(0, 161, 224, 0.5)",
  },
  mailchimp: {
    color: "#FFE01B",
    gradient: "from-[#FFD200] to-[#FFE01B]",
    shadowColor: "rgba(255, 224, 27, 0.5)",
  },
  stripe: {
    color: "#5f70f3",
    gradient: "from-[#5f70f3] to-[#5f70f3]",
    shadowColor: "rgba(95, 112, 243, 0.8)",
  },
  paypal: {
    color: "#0e3fe8",
    gradient: "from-[#0e3fe8] to-[#0e3fe8]",
    shadowColor: "rgba(14, 63, 232, 0.8)",
  },
  aws: {
    color: "#232F3E",
    gradient: "from-[#FF9900] to-[#FFC400]",
    shadowColor: "rgba(255, 153, 0, 0.5)",
  },
  azure: {
    color: "#0078D4",
    gradient: "from-[#0062AD] to-[#0078D4]",
    shadowColor: "rgba(0, 120, 212, 0.5)",
  },
  googlecloud: {
    color: "#4285F4",
    gradient: "from-[#1A73E8] to-[#4285F4]",
    shadowColor: "rgba(66, 133, 244, 0.5)",
  },
  digitalocean: {
    color: "#0080FF",
    gradient: "from-[#0069D9] to-[#0080FF]",
    shadowColor: "rgba(0, 128, 255, 0.5)",
  },
  netlify: {
    color: "#00C7B7",
    gradient: "from-[#fff] to-[#b5fff9]",
    shadowColor: "rgba(0, 199, 183, 0.5)",
  },
  vercel: {
    color: "#919191",
    gradient: "from-[#000] to-[#000]",
    shadowColor: "rgba(252, 252, 252, 0.2)",
  },
  heroku: {
    color: "#430098",
    gradient: "from-[#360079] to-[#430098]",
    shadowColor: "rgba(67, 0, 152, 0.5)",
  },
  cloudflare: {
    color: "#F38020",
    gradient: "from-[#ffd9a2] to-[#ffd9a2]",
    shadowColor: "rgba(243, 128, 32, 0.5)",
  },
  namecheap: {
    color: "#FF5100",
    gradient: "from-[#DE4700] to-[#FF5100]",
    shadowColor: "rgba(255, 81, 0, 0.5)",
  },
  godaddy: {
    color: "#00A4A6",
    gradient: "from-[#00838F] to-[#00A4A6]",
    shadowColor: "rgba(0, 164, 166, 0.5)",
  },
  stackexchange: {
    color: "#1E5397",
    gradient: "from-[#195290] to-[#1E5397]",
    shadowColor: "rgba(30, 83, 151, 0.5)",
  },
  stackoverflow: {
    color: "#F58025",
    gradient: "from-[#E87722] to-[#F58025]",
    shadowColor: "rgba(245, 128, 37, 0.5)",
  },
  codepen: {
    color: "#000000",
    gradient: "from-[#131417] to-[#222222]",
    shadowColor: "rgba(0, 0, 0, 0.5)",
  },
  npm: {
    color: "#CB3837",
    gradient: "from-[#BB2E2C] to-[#CB3837]",
    shadowColor: "rgba(203, 56, 55, 0.5)",
  },
  gitlab: {
    color: "#FCA121",
    gradient: "from-[#FC6D26] to-[#FCA121]", 
    shadowColor: "rgba(252, 161, 33, 0.5)",
  },
  bitbucket: {
    color: "#0052CC",
    gradient: "from-[#0047B3] to-[#0052CC]",
    shadowColor: "rgba(0, 82, 204, 0.5)",
  },
  trello: {
    color: "#0079BF",
    gradient: "from-[#0065A2] to-[#0079BF]",
    shadowColor: "rgba(0, 121, 191, 0.5)",
  },
  asana: {
    color: "#F06A6A",
    gradient: "from-[#FC636B] to-[#F06A6A]",
    shadowColor: "rgba(240, 106, 106, 0.5)",
  },
  jira: {
    color: "#0052CC",
    gradient: "from-[#0047B3] to-[#0052CC]",
    shadowColor: "rgba(0, 82, 204, 0.5)",
  },
  googleworkspace: {
    color: "#4285F4",
    gradient: "from-[#1A73E8] to-[#4285F4]",
    shadowColor: "rgba(66, 133, 244, 0.5)",
  },
  microsoftoffice: {
    color: "#D83B01",
    gradient: "from-[#B7472A] to-[#D83B01]",
    shadowColor: "rgba(216, 59, 1, 0.5)",
  },
  notion: {
    color: "#000000",
    gradient: "from-[#000000] to-[#333333]",
    shadowColor: "rgba(0, 0, 0, 0.5)",
  },
  airtable: {
    color: "#18BFFF",
    gradient: "from-[#14AAE6] to-[#18BFFF]",
    shadowColor: "rgba(24, 191, 255, 0.5)",
  },
  canva: {
    color: "#00C4CC",
    gradient: "from-[#00A4AD] to-[#00C4CC]",
    shadowColor: "rgba(0, 196, 204, 0.5)",
  },
  calendly: {
    color: "#1874ee",
    gradient: "from-[#d6d6d6] to-[#d6d6d6]",
    shadowColor: "rgba(200, 200, 200, 200.5)"
  },
  adobe: {
    color: "#FF0000",
    gradient: "",
    shadowColor: "rgba(255, 0, 0, 0.5)",
  },
  coinbase: {
    color: "#0052FF",
    gradient: "from-[#0047CC] to-[#0052FF]",
    shadowColor: "rgba(0, 82, 255, 0.5)",
  },
  binance: {
    color: "#F0B90B",
    gradient: "from-[#F0B90B] to-[#FFCB3C]",
    shadowColor: "rgba(240, 185, 11, 0.5)",
  },
  robinhood: {
    color: "#00C805",
    gradient: "from-[#00A800] to-[#00C805]",
    shadowColor: "rgba(0, 200, 5, 0.5)",
  },
  
  default: {
    color: "#000000",
    gradient: "from-[#ffffff] to-[#ee2222]",
    shadowColor: "rgba(238, 34, 34, 1)",
  },
};

// Fixed function to get platform icon with proper styling
export const getPlatformIcon = (platformName: string): JSX.Element => {
  const lowerPlatform = platformName.toLowerCase();
  const IconComponent = platformIcons[lowerPlatform] || platformIcons.default;
  
  // This is the safer approach that works with Lucide icons
  return React.createElement(IconComponent, { 
    color: platformStyles[lowerPlatform]?.color || platformStyles.default.color,
   
  });
};