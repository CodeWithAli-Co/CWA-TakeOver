import { createLazyFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Terminal,
  Zap,
  GitBranch,
  AlertTriangle,
  CheckCircle,
  Target,
  Rocket,
  Brain,
  Code2,
  TrendingUp,
  Play,
  Pause,
  RotateCcw,
  Lightbulb,
  Flame,
  Trophy,
  Copy,
  Check,
  X,
  Plus,
  BarChart3,
  Bug,
  MessageSquare,
  ShieldAlert,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react'
import { Resource, ResourcesStation } from '@/MyComponents/ResourceStation'

// ============================================================================
// TYPES
// ============================================================================

interface FocusSession {
  id: string
  task: string
  project: string
  startedAt: number
  duration: number // in minutes
  completedPomodoros: number
  notes: string[]
  status: 'active' | 'paused' | 'completed'
}

interface Decision {
  id: string
  title: string
  context: string
  decision: string
  alternatives: string[]
  reasoning: string
  project: string
  timestamp: number
  tags: string[]
  outcome?: string
}

interface CodePattern {
  id: string
  title: string
  description: string
  code: string
  language: string
  tags: string[]
  usedIn: string[]
  createdAt: number
}

interface SystemStatus {
  name: string
  status: 'operational' | 'degraded' | 'down'
  lastChecked: number
  latency?: number
}

interface Metric {
  label: string
  value: string | number
  change?: number
  trend?: 'up' | 'down' | 'stable'
}

interface CommandLogEntry {
  id: string
  command: string
  output: string
  timestamp: number
  project: string
  status: 'success' | 'error' | 'running'
}

interface QuickCapture {
  id: string
  content: string
  type: 'thought' | 'bug' | 'idea' | 'todo' | 'blocker'
  timestamp: number
  processed: boolean
}

interface ScheduleEvent {
  id: string
  title: string
  description?: string
  date: string // YYYY-MM-DD
  startTime: string // HH:mm (24-hour)
  duration: number // in minutes
  category: 'work' | 'personal' | 'meeting' | 'gym' | 'other'
  completed: boolean
}

// ============================================================================
// STORAGE
// ============================================================================

const STORAGE_KEY = 'simplicity-mission-control'

const loadState = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

const saveState = (state: any) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Failed to save state:', e)
  }
}

// ============================================================================
// INITIAL DATA
// ============================================================================

const initialDecisions: Decision[] = [
  {
    id: 'dec-1',
    title: 'Migrate from Tauri to Next.js',
    context: 'Desktop app had distribution challenges. Code signing was expensive. Web-first approach aligns better with YC and user acquisition.',
    decision: 'Build Simplicity as a Next.js web app, pause desktop development.',
    alternatives: ['Continue with Tauri', 'Build Electron app', 'React Native for mobile-first'],
    reasoning: 'Web has lower friction for user acquisition. Can still wrap in Tauri/Electron later. Faster iteration cycles. Better for demo purposes.',
    project: 'simplicity-web',
    timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
    tags: ['architecture', 'strategy', 'yc'],
  },
]


const initialPatterns: CodePattern[] = [
  {
    id: 'pattern-1',
    title: 'SSR-Safe Zustand Storage',
    description: 'Prevents localStorage errors during server-side rendering with Zustand persist middleware',
    code: `// stores/ssrStorage.ts
'use client';

import { StateStorage } from 'zustand/middleware';

export const ssrSafeStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(name);
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(name, value);
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(name);
  },
};

// Usage in store:
// storage: ssrSafeStorage,
// skipHydration: true,`,
    language: 'typescript',
    tags: ['zustand', 'ssr', 'next.js', 'storage'],
    usedIn: ['simplicity-web'],
    createdAt: Date.now(),
  },
  {
    id: 'pattern-2',
    title: 'Next.js 15 Dynamic Route Params',
    description: 'Handle async params in Next.js 15 with React.use()',
    code: `"use client"

import { use } from "react"

interface PageProps {
  params: Promise<{ slug: string }>
}

export default function Page({ params }: PageProps) {
  const { slug } = use(params)
  return <Component slug={slug} />
}`,
    language: 'typescript',
    tags: ['next.js', 'routing', 'params'],
    usedIn: ['simplicity-web'],
    createdAt: Date.now(),
  },
]

const systemStatuses: SystemStatus[] = [
  { name: 'Supabase', status: 'operational', lastChecked: Date.now(), latency: 45 },
  { name: 'Stripe', status: 'operational', lastChecked: Date.now(), latency: 120 },
  { name: 'Plaid', status: 'operational', lastChecked: Date.now(), latency: 200 },
  { name: 'Vercel', status: 'operational', lastChecked: Date.now(), latency: 30 },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getDayName = (date: Date): string => {
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

const getWeekDays = (startDate: Date): Date[] => {
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(startDate)
    day.setDate(startDate.getDate() + i)
    days.push(day)
  }
  return days
}

const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  return new Date(d.setDate(diff))
}

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

const checkConflict = (event1: ScheduleEvent, event2: ScheduleEvent): boolean => {
  if (event1.date !== event2.date) return false
  
  const start1 = timeToMinutes(event1.startTime)
  const end1 = start1 + event1.duration
  const start2 = timeToMinutes(event2.startTime)
  const end2 = start2 + event2.duration
  
  return (start1 < end2 && end1 > start2)
}

// ============================================================================
// COMPONENT
// ============================================================================

