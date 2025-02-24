import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { TaskPriority, TaskStatus, Task } from './taskTypes';

interface CreateTaskModalProps {
  onTaskCreated: (task: Task) => void;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ onTaskCreated }) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as TaskPriority,
    assignee: '',
    estimatedTime: '',
  });

  const handleSubmit = () => {
    const newTask: Task = {
      id: Date.now(), // Simple ID generation
      title: formData.title,
      description: formData.description,
      priority: formData.priority,
      dueDate: new Date().toISOString().split('T')[0],
      assignee: formData.assignee,
      status: 'todo' as TaskStatus,
      progress: 0,
      comments: [],
      blockers: [],
      dependencies: [],
      lastUpdated: new Date().toISOString(),
      watchers: [formData.assignee],
      tags: [],
      estimatedTime: formData.estimatedTime,
      timeSpent: '0 days'
    };

    onTaskCreated(newTask);
    setOpen(false);
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      assignee: '',
      estimatedTime: '',
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          className="bg-gradient-to-r from-red-950 to-red-900 hover:from-red-900 hover:to-red-800
                   text-white border border-red-800/30 shadow-lg shadow-red-950/20"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Create Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-black/95 border-red-950/30">
        <DialogHeader>
          <DialogTitle className="text-red-200">Create New Task</DialogTitle>
          <DialogDescription className="text-red-200/60">
            Add a new task to your project. Fill in the task details below.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title" className="text-red-200">Title</Label>
            <Input
              id="title"
              placeholder="Task title"
              className="bg-black/40 border-red-950/30 text-red-200"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description" className="text-red-200">Description</Label>
            <Textarea
              id="description"
              placeholder="Task description"
              className="bg-black/40 border-red-950/30 text-red-200 min-h-[100px]"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="priority" className="text-red-200">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: TaskPriority) => 
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger 
                  className="bg-black/40 border-red-950/30 text-red-200"
                >
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent className="bg-black/95 border-red-950/30">
                  <SelectItem value="high" className="text-red-200">High</SelectItem>
                  <SelectItem value="medium" className="text-red-200">Medium</SelectItem>
                  <SelectItem value="low" className="text-red-200">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assignee" className="text-red-200">Assignee</Label>
              <Input
                id="assignee"
                placeholder="Assignee name"
                className="bg-black/40 border-red-950/30 text-red-200"
                value={formData.assignee}
                onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="estimatedTime" className="text-red-200">Estimated Time</Label>
            <Input
              id="estimatedTime"
              placeholder="e.g., 3 days"
              className="bg-black/40 border-red-950/30 text-red-200"
              value={formData.estimatedTime}
              onChange={(e) => setFormData({ ...formData, estimatedTime: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
            className="border-red-800/30 text-red-200 hover:bg-red-950/20 hover:text-red-100"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            className="bg-gradient-to-r from-red-950 to-red-900 hover:from-red-900 hover:to-red-800
                     text-white border border-red-800/30"
            disabled={!formData.title || !formData.description || !formData.assignee}
          >
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskModal;