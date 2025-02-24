// types/taskTypes.ts

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'to-do' | 'in-progress' | 'done';

export interface TaskComment {
  id: number;
  user: string;
  content: string;
  timestamp: string;
}

export interface TaskBlocker {
  id: number;
  description: string;
  severity: 'critical' | 'moderate' | 'minor';
  status: 'active' | 'resolved';
}

export interface TaskDependency {
  id: number;
  taskId: number;
  taskTitle: string;
  type: 'blocks' | 'blocked-by' | 'related';
}

export interface Task {
  id: number;
  title: string;
  priority: TaskPriority;
  dueDate: string;
  description: string;
  detailedDescription?: string;
  vision?: string;
  assignee: string;
  status: TaskStatus;
  progress: number;
  comments: TaskComment[];
  blockers: TaskBlocker[];
  dependencies: TaskDependency[];
  technicalNotes?: string;
  lastUpdated: string;
  watchers: string[];
  tags: string[];
  estimatedTime?: string;
  timeSpent?: string;
}

// Sample task data
export const tasks: Task[] = [
  {
    id: 1,
    title: 'work on clerk auth 1',
    priority: 'high',
    dueDate: '2023-10-01',
    description: 'Implement authentication flow using Clerk',
    detailedDescription: 'Complete implementation of Clerk authentication including OAuth providers and role-based access control.',
    vision: 'Create a secure and seamless authentication experience',
    assignee: 'Ali',
    status: 'to-do',
    progress: 20,
    comments: [
      { id: 1, user: 'Ali', content: 'Started working on OAuth implementation', timestamp: '2024-02-23 10:30 AM' }
    ],
    blockers: [
      { id: 1, description: 'Awaiting API keys from Clerk', severity: 'critical', status: 'active' }
    ],
    dependencies: [
      { id: 1, taskId: 2, taskTitle: 'Setup environment variables', type: 'blocked-by' }
    ],
    lastUpdated: '2024-02-23',
    watchers: ['Ali', 'Team'],
    tags: ['auth', 'security'],
    estimatedTime: '3 days',
    timeSpent: '1 day'
  },
  {
    id: 2,
    title: 'fix the budgetary savings goal',
    priority: 'medium',
    dueDate: '2023-10-05',
    description: 'Review and fix savings calculation logic',
    detailedDescription: 'Investigate and resolve issues with savings goal calculations in the financial planning module',
    vision: 'Ensure accurate financial projections for users',
    assignee: 'Team',
    status: 'in-progress',
    progress: 60,
    comments: [
      { id: 2, user: 'Team', content: 'Found the calculation bug, working on fix', timestamp: '2024-02-23 11:45 AM' }
    ],
    blockers: [],
    dependencies: [],
    lastUpdated: '2024-02-23',
    watchers: ['Team', 'Ali'],
    tags: ['finance', 'bugfix'],
    estimatedTime: '2 days',
    timeSpent: '1 day'
  },
  {
    id: 3,
    title: 'fix the navigation bar',
    priority: 'low',
    dueDate: '2023-10-10',
    description: 'Improve mobile responsiveness',
    detailedDescription: 'Enhance navigation bar behavior on mobile devices and fix overflow issues',
    assignee: 'Ali',
    status: 'done',
    progress: 100,
    comments: [],
    blockers: [],
    dependencies: [],
    lastUpdated: '2024-02-22',
    watchers: ['Ali'],
    tags: ['ui', 'mobile'],
    estimatedTime: '1 day',
    timeSpent: '1 day'
  },
  {
    id: 4,
    title: 'implement new auth flow',
    priority: 'high',
    dueDate: '2023-10-10',
    description: 'Design and implement new authentication system',
    detailedDescription: 'Create a new authentication flow with improved security and user experience',
    vision: 'Streamline the login process while maintaining security',
    assignee: 'Team',
    status: 'to-do',
    progress: 0,
    comments: [],
    blockers: [
      { id: 2, description: 'Security audit pending', severity: 'moderate', status: 'active' }
    ],
    dependencies: [
      { id: 2, taskId: 1, taskTitle: 'Clerk Auth Integration', type: 'blocks' }
    ],
    lastUpdated: '2024-02-21',
    watchers: ['Team', 'Ali'],
    tags: ['auth', 'security', 'ux'],
    estimatedTime: '5 days',
    timeSpent: '0 days'
  },
  {
    id: 5,
    title: 'update user document',
    priority: 'medium',
    dueDate: '2023-10-10',
    description: 'Update API documentation for users',
    assignee: 'Ali',
    status: 'in-progress',
    progress: 45,
    comments: [],
    blockers: [],
    dependencies: [],
    lastUpdated: '2024-02-20',
    watchers: ['Ali'],
    tags: ['documentation', 'api'],
    estimatedTime: '3 days',
    timeSpent: '1.5 days'
  }
  // Add more tasks as needed...
];