const SimplicityMissionControl = () => {

  const [resources, setResources] = useState<Resource[]>(() => {
  const saved = loadState()
  return saved?.resources || []
})


  // ===== STATE =====
const [activeStation, setActiveStation] = useState<
  'command' | 'focus' | 'decisions' | 'patterns' | 'warroom' | 'metrics' | 'schedule' | 'resources'
>('command')

  const [currentTime, setCurrentTime] = useState(new Date())
  const [commandInput, setCommandInput] = useState('')
  const [commandHistory, setCommandHistory] = useState<CommandLogEntry[]>([])
  const [quickCaptures, setQuickCaptures] = useState<QuickCapture[]>([])
  const [decisions, setDecisions] = useState<Decision[]>(() => {
    const saved = loadState()
    return saved?.decisions || initialDecisions
  })
  const [patterns, setPatterns] = useState<CodePattern[]>(() => {
    const saved = loadState()
    return saved?.patterns || initialPatterns
  })
  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEvent[]>(() => {
    const saved = loadState()
    return saved?.scheduleEvents || []
  })

  // Focus Mode State
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null)
  const [focusTimeLeft, setFocusTimeLeft] = useState(25 * 60) // 25 min in seconds
  const [focusInput, setFocusInput] = useState({ task: '', project: 'simplicity-web' })

  // Schedule State
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()))
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()))
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    startTime: '09:00',
    duration: 60,
    category: 'work' as ScheduleEvent['category'],
  })

  // Quick Capture
  const [captureInput, setCaptureInput] = useState('')
  const [captureType, setCaptureType] = useState<QuickCapture['type']>('thought')
  const [showCapture, setShowCapture] = useState(false)

  // New Decision Form
  const [showNewDecision, setShowNewDecision] = useState(false)
  const [newDecision, setNewDecision] = useState({
    title: '',
    context: '',
    decision: '',
    alternatives: '',
    reasoning: '',
    project: 'simplicity-web',
    tags: '',
  })

  // New Pattern Form
  const [showNewPattern, setShowNewPattern] = useState(false)
  const [newPattern, setNewPattern] = useState({
    title: '',
    description: '',
    code: '',
    language: 'typescript',
    tags: '',
  })

  // UI State
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [systemStatus] = useState<SystemStatus[]>(systemStatuses)
  const commandInputRef = useRef<HTMLInputElement>(null)
  const terminalRef = useRef<HTMLDivElement>(null)

  // ===== EFFECTS =====

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Focus Timer
  useEffect(() => {
    if (focusSession?.status === 'active' && focusTimeLeft > 0) {
      const timer = setInterval(() => {
        setFocusTimeLeft(prev => prev - 1)
      }, 1000)
      return () => clearInterval(timer)
    } else if (focusTimeLeft === 0 && focusSession?.status === 'active') {
      // Pomodoro complete
      setFocusSession(prev => prev ? {
        ...prev,
        completedPomodoros: prev.completedPomodoros + 1,
        status: 'paused'
      } : null)
      // Play sound or notification here
    }
  }, [focusSession?.status, focusTimeLeft])

  // Persist State
