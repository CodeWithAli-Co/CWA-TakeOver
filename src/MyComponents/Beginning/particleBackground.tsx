// particleBackground.tsx
import { useRef, useEffect } from 'react';

// Particle class for the animation
class Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  color: string;
  
  constructor(canvas: HTMLCanvasElement) {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 2 + 0.1;
    this.speedX = Math.random() * 0.5 - 0.25;
    this.speedY = Math.random() * 0.5 - 0.25;
    this.color = `rgba(${Math.floor(Math.random() * 100 + 155)}, 0, 0, ${Math.random() * 0.5 + 0.25})`;
  }
  
  update(canvas: HTMLCanvasElement) {
    this.x += this.speedX;
    this.y += this.speedY;
    
    if (this.x > canvas.width) this.x = 0;
    if (this.x < 0) this.x = canvas.width;
    if (this.y > canvas.height) this.y = 0;
    if (this.y < 0) this.y = canvas.height;
  }
  
  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

interface ParticleBackgroundProps {
  particleColor?: string; // Optional prop to customize particle color (default is red)
  lineColor?: string; // Optional prop to customize connection line color
  particleCount?: number; // Optional prop to set number of particles
  connectionDistance?: number; // Optional prop to set how far particles connect
}

export const ParticleBackground: React.FC<ParticleBackgroundProps> = ({
  particleColor = 'red',
  lineColor = 'rgba(170, 0, 0, 0.2)',
  particleCount = 100,
  connectionDistance = 100
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  
  // Create color generator function based on particleColor prop
  const generateColor = () => {
    if (particleColor === 'red') {
      return `rgba(${Math.floor(Math.random() * 100 + 155)}, 0, 0, ${Math.random() * 0.5 + 0.25})`;
    } else if (particleColor === 'blue') {
      return `rgba(0, 0, ${Math.floor(Math.random() * 100 + 155)}, ${Math.random() * 0.5 + 0.25})`;
    } else if (particleColor === 'green') {
      return `rgba(0, ${Math.floor(Math.random() * 100 + 155)}, 0, ${Math.random() * 0.5 + 0.25})`;
    } else if (particleColor === 'cyan') {
      return `rgba(0, ${Math.floor(Math.random() * 100 + 155)}, ${Math.floor(Math.random() * 100 + 155)}, ${Math.random() * 0.5 + 0.25})`;
    } else if (particleColor === 'purple') {
      return `rgba(${Math.floor(Math.random() * 100 + 155)}, 0, ${Math.floor(Math.random() * 100 + 155)}, ${Math.random() * 0.5 + 0.25})`;
    } else if (particleColor === 'white') {
      const intensity = Math.floor(Math.random() * 100 + 155);
      return `rgba(${intensity}, ${intensity}, ${intensity}, ${Math.random() * 0.5 + 0.25})`;
    } else {
      // Default fallback
      return `rgba(${Math.floor(Math.random() * 100 + 155)}, 0, 0, ${Math.random() * 0.5 + 0.25})`;
    }
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions
    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    // Initialize particles
    particlesRef.current = [];
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push(new Particle(canvas));
      
      // Override particle color based on prop
      particlesRef.current[i].color = generateColor();
    }
    
    // Animation loop
    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw particles
      particlesRef.current.forEach(particle => {
        particle.update(canvas);
        particle.draw(ctx);
      });
      
      // Connect close particles with lines
      connectParticles(ctx);
      
      animationId = requestAnimationFrame(animate);
    };
    
    // Function to connect particles with lines
    const connectParticles = (ctx: CanvasRenderingContext2D) => {
      for (let i = 0; i < particlesRef.current.length; i++) {
        for (let j = i; j < particlesRef.current.length; j++) {
          const dx = particlesRef.current[i].x - particlesRef.current[j].x;
          const dy = particlesRef.current[i].y - particlesRef.current[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < connectionDistance) {
            // Create dynamic line color based on lineColor prop
            let dynamicLineColor;
            if (lineColor === 'rgba(170, 0, 0, 0.2)') {
              dynamicLineColor = `rgba(170, 0, 0, ${0.2 * (1 - distance / connectionDistance)})`;
            } else {
              // Parse the color to maintain alpha based on distance
              const baseColor = lineColor.replace(/[\d.]+\)$/, '');
              dynamicLineColor = `${baseColor}${0.2 * (1 - distance / connectionDistance)})`;
            }
            
            ctx.beginPath();
            ctx.strokeStyle = dynamicLineColor;
            ctx.lineWidth = 0.2;
            ctx.moveTo(particlesRef.current[i].x, particlesRef.current[i].y);
            ctx.lineTo(particlesRef.current[j].x, particlesRef.current[j].y);
            ctx.stroke();
          }
        }
      }
    };
    
    animate();
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      cancelAnimationFrame(animationId);
    };
  }, [particleColor, lineColor, particleCount, connectionDistance]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 z-0"
      style={{ backgroundColor: 'black' }}
    />
  );
};

export default ParticleBackground;