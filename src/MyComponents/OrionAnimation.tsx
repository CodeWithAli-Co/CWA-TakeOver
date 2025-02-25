import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

// Define props interface
interface OrionAnimationProps {
  onAnimationComplete?: () => void;
}

// Define custom SVG circle props to handle non-standard attributes
interface CustomCircleProps extends React.SVGProps<SVGCircleElement> {
  x0?: string | number;
  y0?: string | number;
  start?: string | number;
  trail?: string | boolean;
}

const OrionAnimation: React.FC<OrionAnimationProps> = ({ onAnimationComplete }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  console.log("orionAnimation mounted! hehe");

  // Initial mounting effect
  useEffect(() => {
    // Set a small delay to ensure DOM is fully rendered
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Main animation effect
  useEffect(() => {
    if (!isMounted || !svgRef.current) return;

    console.log("🔵 OrionAnimation: Starting GSAP animations...");
    const svg = svgRef.current;
    const tl = gsap.timeline({
      onComplete: () => {
        console.log("✅ OrionAnimation: GSAP finished all animations");
        
        // Fade out the container instead of instantly removing it
        if (containerRef.current) {
          gsap.to(containerRef.current, {
            opacity: 0,
            duration: 0.5,
            onComplete: () => {
              // After fading out, hide it completely
              if (containerRef.current) {
                containerRef.current.style.display = 'none';
              }
              if (onAnimationComplete) onAnimationComplete();
            }
          });
        } else {
          if (onAnimationComplete) onAnimationComplete();
        }
      }
    });
    
    // Helper function for getting SVG element lengths safely
    const getElementLength = (element: SVGGeometryElement): number => {
      try {
        if (element && typeof element.getTotalLength === 'function') {
          // Add a check to make sure the element is properly rendered
          const box = element.getBBox();
          if (box.width === 0 && box.height === 0) {
            console.warn('Element has zero dimensions, using fallback length');
            return 100; // Fallback length
          }
          return element.getTotalLength();
        }
      } catch (error) {
        console.warn('Error getting element length:', error);
      }
      return 100; // Fallback length if everything fails
    };
    
    // Make sure the animation is visible immediately - fixes black screen issue
    tl.set(svg, { opacity: 1 });

    // Fade-in animation for the entire SVG
    tl.from(svg, {
      opacity: 0,
      y: -50,
      duration: 1.5,
      ease: 'power2.out',
      onComplete: () => console.log("✅ OrionAnimation: GSAP finished first animation"),
    });

    // Time stamps
    const T_SHOOTING_STAR = 1.88 + 0.32;
    tl.add('shooting-star', T_SHOOTING_STAR);

    // Scene animation
    tl.from('.Scene', {
      scale: 1.12,
      duration: 2,
      ease: 'linear',
      svgOrigin: '1280 800',
    });

    tl.to('.Scene', {
      scale: 0.8,
      duration: 2.5,
      ease: 'power2.out',
      svgOrigin: '1280 800'
    }, 'shooting-star');

    // Grid animations
    const tlOutlines = gsap.timeline({
      defaults: {
        strokeDashoffset: 674.43 * 2,
        duration: 1,
        ease: 'power2.inOut'
      }
    });

    tl.set('#Grid > line', {
      strokeDasharray: 674.43,
      strokeDashoffset: 674.43
    }, 0);

    // Animate grid lines
    tlOutlines.to('#Grid > line:nth-child(1)', {
      strokeDashoffset: 674.43 * 2  
    }, 0.92);
    tlOutlines.to('#Grid > line:nth-child(2)', {
      strokeDashoffset: 674.43 * 2  
    }, 1.72);
    tlOutlines.to('#Grid > line:nth-child(4)', {
      strokeDashoffset: 674.43 * 2  
    }, 1);
    tlOutlines.to('#Grid > line:nth-child(3)', {
      strokeDashoffset: 674.43 * 2  
    }, 1.8);

    // Make the grid shrink
    tlOutlines.to('#Grid > line:nth-child(1)', {
      scaleY: 0,
      duration: 1.2,
      ease: 'power2.in'
    }, 4);
    tlOutlines.to('#Grid > line:nth-child(2)', {
      scaleY: 0,
      duration: 1.2,
      ease: 'power2.in'
    }, 4);
    tlOutlines.to('#Grid > line:nth-child(4)', {
      scaleX: 0,
      duration: 1.2,
      ease: 'power2.in'
    }, 4);
    tlOutlines.to('#Grid > line:nth-child(3)', {
      scaleX: 0,
      duration: 1.2,
      ease: 'power2.in'
    }, 4);

    // Inner grid animations
    const tlInside = gsap.timeline({
      defaults: {
        stagger: -0.1,
        duration: 1,
        ease: 'power1.out'
      }
    });
    
    tl.set('#Inner line:nth-child(-n+5)', {
      x: -572.71
    }, 0);
    tl.set('#Inner line:nth-child(n+6)', {
      y: 572.71
    }, 0);
    
    tlInside.to('#Inner line:nth-child(-n+5)', {
      x: 0
    }, 1.04);
    tlInside.to('#Inner line:nth-child(n+6)', {
      y: 0
    }, 1.08);

    tlInside.to('#Inner line:nth-child(-n+5)', {
      scaleX: 0
    }, 4);
    tlInside.to('#Inner line:nth-child(n+6)', {
      scaleY: 0
    }, 4);

    // Particle animations
    const tlParticles = gsap.timeline();
    const elParticles = svg.querySelectorAll('#Particles circle');
    
    elParticles.forEach(p => {
      const particle = p as SVGCircleElement;
      let start = parseFloat(particle.getAttribute('start') || '0');
      let x0 = parseFloat(particle.getAttribute('x0') || '0');
      let y0 = parseFloat(particle.getAttribute('y0') || '0');
      let simpleFade = (x0 === 0 && y0 === 0) ? true : false;
      
      if (simpleFade) {
        start = Math.random() * 1.3 + 0.2;
      }
      
      tlParticles.from(particle, {
        opacity: 0,
        duration: 0.3,
        ease: simpleFade ? 'power2.out' : 'power2.inOut'
      }, start);
      
      if (!simpleFade) {
        tlParticles.from(particle, {
          x: x0 * 96.7,
          y: y0 * 96.7,
          duration: simpleFade ? 0.3 : 1,
          ease: simpleFade ? 'power2.out' : 'power2.inOut'
        }, start + 0.1);
      }
      
      // Create a trail for the particle
      if (!simpleFade) {
        const trail = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        trail.setAttribute('stroke', 'white');
        
        if (particle.getAttribute('trail')) {
          trail.setAttribute('stroke', '#386364');
        }
        
        const cx = parseFloat(particle.getAttribute('cx') || '0');
        const cy = parseFloat(particle.getAttribute('cy') || '0');
        
        trail.setAttribute('x1', cx.toString());
        trail.setAttribute('y1', cy.toString());
        trail.setAttribute('x2', (cx + x0 * 96.7).toString());
        trail.setAttribute('y2', (cy + y0 * 96.7).toString());
        
        svg.appendChild(trail);
        try {
          const length = trail.getTotalLength();
          
          trail.setAttribute('stroke-dasharray', `${length * 0.5} ${length}`);
          trail.setAttribute('stroke-dashoffset', (length * 0.5).toString());
          
          tlParticles.to(trail, {
            strokeDashoffset: (length * 0.5 + length),
            duration: 1,
            ease: 'power2.inOut'
          }, start + 0.1);
          
          tlParticles.to(trail, {
            strokeDashoffset: (length * 0.5 * 2) + length,
            duration: 0.8,
            ease: 'power1.inOut'
          }, start + 0.9);
        } catch (error) {
          console.warn('Error animating trail:', error);
        }
      }
      
      // Explosion animation
      const x = gsap.utils.random(300, 1500) * (Math.random() > 0.5 ? 1 : -1);
      const y = gsap.utils.random(300, 1500) * (Math.random() > 0.5 ? 1 : -1);
      
      tlParticles.to(particle, {
        x,
        y,
        duration: Math.random() * 2 + 2,
        ease: 'expo.out'
      }, 2.2);
    });

    // Shooting star animation
    tl.from('#ShootingStar', {
      x: 1100,
      y: -1100,
      duration: .32,
      ease: 'none'
    }, 1.88);
    
    tl.from('#ShootingStarTrail1', {
      x: 50,
      y: -50,
      duration: .32,
      ease: 'none'
    }, 1.88);
    
    tl.from('#ShootingStarTrail2', {
      attr: {
        x2: 1516.79 + 500,
        y2: 955.83 - 500
      },
      duration: .32,
      ease: 'none'
    }, 1.88);
    
    tl.to('#ShootingStar', {
      scale: 0,
      duration: .02,
      ease: 'none'
    }, 'shooting-star');
    
    tl.from('#Blink', {
      scale: 0,
      duration: 0.08,
      ease: 'power2.out'
    }, 'shooting-star');
    
    tl.to('#Blink', {
      scale: 0,
      duration: 0.08,
      ease: 'power2.in'
    }, 'shooting-star+=0.08');

    // Circle animations
    const outCircle1 = svg.querySelector('#outCircle1') as SVGPathElement;
    if (outCircle1) {
      const length = getElementLength(outCircle1);
      tl.set(outCircle1, {
        strokeDasharray: length,
        strokeDashoffset: length
      }, 0);
      
      tl.to(outCircle1, {
        strokeDashoffset: 0,
        duration: 2,
        ease: 'power3.out'
      }, 'shooting-star');
    }
    
    const outCircle2 = svg.querySelector('#outCircle2') as SVGPathElement;
    if (outCircle2) {
      const length = getElementLength(outCircle2);
      tl.set(outCircle2, {
        strokeDasharray: length,
        strokeDashoffset: length
      }, 0);
      
      tl.to(outCircle2, {
        strokeDashoffset: 0,
        duration: 2,
        ease: 'power3.out'
      }, 'shooting-star+=0.5');
    }
    
    const outCircle3 = svg.querySelector('#outCircle3') as SVGPathElement;
    if (outCircle3) {
      const length = getElementLength(outCircle3);
      tl.set(outCircle3, {
        strokeDasharray: length,
        strokeDashoffset: length
      }, 0);
      
      tl.to(outCircle3, {
        strokeDashoffset: 0,
        duration: 2,
        ease: 'power3.out'
      }, 'shooting-star+=0.8');
    }
    
    const fillCircle1 = svg.querySelector('#fillCircle1') as SVGCircleElement;
    if (fillCircle1 && typeof fillCircle1.getTotalLength === 'function') {
      try {
        const length = fillCircle1.getTotalLength();
        tl.set(fillCircle1, {
          strokeDasharray: length + 2,
          strokeDashoffset: length + 2
        }, 0);
        
        tl.to(fillCircle1, {
          strokeDashoffset: 0,
          duration: 2,
          ease: 'power3.out'
        }, 'shooting-star+=0.64');
      } catch (error) {
        console.warn('Error animating fillCircle1:', error);
      }
    }
    
    const fillCircle2 = svg.querySelector('#fillCircle2') as SVGCircleElement;
    if (fillCircle2 && typeof fillCircle2.getTotalLength === 'function') {
      try {
        const length = fillCircle2.getTotalLength();
        tl.set(fillCircle2, {
          strokeDasharray: length + 5,
          strokeDashoffset: length + 5
        }, 0);
        
        tl.to(fillCircle2, {
          strokeDashoffset: 0,
          duration: 2.5,
          ease: 'power1.out'
        }, 'shooting-star+=1.1');
      } catch (error) {
        console.warn('Error animating fillCircle2:', error);
      }
    }

    const fillCircle3 = svg.querySelector('#fillCircle3') as SVGCircleElement;
    if (fillCircle3) {
      // Just animate position without using getTotalLength
      tl.from(fillCircle3, {
        x: 300,
        y: 300,
        duration: 2.5,
        ease: 'power1.out'
      }, 'shooting-star+=1.1');
    }
 
    // Ring animations
    const ringPaths = svg.querySelectorAll('#Ring path');
    if (ringPaths.length > 0) {
      ringPaths.forEach(ring => {
        const ringPath = ring as SVGPathElement;
        if (ringPath && typeof ringPath.getTotalLength === 'function') {
          try {
            const length = ringPath.getTotalLength();
            tl.set(ringPath, {
              strokeDasharray: length + 10,
              strokeDashoffset: length + 10
            }, 0);
            
            tl.to(ringPath, {
              strokeDashoffset: 0,
              duration: 2.8,
              ease: 'power2.out'
            }, 'shooting-star+=1.4');
          } catch (error) {
            console.warn('Error animating ring path:', error);
          }
        }
      });
    }

    // Add all timelines to the main one
    tl.add(tlOutlines, 0);
    tl.add(tlInside, 0);
    tl.add(tlParticles, 0);
    
    // Cleanup function
    return () => tl.kill();
  }, [isMounted, onAnimationComplete]);

  return (
    <div 
      ref={containerRef}
      className="orion-container"
      style={{
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw", // Use viewport width instead of percentage
        height: "100vh", // Use viewport height instead of percentage
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
        background: "#000",
        margin: 0, // Ensure no margin
        padding: 0, // Ensure no padding
        overflow: "hidden", // Prevent scrollbars
        opacity: 1,
        transition: "opacity 0.5s ease-in-out"
      }}
    >


      
      <svg ref={svgRef} className="space" viewBox="0 0 2560 1600" style={{ width: "100%", height: "100%" }}>
        <defs>
          <mask id="ringMask">
            <rect x="730" y="400" width="1000" height="800" fill="white" />
            <g fill="none" stroke="#000" strokeWidth="58" strokeLinecap="round">
              <path d="M1208.87,728.66C1311,629.58,1425.47,582,1464.64,622.33s-11.84,153.39-113.93,252.48" />
              <path d="M1208.87,728.66c-102.09,99.08-153.1,212.12-113.94,252.48s153.69-7.25,255.78-106.33" />
            </g>
          </mask>
          <clipPath id="innerClip">
            <rect x="993.16" y="514.63" width="572.71" height="572.71" />
          </clipPath>
          <mask id="innerCircleClip">
            <rect x="730" y="400" width="1000" height="800" fill="white" />
            <circle cx="1280.27" cy="801.73" r="133" fill="black" />
            <circle cx="1360" cy="870" r="133" fill="white" />
          </mask>
          <clipPath id="innerCircleClip2">
            <circle cx="1280.27" cy="801.73" r="133" fill="black" />
          </clipPath>
        </defs>
        
        <g className="Scene">
          {/* First part of Scene */}
          <g stroke="white" fill="none" strokeWidth="4">
            <path id="outCircle1" d="M1485.4,1006.87a289.22,289.22,0,0,1-205.13,85c-160.22,0-290.1-129.88-290.1-290.1s129.88-290.1,290.1-290.1,290.1,129.89,290.1,290.1a289.21,289.21,0,0,1-85,205.14" />
            <path id="outCircle2" d="M1074.4,855.3a213.13,213.13,0,0,1-6.8-53.57c0-117.45,95.21-212.67,212.67-212.67s212.67,95.22,212.67,212.67a212.67,212.67,0,0,1-212.67,212.68c-99,0-182.12-67.59-205.87-159.11" />
            <path id="outCircle3" d="M1143.48,801.73a136.79,136.79,0,1,1,136.79,136.79,136.78,136.78,0,0,1-136.79-136.79" />
          </g>
          <g mask="url(#ringMask)">
            <circle id="fillCircle1" cx="1280.27" cy="801.73" r="252" fill="none" stroke="white" strokeWidth="75.5" transform="rotate(-30 1280.27 801.73)" />
          </g>
          <g clipPath="url(#innerCircleClip2)">
            <circle id="fillCircle3" cx="1280.27" cy="801.73" r="133" fill="white" />
          </g>
          
          {/* Second part of Scene */}
          <circle id="fillCircle2" cx="1280.27" cy="801.73" r="172" fill="none" stroke="#c5163d" strokeWidth="78" transform="rotate(210 1280.27 801.73)" />
          <g id="Ring" fill="none" stroke="#287ad8" strokeWidth="58" strokeLinecap="round" mask="url(#innerCircleClip)">
            <path d="M1208.87,728.66C1311,629.58,1425.47,582,1464.64,622.33s-11.84,153.39-113.93,252.48" />
            <path d="M1208.87,728.66c-102.09,99.08-153.1,212.12-113.94,252.48s153.69-7.25,255.78-106.33" />
          </g>
          
          {/* Third part of Scene */}
          <g id="Grid" fill="none" stroke="#7eced6" strokeWidth="2">
            <line x1="990.17" y1="464.52" x2="990.17" y2="1138.95" />
            <line x1="1570.37" y1="464.52" x2="1570.37" y2="1138.95" />
            <line x1="1617.49" y1="511.63" x2="943.05" y2="511.63" />
            <line x1="1617.49" y1="1091.83" x2="943.05" y2="1091.83" />
            <g id="Inner" fill="none" stroke="#7eced6" strokeDasharray="3" clipPath="url(#innerClip)">
              <line x1="1565.88" y1="608.33" x2="993.16" y2="608.33" />
              <line x1="1565.88" y1="705.03" x2="993.16" y2="705.03" />
              <line x1="1565.88" y1="801.73" x2="993.16" y2="801.73" />
              <line x1="1565.88" y1="898.43" x2="993.16" y2="898.43" />
              <line x1="1565.88" y1="995.13" x2="993.16" y2="995.13" />
              <line x1="1473.67" y1="1087.34" x2="1473.67" y2="514.63" />
              <line x1="1376.97" y1="1087.34" x2="1376.97" y2="514.63" />
              <line x1="1280.27" y1="1087.34" x2="1280.27" y2="514.63" />
              <line x1="1183.57" y1="1087.34" x2="1183.57" y2="514.63" />
              <line x1="1086.87" y1="1087.34" x2="1086.87" y2="514.63" />
            </g>
          </g>
          
          {/* Particles group - using type assertion to avoid TypeScript errors */}
          <g id="Particles" fill="#fff" {...{} as any}>
            <circle cx="990.17" cy="511.63" r="2.62" x0="0" y0="0" start="1.44" />
            <circle cx="1086.87" cy="511.63" r="2.62" x0="4" y0="0" start="0.8" />
            <circle cx="1183.57" cy="511.63" r="2.62" x0="0" y0="0" start="1.76" />
            <circle cx="1280.27" cy="511.63" r="2.62" x0="0" y0="0" start="1.6" />
            <circle cx="1376.97" cy="511.63" r="2.62" x0="0" y0="0" start="1.8" />
            <circle cx="1473.67" cy="511.63" r="2.62" x0="0" y0="0" start="0.28" />
            <circle cx="1570.37" cy="511.63" r="2.62" x0="5" y0="0" start="0.56" />

            <circle cx="990.17" cy="608.33" r="2.62" x0="0" y0="0" start="1" />
            <circle cx="1086.87" cy="608.33" r="2.62" x0="0" y0="0" start="1.32" />
            <circle cx="1183.57" cy="608.33" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1280.27" cy="608.33" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1376.97" cy="608.33" r="2.62" x0="-3" y0="0" start="0" />
            <circle cx="1473.67" cy="608.33" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1570.37" cy="608.33" r="2.62" x0="0" y0="0" start="0" />

            <circle cx="990.17" cy="705.03" r="2.62" x0="0" y0="-2" start="0.5" />
            <circle cx="1086.87" cy="705.03" r="2.62" x0="0" y0="2" start="0.32" />
            <circle cx="1183.57" cy="705.03" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1280.27" cy="705.03" r="2.62" x0="3" y0="0" start="0.6" />
            <circle cx="1376.97" cy="705.03" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1473.67" cy="705.03" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1570.37" cy="705.03" r="2.62" x0="4" y0="0" start="0.9" trail="true" />

            <circle cx="990.17" cy="801.73" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1086.87" cy="801.73" r="2.62" x0="-4" y0="0" start="0.8" trail="true" />
            <circle cx="1183.57" cy="801.73" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1280.27" cy="801.73" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1376.97" cy="801.73" r="2.62" x0="0" y0="3" start="0.76" />
            <circle cx="1473.67" cy="801.73" r="2.62" x0="0" y0="3" start="1.32" />
            <circle cx="1570.37" cy="801.73" r="2.62" x0="0" y0="0" start="0" />

            <circle cx="990.17" cy="898.43" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1086.87" cy="898.43" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1183.57" cy="898.43" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1280.27" cy="898.43" r="2.62" x0="0" y0="3" start="0.6" />
            <circle cx="1376.97" cy="898.43" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1473.67" cy="898.43" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1570.37" cy="898.43" r="2.62" x0="0" y0="0" start="0" />

            <circle cx="990.17" cy="995.13" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1086.87" cy="995.13" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1183.57" cy="995.13" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1280.27" cy="995.13" r="2.62" x0="0" y0="1" start="1.24" />
            <circle cx="1376.97" cy="995.13" r="2.62" x0="4" y0="0" start="0.52" />
            <circle cx="1473.67" cy="995.13" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1570.37" cy="995.13" r="2.62" x0="0" y0="0" start="0" />

            <circle cx="990.17" cy="1091.84" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1086.87" cy="1091.84" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1183.57" cy="1091.84" r="2.62" x0="0" y0="4" start="0.9" />
            <circle cx="1280.27" cy="1091.84" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1376.97" cy="1091.84" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1473.67" cy="1091.84" r="2.62" x0="0" y0="0" start="0" />
            <circle cx="1570.37" cy="1091.84" r="2.62" x0="0" y0="0" start="0" />
          </g>
          
          <g id="ShootingStar">
            <line id="ShootingStarTrail2" x1="1476.29" y1="995.13" x2="1516.79" y2="955.83" fill="none" stroke="#878787" strokeWidth="2" strokeDasharray="10" />
            <line id="ShootingStarTrail1" x1="1476.29" y1="995.13" x2="1516.79" y2="955.83" fill="none" stroke="#878787" strokeWidth="3" />
            <line x1="1476.29" y1="995.13" x2="1516.79" y2="955.83" fill="none" stroke="#fff" strokeWidth="5" />
          </g>
          <path id="Blink" d="M1453,974.13s14.43,10.31,22.16,10.82,24.23-12.37,24.23-12.37-10.82,10.31-10.57,22.55,10.57,26.67,10.57,26.67-13.41-13.4-23.72-13.4-23.72,11.85-23.72,11.85,6.18-12.37,6.7-22.93S1453,974.13,1453,974.13Z" fill="#fff"/>
        </g>
      </svg>
    </div>
  );
};

export default OrionAnimation;

function setIsMounted(arg0: boolean) {
  throw new Error('Function not implemented.');
}


// At the end of the file
// module.exports = OrionAnimation;