useEffect(() => {
  saveState({ decisions, patterns, quickCaptures, scheduleEvents, resources })
}, [decisions, patterns, quickCaptures, scheduleEvents, resources])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K = Focus command input
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        commandInputRef.current?.focus()
      }
      // Cmd/Ctrl + . = Quick capture
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault()
        setShowCapture(true)
      }
      // Escape = Close modals
      if (e.key === 'Escape') {
        setShowCapture(false)
        setShowNewDecision(false)
        setShowNewPattern(false)
        setShowNewEvent(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ===== COMMAND PROCESSOR =====

  const processCommand = (cmd: string) => {
    const parts = cmd.trim().toLowerCase().split(' ')
    const command = parts[0]
    const args = parts.slice(1)

    let output = ''
    let status: CommandLogEntry['status'] = 'success'

    switch (command) {
      case 'help':
        output = `
Available Commands:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  status              - Show all system statuses
  focus <task>        - Start a focus session
  deploy <project>    - Trigger deployment
  git <project>       - Show recent commits
  open <project>      - Open project in VS Code
  run <project>       - Start dev server
  metrics             - Show key metrics
  yc                  - Show YC checklist
  schedule            - Show today's schedule
  clear               - Clear terminal
  
Shortcuts:
  Cmd+K               - Focus command input
  Cmd+.               - Quick capture
`
        break

      case 'status':
        output = systemStatus.map(s => 
          `${s.status === 'operational' ? '●' : '○'} ${s.name.padEnd(12)} ${s.status.padEnd(12)} ${s.latency}ms`
        ).join('\n')
        break

      case 'focus':
        if (args.length === 0) {
          output = 'Usage: focus <task description>'
          status = 'error'
        } else {
          const task = args.join(' ')
          setFocusSession({
            id: `focus-${Date.now()}`,
            task,
            project: 'simplicity-web',
            startedAt: Date.now(),
            duration: 25,
            completedPomodoros: 0,
            notes: [],
            status: 'active'
          })
          setFocusTimeLeft(25 * 60)
          setActiveStation('focus')
          output = `🎯 Focus session started: "${task}"\n   25 minutes on the clock. Let's go.`
        }
        break

      case 'schedule':
        const today = formatDate(new Date())
        const todayEvents = scheduleEvents
          .filter(e => e.date === today)
          .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
        
        if (todayEvents.length === 0) {
          output = 'No events scheduled for today.'
        } else {
          output = `Today's Schedule (${today}):\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            todayEvents.map(e => 
              `  ${e.startTime} - ${e.title} (${e.duration}min) ${e.completed ? '✓' : ''}`
            ).join('\n')
        }
        setActiveStation('schedule')
        break

      case 'deploy':
        const project = args[0] || 'simplicity-web'
        output = `🚀 Deploying ${project}...\n   Pushing to Vercel...\n   Build started.\n   \n   View at: https://vercel.com/dashboard`
        break

      case 'git':
        output = `Recent commits (simplicity-web):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  2h ago   fix: SSR localStorage errors in Zustand stores
  5h ago   feat: Add profile settings page routing
  1d ago   refactor: Migrate to Next.js 15 param handling
  2d ago   fix: Stripe webhook signature verification
  3d ago   feat: Implement savings simulator component`
        break

      case 'open':
        const proj = args[0] || 'web'
        const paths: Record<string, string> = {
          'web': 'C:/Dev/Python GitHub/simplicity_web',
          'desktop': 'C:/Dev/Python GitHub/simplicity',
          'site': 'C:/Dev/Python GitHub/officialBudgetary_site',
          'takeover': 'C:/Dev/Python GitHub/cwaTakeOver',
        }
        output = `Opening ${proj} in VS Code...\n   Path: ${paths[proj] || 'Unknown project'}`
        // In real Tauri app: invoke('open_vscode', { path: paths[proj] })
        break

      case 'run':
        const runProj = args[0] || 'web'
        const ports: Record<string, number> = { web: 3000, desktop: 1420, site: 3001 }
        output = `Starting dev server for ${runProj}...\n   npm run dev\n   → localhost:${ports[runProj] || 3000}`
        break

      case 'metrics':
        output = `
Simplicity Metrics Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Survey Responses:     1,000+
  User Interviews:      40+
  Beta Signups:         127
  GitHub Stars:         23
  
  Code Stats:
  - Components:         84
  - Lines of Code:      ~45,000
  - Test Coverage:      32%
  
  Runway:               Self-funded
  Target:               YC W26`
        break

      case 'yc':
        output = `
YC W26 Application Checklist
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [x] Company description
  [x] Problem statement  
  [x] Solution overview
  [ ] Demo video (1 min)
  [ ] Founder video
  [x] Market size research
  [x] Traction metrics
  [ ] Technical deep-dive doc
  
  Deadline: ~45 days
  Status: IN PROGRESS`
        break

      case 'clear':
        setCommandHistory([])
        return

      default:
        output = `Command not found: ${command}\nType 'help' for available commands.`
        status = 'error'
    }

    const entry: CommandLogEntry = {
      id: `cmd-${Date.now()}`,
      command: cmd,
      output,
      timestamp: Date.now(),
      project: 'system',
      status
    }

    setCommandHistory(prev => [...prev, entry])
    setCommandInput('')

    // Auto-scroll terminal
    setTimeout(() => {
      terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight, behavior: 'smooth' })
    }, 100)
  }

  // ===== HANDLERS =====

  const handleQuickCapture = () => {
    if (!captureInput.trim()) return

    const capture: QuickCapture = {
      id: `capture-${Date.now()}`,
      content: captureInput,
      type: captureType,
      timestamp: Date.now(),
      processed: false
    }

    setQuickCaptures(prev => [capture, ...prev])
    setCaptureInput('')
    setShowCapture(false)
  }

  const handleAddDecision = () => {
    if (!newDecision.title.trim() || !newDecision.decision.trim()) return

    const decision: Decision = {
      id: `dec-${Date.now()}`,
      title: newDecision.title,
      context: newDecision.context,
      decision: newDecision.decision,
      alternatives: newDecision.alternatives.split('\n').filter(Boolean),
      reasoning: newDecision.reasoning,
      project: newDecision.project,
      timestamp: Date.now(),
      tags: newDecision.tags.split(',').map(t => t.trim()).filter(Boolean),
    }

    setDecisions(prev => [decision, ...prev])
    setNewDecision({
      title: '',
      context: '',
      decision: '',
      alternatives: '',
      reasoning: '',
      project: 'simplicity-web',
      tags: '',
    })
    setShowNewDecision(false)
  }

  const handleAddPattern = () => {
    if (!newPattern.title.trim() || !newPattern.code.trim()) return

    const pattern: CodePattern = {
      id: `pattern-${Date.now()}`,
      title: newPattern.title,
      description: newPattern.description,
      code: newPattern.code,
      language: newPattern.language,
      tags: newPattern.tags.split(',').map(t => t.trim()).filter(Boolean),
      usedIn: [],
      createdAt: Date.now(),
    }

    setPatterns(prev => [pattern, ...prev])
    setNewPattern({
      title: '',
      description: '',
      code: '',
      language: 'typescript',
      tags: '',
    })
    setShowNewPattern(false)
  }

  const handleAddEvent = () => {
    if (!newEvent.title.trim()) return

    const event: ScheduleEvent = {
      id: `event-${Date.now()}`,
      title: newEvent.title,
      description: newEvent.description,
      date: selectedDate,
      startTime: newEvent.startTime,
      duration: newEvent.duration,
      category: newEvent.category,
      completed: false,
    }

    // Check for conflicts
    const hasConflict = scheduleEvents.some(existing => checkConflict(event, existing))
    if (hasConflict) {
      alert('⚠️ Schedule conflict detected! This event overlaps with an existing one.')
      return
    }

    setScheduleEvents(prev => [...prev, event])
    setNewEvent({
      title: '',
      description: '',
      startTime: '09:00',
      duration: 60,
      category: 'work',
    })
    setShowNewEvent(false)
  }

  const toggleEventComplete = (eventId: string) => {
    setScheduleEvents(prev =>
      prev.map(e => e.id === eventId ? { ...e, completed: !e.completed } : e)
    )
  }

  const deleteEvent = (eventId: string) => {
    setScheduleEvents(prev => prev.filter(e => e.id !== eventId))
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusIndicator = (status: SystemStatus['status']) => {
    switch (status) {
      case 'operational':
        return <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      case 'degraded':
        return <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
      case 'down':
        return <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
    }
  }

  const getCaptureIcon = (type: QuickCapture['type']) => {
    switch (type) {
      case 'thought': return <Brain size={14} />
      case 'bug': return <Bug size={14} className="text-red-400" />
      case 'idea': return <Lightbulb size={14} className="text-yellow-400" />
      case 'todo': return <CheckCircle size={14} className="text-blue-400" />
      case 'blocker': return <AlertTriangle size={14} className="text-orange-400" />
    }
  }

  const getCategoryColor = (category: ScheduleEvent['category']) => {
    switch (category) {
      case 'work': return 'bg-teal-500/20 text-teal-400 border-teal-500/50'
      case 'personal': return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      case 'meeting': return 'bg-purple-500/20 text-purple-400 border-purple-500/50'
      case 'gym': return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      case 'other': return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/50'
    }
  }

  // ===== RENDER =====

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden font-mono">
      {/* ===== TOP BAR ===== */}
      <header className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Rocket className="text-teal-500" size={20} />
            <span className="font-bold tracking-tight">SIMPLICITY</span>
            <span className="text-zinc-500 text-sm">MISSION CONTROL</span>
          </div>

          {/* System Status Indicators */}
          <div className="flex items-center gap-3 ml-6 pl-6 border-l border-zinc-800">
            {systemStatus.map(s => (
              <div key={s.name} className="flex items-center gap-1.5" title={`${s.name}: ${s.status}`}>
                {getStatusIndicator(s.status)}
                <span className="text-xs text-zinc-500">{s.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Quick Capture Button */}
          <button
            onClick={() => setShowCapture(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-sm transition-colors"
          >
            <Zap size={14} className="text-yellow-400" />
            <span>Capture</span>
            <kbd className="text-xs text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded">⌘.</kbd>
          </button>

          {/* Clock */}
          <div className="text-right">
            <div className="text-sm font-bold">{currentTime.toLocaleTimeString()}</div>
            <div className="text-xs text-zinc-500">{currentTime.toLocaleDateString()}</div>
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* ===== SIDEBAR ===== */}
        <nav className="w-16 border-r border-zinc-800 flex flex-col items-center py-4 gap-2 bg-zinc-900/30">
          {[
            { id: 'command', icon: Terminal, label: 'Command' },
{ id: 'schedule', icon: Calendar, label: 'Schedule' },
{ id: 'focus', icon: Target, label: 'Focus' },
{ id: 'decisions', icon: GitBranch, label: 'Decisions' },
{ id: 'patterns', icon: Code2, label: 'Patterns' },
{ id: 'resources', icon: BookOpen, label: 'Resources' },  // ADD THIS LINE
{ id: 'warroom', icon: Flame, label: 'War Room' },
{ id: 'metrics', icon: BarChart3, label: 'Metrics' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveStation(id as any)}
              className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all group relative ${
                activeStation === id
                  ? 'bg-teal-500/20 text-teal-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
              title={label}
            >
              <Icon size={22} />
              {activeStation === id && (
                <motion.div
                  layoutId="station-indicator"
                  className="absolute left-0 w-1 h-8 bg-teal-500 rounded-r"
                />
              )}
            </button>
          ))}
        </nav>

        {/* ===== MAIN PANEL ===== */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* ===== COMMAND STATION ===== */}
          {activeStation === 'command' && (
            <div className="flex-1 flex flex-col">
              {/* Terminal Output */}
              <div
                ref={terminalRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/50"
              >
                {/* Welcome Message */}
                {commandHistory.length === 0 && (
                  <div className="text-zinc-500">
                    <pre className="text-teal-500 text-xs mb-4">{`
  ███████╗██╗███╗   ███╗██████╗ ██╗     ██╗ ██████╗██╗████████╗██╗   ██╗
  ██╔════╝██║████╗ ████║██╔══██╗██║     ██║██╔════╝██║╚══██╔══╝╚██╗ ██╔╝
  ███████╗██║██╔████╔██║██████╔╝██║     ██║██║     ██║   ██║    ╚████╔╝ 
  ╚════██║██║██║╚██╔╝██║██╔═══╝ ██║     ██║██║     ██║   ██║     ╚██╔╝  
  ███████║██║██║ ╚═╝ ██║██║     ███████╗██║╚██████╗██║   ██║      ██║   
  ╚══════╝╚═╝╚═╝     ╚═╝╚═╝     ╚══════╝╚═╝ ╚═════╝╚═╝   ╚═╝      ╚═╝   
                    `}</pre>
                    <p className="mb-2">Welcome to Simplicity Mission Control</p>
                    <p className="text-sm">Type <span className="text-teal-400">help</span> for available commands</p>
                  </div>
                )}

                {/* Command History */}
                {commandHistory.map((entry) => (
                  <div key={entry.id} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-teal-500">→</span>
                      <span className="text-zinc-300">{entry.command}</span>
                    </div>
                    <pre className={`text-sm pl-4 whitespace-pre-wrap ${
                      entry.status === 'error' ? 'text-red-400' : 'text-zinc-400'
                    }`}>
                      {entry.output}
                    </pre>
                  </div>
                ))}
              </div>

              {/* Command Input */}
              <div className="border-t border-zinc-800 p-4 bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <span className="text-teal-500 font-bold">→</span>
                  <input
                    ref={commandInputRef}
                    type="text"
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && commandInput.trim()) {
                        processCommand(commandInput)
                      }
                    }}
                    placeholder="Enter command... (try 'help' or 'schedule')"
                    className="flex-1 bg-transparent outline-none text-zinc-100 placeholder:text-zinc-600"
                    autoFocus
                  />
                  <kbd className="text-xs text-zinc-600 bg-zinc-800 px-2 py-1 rounded">⌘K to focus</kbd>
                </div>
              </div>
            </div>
          )}

          {/* ===== SCHEDULE STATION ===== */}
          {activeStation === 'schedule' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Header with Week Navigation */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Weekly Schedule</h2>
                  <p className="text-sm text-zinc-500">Plan your days, avoid conflicts</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      const newStart = new Date(currentWeekStart)
                      newStart.setDate(newStart.getDate() - 7)
                      setCurrentWeekStart(newStart)
                    }}
                    className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="text-sm font-medium">
                    {currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => {
                      const newStart = new Date(currentWeekStart)
                      newStart.setDate(newStart.getDate() + 7)
                      setCurrentWeekStart(newStart)
                    }}
                    className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                  <button
                    onClick={() => setCurrentWeekStart(getStartOfWeek(new Date()))}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
                  >
                    Today
                  </button>
                </div>
              </div>

              {/* Week View Grid */}
              <div className="grid grid-cols-7 gap-3">
                {getWeekDays(currentWeekStart).map(day => {
                  const dateStr = formatDate(day)
                  const isToday = dateStr === formatDate(new Date())
                  const dayEvents = scheduleEvents
                    .filter(e => e.date === dateStr)
                    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))

                  return (
                    <div
                      key={dateStr}
                      className={`bg-zinc-900 border rounded-lg overflow-hidden ${
                        isToday ? 'border-teal-500' : 'border-zinc-800'
                      }`}
                    >
                      {/* Day Header */}
                      <div className={`p-3 border-b ${isToday ? 'bg-teal-500/10 border-teal-500/30' : 'border-zinc-800'}`}>
                        <p className="text-xs text-zinc-500 uppercase">{getDayName(day).slice(0, 3)}</p>
                        <p className={`text-lg font-bold ${isToday ? 'text-teal-400' : 'text-zinc-100'}`}>
                          {day.getDate()}
                        </p>
                      </div>

                      {/* Events List */}
                      <div className="p-2 space-y-2 min-h-[200px]">
                        {dayEvents.map(event => (
                          <div
                            key={event.id}
                            className={`p-2 rounded border text-xs ${getCategoryColor(event.category)} ${
                              event.completed ? 'opacity-50' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <div className="flex items-center gap-1">
                                <Clock size={10} />
                                <span className="font-medium">{event.startTime}</span>
                              </div>
                              <button
                                onClick={() => toggleEventComplete(event.id)}
                                className="text-zinc-400 hover:text-zinc-100"
                              >
                                {event.completed ? <Check size={12} /> : <span className="w-3 h-3 border border-current rounded" />}
                              </button>
                            </div>
                            <p className="font-medium mb-1 line-clamp-2">{event.title}</p>
                            <div className="flex items-center justify-between text-[10px] opacity-70">
                              <span>{event.duration}min</span>
                              <button
                                onClick={() => deleteEvent(event.id)}
                                className="hover:text-red-400"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Add Event Button */}
                        <button
                          onClick={() => {
                            setSelectedDate(dateStr)
                            setShowNewEvent(true)
                          }}
                          className="w-full p-2 border border-dashed border-zinc-700 hover:border-teal-500 hover:bg-teal-500/5 rounded flex items-center justify-center gap-1 text-xs text-zinc-500 hover:text-teal-400 transition-colors"
                        >
                          <Plus size={12} />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Today's Summary */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Clock size={18} className="text-teal-500" />
                  Today's Summary
                </h3>
                {(() => {
                  const today = formatDate(new Date())
                  const todayEvents = scheduleEvents
                    .filter(e => e.date === today)
                    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
                  
                  if (todayEvents.length === 0) {
                    return <p className="text-zinc-500 text-sm">No events scheduled for today</p>
                  }

                  return (
                    <div className="space-y-2">
                      {todayEvents.map(event => (
                        <div
                          key={event.id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${getCategoryColor(event.category)} ${
                            event.completed ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleEventComplete(event.id)}
                              className="flex-shrink-0"
                            >
                              {event.completed ? (
                                <Check size={18} className="text-current" />
                              ) : (
                                <span className="w-5 h-5 border-2 border-current rounded" />
                              )}
                            </button>
                            <div>
                              <p className={`font-medium ${event.completed ? 'line-through' : ''}`}>
                                {event.title}
                              </p>
                              {event.description && (
                                <p className="text-xs opacity-70 mt-1">{event.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div>
                              <p className="text-sm font-mono">{event.startTime}</p>
                              <p className="text-xs opacity-70">{event.duration}min</p>
                            </div>
                            <button
                              onClick={() => deleteEvent(event.id)}
                              className="text-zinc-500 hover:text-red-400 transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {/* ===== FOCUS STATION ===== */}
          {activeStation === 'focus' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              {!focusSession ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="max-w-md w-full space-y-6"
                >
                  <div className="text-center">
                    <Target size={48} className="text-teal-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Start Focus Session</h2>
                    <p className="text-zinc-500">25 minutes of deep work. No distractions.</p>
                  </div>

                  <div className="space-y-4">
                    <input
                      type="text"
                      value={focusInput.task}
                      onChange={(e) => setFocusInput(prev => ({ ...prev, task: e.target.value }))}
                      placeholder="What are you working on?"
                      className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg outline-none focus:border-teal-500 transition-colors"
                    />

                    <select
                      value={focusInput.project}
                      onChange={(e) => setFocusInput(prev => ({ ...prev, project: e.target.value }))}
                      className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg outline-none focus:border-teal-500"
                    >
                      <option value="simplicity-web">Simplicity Web</option>
                      <option value="simplicity-desktop">Simplicity Desktop</option>
                      <option value="simplicity-site">SimplicityFunds Site</option>
                    </select>

                    <button
                      onClick={() => {
                        if (!focusInput.task.trim()) return
                        setFocusSession({
                          id: `focus-${Date.now()}`,
                          task: focusInput.task,
                          project: focusInput.project,
                          startedAt: Date.now(),
                          duration: 25,
                          completedPomodoros: 0,
                          notes: [],
                          status: 'active'
                        })
                        setFocusTimeLeft(25 * 60)
                      }}
                      disabled={!focusInput.task.trim()}
                      className="w-full py-4 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      <Play size={20} />
                      Start Focus
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center space-y-8"
                >
                  {/* Timer */}
                  <div className="relative">
                    <div className={`text-[120px] font-bold tabular-nums ${
                      focusSession.status === 'active' ? 'text-teal-400' : 'text-zinc-500'
                    }`}>
                      {formatTime(focusTimeLeft)}
                    </div>
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                      {Array.from({ length: focusSession.completedPomodoros }).map((_, i) => (
                        <Trophy key={i} size={16} className="text-yellow-500" />
                      ))}
                    </div>
                  </div>

                  {/* Task Info */}
                  <div>
                    <p className="text-xl text-zinc-300 mb-2">{focusSession.task}</p>
                    <p className="text-sm text-zinc-500">{focusSession.project}</p>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={() => {
                        setFocusSession(prev => prev ? {
                          ...prev,
                          status: prev.status === 'active' ? 'paused' : 'active'
                        } : null)
                      }}
                      className="w-16 h-16 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
                    >
                      {focusSession.status === 'active' ? <Pause size={28} /> : <Play size={28} />}
                    </button>
                    <button
                      onClick={() => {
                        setFocusSession(null)
                        setFocusTimeLeft(25 * 60)
                      }}
                      className="w-12 h-12 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
                    >
                      <X size={20} />
                    </button>
                    <button
                      onClick={() => setFocusTimeLeft(25 * 60)}
                      className="w-12 h-12 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
                    >
                      <RotateCcw size={20} />
                    </button>
                  </div>

                  {/* Session Stats */}
                  <div className="flex items-center justify-center gap-8 text-sm text-zinc-500">
                    <div>
                      <span className="text-zinc-400">Started: </span>
                      {new Date(focusSession.startedAt).toLocaleTimeString()}
                    </div>
                    <div>
                      <span className="text-zinc-400">Pomodoros: </span>
                      {focusSession.completedPomodoros}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* ===== DECISIONS STATION ===== */}
          {activeStation === 'decisions' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Decision Journal</h2>
                  <p className="text-sm text-zinc-500">Architecture decisions and their reasoning</p>
                </div>
                <button
                  onClick={() => setShowNewDecision(true)}
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Plus size={18} />
                  New Decision
                </button>
              </div>

              {/* Decision Cards */}
              <div className="space-y-4">
                {decisions.map((dec) => (
                  <motion.div
                    key={dec.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-lg text-zinc-100">{dec.title}</h3>
                        <p className="text-sm text-zinc-500 mt-1">
                          {new Date(dec.timestamp).toLocaleDateString()} • {dec.project}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {dec.tags.map(tag => (
                          <span key={tag} className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-400">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-teal-500 uppercase tracking-wider mb-1">Context</p>
                        <p className="text-zinc-300 text-sm">{dec.context}</p>
                      </div>

                      <div>
                        <p className="text-xs text-teal-500 uppercase tracking-wider mb-1">Decision</p>
                        <p className="text-zinc-100 font-medium">{dec.decision}</p>
                      </div>

                      {dec.alternatives.length > 0 && (
                        <div>
                          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Alternatives Considered</p>
                          <ul className="list-disc list-inside text-sm text-zinc-400">
                            {dec.alternatives.map((alt, i) => (
                              <li key={i}>{alt}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Reasoning</p>
                        <p className="text-zinc-400 text-sm">{dec.reasoning}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* ===== PATTERNS STATION ===== */}
          {activeStation === 'patterns' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Code Pattern Library</h2>
                  <p className="text-sm text-zinc-500">Reusable solutions across projects</p>
                </div>
                <button
                  onClick={() => setShowNewPattern(true)}
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Plus size={18} />
                  New Pattern
                </button>
              </div>

              {/* Pattern Cards */}
              <div className="grid grid-cols-1 gap-4">
                {patterns.map((pattern) => (
                  <motion.div
                    key={pattern.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
                  >
                    <div className="p-4 border-b border-zinc-800 flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-zinc-100">{pattern.title}</h3>
                        <p className="text-sm text-zinc-500 mt-1">{pattern.description}</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(pattern.code, pattern.id)}
                        className="p-2 hover:bg-zinc-800 rounded transition-colors"
                      >
                        {copiedId === pattern.id ? (
                          <Check size={18} className="text-green-400" />
                        ) : (
                          <Copy size={18} className="text-zinc-400" />
                        )}
                      </button>
                    </div>
                    <pre className="p-4 text-sm overflow-x-auto bg-black/30">
                      <code className="text-zinc-300">{pattern.code}</code>
                    </pre>
                    <div className="p-3 border-t border-zinc-800 flex items-center gap-2">
                      <span className="text-xs text-zinc-500">{pattern.language}</span>
                      <span className="text-zinc-700">•</span>
                      {pattern.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* ===== RESOURCES STATION ===== */}
{activeStation === 'resources' && (
  <ResourcesStation resources={resources} setResources={setResources} />
)}

          {/* ===== WAR ROOM (YC) =====  */}
          {activeStation === 'warroom' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="text-center border-b border-zinc-800 pb-6">
                <Flame size={48} className="text-orange-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold">YC W26 War Room</h2>
                <p className="text-zinc-500">Everything you need to nail this application</p>
              </div>

              {/* Countdown */}
              <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-lg p-6 text-center">
                <p className="text-sm text-orange-400 uppercase tracking-wider mb-2">Application Deadline</p>
                <p className="text-4xl font-bold text-orange-400">~45 days</p>
              </div>

              {/* Checklist */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <CheckCircle size={20} className="text-teal-500" />
                  Application Checklist
                </h3>
                <div className="space-y-3">
                  {[
                    { done: true, item: 'Company one-liner', notes: 'Intention-first budgeting for the 78% who fail at traditional methods' },
                    { done: true, item: 'Problem statement', notes: 'Traditional budgeting apps focus on tracking, not behavior change' },
                    { done: true, item: 'Solution description', notes: 'Set intentions before spending, AI coaching, friction-based design' },
                    { done: false, item: 'Demo video (1 min)', notes: 'Show: Bank connect → Set intention → Smart nudge flow' },
                    { done: false, item: 'Founder intro video', notes: 'Personal story, why this problem, what makes you the one to solve it' },
                    { done: true, item: 'Market validation', notes: '1000+ survey responses, 40+ interviews' },
                    { done: true, item: 'Traction metrics', notes: 'Beta signups, engagement data, NPS scores' },
                    { done: false, item: 'Technical architecture doc', notes: 'Next.js, Supabase, Plaid, Stripe stack overview' },
                  ].map((check, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors">
                      <div className={`mt-0.5 ${check.done ? 'text-green-500' : 'text-zinc-600'}`}>
                        {check.done ? <CheckCircle size={18} /> : <ShieldAlert size={18} />}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${check.done ? 'text-zinc-400 line-through' : 'text-zinc-200'}`}>
                          {check.item}
                        </p>
                        <p className="text-sm text-zinc-500 mt-1">{check.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Metrics to Highlight */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <TrendingUp size={20} className="text-teal-500" />
                  Key Metrics to Highlight
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Survey Responses', value: '1,000+' },
                    { label: 'User Interviews', value: '40+' },
                    { label: 'Beta Signups', value: '127' },
                    { label: 'Weekly Hours', value: '60-80' },
                  ].map((metric, i) => (
                    <div key={i} className="bg-zinc-800/50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-teal-400">{metric.value}</p>
                      <p className="text-xs text-zinc-500 mt-1">{metric.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interview Prep */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <MessageSquare size={20} className="text-teal-500" />
                  Interview Talking Points
                </h3>
                <div className="space-y-4">
                  {[
                    { q: 'Why this problem?', a: 'Personal experience with budgeting failures. 78% of people fail at traditional budgeting because it focuses on restriction, not intention.' },
                    { q: 'What makes you different?', a: 'Intention-first approach. You set WHY before you spend. AI coaching. Friction design to break autopilot spending.' },
                    { q: 'Why now?', a: 'Open banking APIs (Plaid) make real-time bank data accessible. AI can now provide personalized coaching at scale. Economic uncertainty driving demand for financial tools.' },
                    { q: 'Why you?', a: '8 years self-taught dev. Built and shipped multiple products. Obsessed with this problem - working 60-80 hours/week while in school.' },
                  ].map((item, i) => (
                    <div key={i} className="p-3 rounded-lg bg-zinc-800/30">
                      <p className="font-medium text-orange-400">{item.q}</p>
                      <p className="text-sm text-zinc-300 mt-2">{item.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== METRICS STATION ===== */}
          {activeStation === 'metrics' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <h2 className="text-xl font-bold">Key Metrics Dashboard</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Validation Metrics */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                  <h3 className="font-bold text-zinc-400 text-sm uppercase tracking-wider mb-4">Validation</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-3xl font-bold text-teal-400">1,000+</p>
                      <p className="text-sm text-zinc-500">Survey Responses</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-teal-400">40+</p>
                      <p className="text-sm text-zinc-500">User Interviews</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-teal-400">127</p>
                      <p className="text-sm text-zinc-500">Beta Signups</p>
                    </div>
                  </div>
                </div>

                {/* Development Metrics */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                  <h3 className="font-bold text-zinc-400 text-sm uppercase tracking-wider mb-4">Development</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-3xl font-bold text-blue-400">84</p>
                      <p className="text-sm text-zinc-500">React Components</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-blue-400">~45k</p>
                      <p className="text-sm text-zinc-500">Lines of Code</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-blue-400">60%</p>
                      <p className="text-sm text-zinc-500">Web Migration Complete</p>
                    </div>
                  </div>
                </div>

                {/* Founder Metrics */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                  <h3 className="font-bold text-zinc-400 text-sm uppercase tracking-wider mb-4">Founder</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-3xl font-bold text-purple-400">60-80</p>
                      <p className="text-sm text-zinc-500">Weekly Hours</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-purple-400">8+</p>
                      <p className="text-sm text-zinc-500">Years Coding</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-purple-400">5 AM</p>
                      <p className="text-sm text-zinc-500">Daily Start Time</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bars */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
                <h3 className="font-bold text-zinc-400 text-sm uppercase tracking-wider">Project Progress</h3>
                {[
                  { name: 'Simplicity Web', progress: 60, color: 'bg-teal-500' },
                  { name: 'Simplicity Desktop', progress: 75, color: 'bg-blue-500' },
                  { name: 'Marketing Site', progress: 30, color: 'bg-purple-500' },
                  { name: 'YC Application', progress: 45, color: 'bg-orange-500' },
                ].map((project) => (
                  <div key={project.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-zinc-300">{project.name}</span>
                      <span className="text-zinc-500">{project.progress}%</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${project.color} rounded-full transition-all`}
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* ===== RIGHT SIDEBAR - Quick Captures ===== */}
        <aside className="w-72 border-l border-zinc-800 flex flex-col bg-zinc-900/30">
          <div className="p-4 border-b border-zinc-800">
            <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-400">Quick Captures</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {quickCaptures.length === 0 ? (
              <p className="text-sm text-zinc-600 text-center py-8">
                Press <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs">⌘.</kbd> to capture a thought
              </p>
            ) : (
              quickCaptures.map((capture) => (
                <div
                  key={capture.id}
                  className={`p-3 rounded-lg border ${
                    capture.processed
                      ? 'bg-zinc-900/50 border-zinc-800 opacity-50'
                      : 'bg-zinc-800/50 border-zinc-700'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {getCaptureIcon(capture.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300 break-words">{capture.content}</p>
                      <p className="text-xs text-zinc-600 mt-1">
                        {new Date(capture.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setQuickCaptures(prev =>
                          prev.map(c =>
                            c.id === capture.id ? { ...c, processed: !c.processed } : c
                          )
                        )
                      }}
                      className="text-zinc-600 hover:text-zinc-400"
                    >
                      {capture.processed ? <RotateCcw size={14} /> : <Check size={14} />}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* ===== MODALS ===== */}

      {/* Quick Capture Modal */}
      <AnimatePresence>
        {showCapture && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-32 z-50"
            onClick={() => setShowCapture(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-4">
                <Zap size={20} className="text-yellow-400" />
                <span className="font-bold">Quick Capture</span>
              </div>
              
              <div className="flex gap-2 mb-3">
                {(['thought', 'bug', 'idea', 'todo', 'blocker'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setCaptureType(type)}
                    className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
                      captureType === type
                        ? 'bg-teal-500/20 text-teal-400 border border-teal-500/50'
                        : 'bg-zinc-800 text-zinc-400 border border-transparent hover:bg-zinc-700'
                    }`}
                  >
                    {getCaptureIcon(type)}
                    <span className="capitalize">{type}</span>
                  </button>
                ))}
              </div>
              
              <textarea
                value={captureInput}
                onChange={(e) => setCaptureInput(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500 resize-none"
                rows={3}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleQuickCapture()
                  }
                }}
              />
              
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-zinc-600">⌘+Enter to save</span>
                <button
                  onClick={handleQuickCapture}
                  disabled={!captureInput.trim()}
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 rounded-lg font-medium transition-colors"
                >
                  Capture
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Event Modal */}
      <AnimatePresence>
        {showNewEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowNewEvent(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Plus size={20} />
                Add Event - {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </h3>
              
              <div className="space-y-4">
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Event title"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500"
                />
                
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Description (optional)"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500 resize-none"
                  rows={2}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Start Time</label>
                    <input
                      type="time"
                      value={newEvent.startTime}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, startTime: e.target.value }))}
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Duration (min)</label>
                    <input
                      type="number"
                      value={newEvent.duration}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                      min={15}
                      step={15}
                      className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Category</label>
                  <select
                    value={newEvent.category}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, category: e.target.value as ScheduleEvent['category'] }))}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500"
                  >
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="meeting">Meeting</option>
                    <option value="gym">Gym</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowNewEvent(false)}
                  className="px-4 py-2 text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddEvent}
                  disabled={!newEvent.title.trim()}
                  className="px-6 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 rounded-lg font-medium transition-colors"
                >
                  Add Event
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Decision Modal */}
      <AnimatePresence>
        {showNewDecision && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowNewDecision(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4">Record Decision</h3>
              
              <div className="space-y-4">
                <input
                  type="text"
                  value={newDecision.title}
                  onChange={(e) => setNewDecision(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Decision Title"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500"
                />
                
                <textarea
                  value={newDecision.context}
                  onChange={(e) => setNewDecision(prev => ({ ...prev, context: e.target.value }))}
                  placeholder="Context - What situation led to this decision?"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500 resize-none"
                  rows={3}
                />
                
                <textarea
                  value={newDecision.decision}
                  onChange={(e) => setNewDecision(prev => ({ ...prev, decision: e.target.value }))}
                  placeholder="The Decision - What did you decide?"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500 resize-none"
                  rows={2}
                />
                
                <textarea
                  value={newDecision.alternatives}
                  onChange={(e) => setNewDecision(prev => ({ ...prev, alternatives: e.target.value }))}
                  placeholder="Alternatives Considered (one per line)"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500 resize-none"
                  rows={3}
                />
                
                <textarea
                  value={newDecision.reasoning}
                  onChange={(e) => setNewDecision(prev => ({ ...prev, reasoning: e.target.value }))}
                  placeholder="Reasoning - Why this choice?"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500 resize-none"
                  rows={3}
                />
                
                <div className="flex gap-4">
                  <select
                    value={newDecision.project}
                    onChange={(e) => setNewDecision(prev => ({ ...prev, project: e.target.value }))}
                    className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500"
                  >
                    <option value="simplicity-web">Simplicity Web</option>
                    <option value="simplicity-desktop">Simplicity Desktop</option>
                    <option value="simplicity-site">SimplicityFunds Site</option>
                    <option value="business">Business Strategy</option>
                  </select>
                  
                  <input
                    type="text"
                    value={newDecision.tags}
                    onChange={(e) => setNewDecision(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="Tags (comma separated)"
                    className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowNewDecision(false)}
                  className="px-4 py-2 text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddDecision}
                  disabled={!newDecision.title.trim() || !newDecision.decision.trim()}
                  className="px-6 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 rounded-lg font-medium transition-colors"
                >
                  Save Decision
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Pattern Modal */}
      <AnimatePresence>
        {showNewPattern && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowNewPattern(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4">Add Code Pattern</h3>
              
              <div className="space-y-4">
                <input
                  type="text"
                  value={newPattern.title}
                  onChange={(e) => setNewPattern(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Pattern Title"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500"
                />
                
                <input
                  type="text"
                  value={newPattern.description}
                  onChange={(e) => setNewPattern(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500"
                />
                
                <textarea
                  value={newPattern.code}
                  onChange={(e) => setNewPattern(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="// Paste your code here"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500 resize-none font-mono text-sm"
                  rows={12}
                />
                
                <div className="flex gap-4">
                  <select
                    value={newPattern.language}
                    onChange={(e) => setNewPattern(prev => ({ ...prev, language: e.target.value }))}
                    className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500"
                  >
                    <option value="typescript">TypeScript</option>
                    <option value="javascript">JavaScript</option>
                    <option value="css">CSS</option>
                    <option value="sql">SQL</option>
                    <option value="bash">Bash</option>
                  </select>
                  
                  <input
                    type="text"
                    value={newPattern.tags}
                    onChange={(e) => setNewPattern(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="Tags (comma separated)"
                    className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg outline-none focus:border-teal-500"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowNewPattern(false)}
                  className="px-4 py-2 text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPattern}
                  disabled={!newPattern.title.trim() || !newPattern.code.trim()}
                  className="px-6 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 rounded-lg font-medium transition-colors"
                >
                  Save Pattern
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default SimplicityMissionControl

export const Route = createLazyFileRoute('/budgetary')({
  component: SimplicityMissionControl,
})