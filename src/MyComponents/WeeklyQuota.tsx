import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/shadcnComponents/card";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import { Button } from "@/components/ui/shadcnComponents/button";
import { Input } from "@/components/ui/shadcnComponents/input";
import { Textarea } from "@/components/ui/shadcnComponents/textarea";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { CheckCircle, Edit, Plus, Calendar, Target, Trash } from "lucide-react";
import { ActiveUser } from "@/stores/query";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/shadcnComponents/dialog";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/shadcnComponents/select";
import supabase from "@/MyComponents/supabase";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/shadcnComponents/tabs";

// Weekly QuotasItems 
type QuotaStatus = 'pending' | 'in-progress' | 'completed';

export const QuotaItem =  ({
  quota, 
  onStatusChange,
  onDelete,
  onEdit
} : {
  quota: { id: number; status: QuotaStatus; title: string; description?: string; deadline?: string },
  onStatusChange : (id: number, status: string) => void,
  onDelete : (id: number) => void,
  onEdit : (quota : any) => void
})  => {
  const statusColors: Record<QuotaStatus, string> = {
    pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "in-progress": "bg-blue-500/20 text-blue-400 border-blue-500/30",
    completed : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
  };

return ( 
  <motion.div
  initial={{ opacity: 0, y: 10}}
  animate={{ opacity: 1, y: 0}}
  exit={{ opacity: 0, y:-10}}
  className="p-4 rounded-lg border border-red-900/30 bg-black hover:border-red-800/50 mb-3"
  >
  <div className="flex items-start justify-between">
    <div>
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-medium text-amber-50">{quota.title}</h3>
        <Badge variant="outline" className={`${statusColors[quota.status]} text-xs`}>{quota.status}</Badge>
      </div>
      <p className="text-xs text-amber-50/70 mb-2">{quota.description}</p>
      {quota.deadline && (
        <div className="flex items-start gap-1 text-xs text-amber-50/70">
          <Calendar className="h-3 w-3"/>
          <span>Due: {quota.deadline}</span>
        </div>
      )}
    </div>
    <div className="flex gap-2">
      {quota.status !== "completed" && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95}}
          onClick={() => onStatusChange(quota.id, "completed")}
          className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
        >
          <CheckCircle className="h-4  w-4" />
        </motion.button>
      )}
      <motion.button
        whileHover={{ scale: 1.05}}
        whileTap={{ scale: .95}}
        onClick={() => onEdit(quota)}
        className="p-1  rounded-md  bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
      >
        <Edit className="h-4  w-4" />
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05}}
        whileTap={{ scale: 0.95}}
        onClick={() => onDelete(quota.id)}
      >
        <Trash className="h-4 w-4" />
      </motion.button>
    </div>
  </div>
  
  </motion.div>
);
};

// Add/Edit Quota Dialog

export const QuotaFormDialog = ({
  isOpen,
  onOpenChange,
  onSave,
  editingQuota
}: {
  isOpen: boolean,
  onOpenChange: (open: boolean) =>  void,
  onSave:  (quota: any) => void,
  editingQuota: any | null 
}) => {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState("pending")
  const [deadline, setDeadline] = useState("")

  // this is going to be the reset form when diaalong open/closes or editing quota changes

  useEffect(() => {
    if (isOpen) {
      if(editingQuota) {
        setTitle(editingQuota.title || "")
        setDescription(editingQuota.description || "")
        setStatus(editingQuota.status || "pending")
        setDeadline(editingQuota.deadline || "")
      }else {
        setTitle("")
        setDescription("")
        setStatus("pending")
        setDeadline("")
      }
    }
  }, [isOpen, editingQuota]);


const handleSubmit = (e: any) => {
  e.preventDefault();
  onSave({
    id: editingQuota?.id,
    title,
    status,
    description,
    deadline
  });
  onOpenChange(false);
};

return (
  <DialogContent className='bg-black border-red-900/30 text-amber-50' >
    <DialogHeader>
      <DialogTitle>{editingQuota ? "Edit Quota" : "Add Weekly Quota"}</DialogTitle>  
    </DialogHeader> 
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <label htmlFor="title" className='text-sm font-medium'>Title</label>
          <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter Quota Title"
          className="bg-black/40 border-red-900/30 text-amber-50"
          required
          />
          
        </div>
        <div className="space-y-2">
          <label htmlFor="description" className="text-sm font-medium">Description</label>
          <Textarea id="ddescription" value={description} onChange={(e) => setDescription(e.target.value)} className="bg-black/40 border-red-900/30 text-amber-50" />
        </div>

      <div className="space-y-2">
        <label htmlFor="status" className="text-sm font-medium">Status</label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className='bg-black/40 border-red-900/30 text-amber-50'>
            <SelectValue placeholder="Select status"/>
          </SelectTrigger>
          <SelectContent className='bg-black border-redd-900/30 text-amber-50'>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in-progress">In-progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label htmlFor="deadline" className="text-sm font-medium">Deadline</label>
        <Input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="bg-black/40  bordder-red-900/30 text-amber-50"/>
      </div>

      </div>

      <DialogFooter>
        <Button className="bg-red-900 hover:bg-red-800 text-white" type="submit">
          {editingQuota ? "Update" : "Add"} Quota
        </Button>
      </DialogFooter>
    </form>
  </DialogContent>
  );
};

// Weekly Quotas in main component
// Weekly Quotas in main component
export const WeeklyQuotas = () => {
  const [quotas, setQuotas] =  useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuota, setEditingQuota] = useState<any | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedWeek, setSelectedWeek]  = useState<Date>(new Date());
  // Add state for selected status tab
  const [selectedStatus, setSelectedStatus] = useState<string>("pending");

  // get current useruuu
  const { data: activeUser } = ActiveUser();
  const currentUser = activeUser?.[0];

  // formatting date range for current week 
  const startDate = startOfWeek(selectedWeek, {weekStartsOn: 1}); // Monday will be the starting week
  const endDate = endOfWeek(selectedWeek, {weekStartsOn: 1}) ; // full week rotation back to monday

  // might have to reformat this later on but im lazy so here
  const dateRangeText = `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')} `;

  // obv we gonna make a quotas in the subapase and then we have to load it from supabase

  useEffect(() => {
    const loadQuotas = async () =>{
      if (!currentUser) return;

      // we have to create a 'weekly_quotas' table in supaaaabasee
      const { data, error } = await supabase
        .from('weekly_quotas')
        .select('*') // I lovee the star hehe
        .gte('week_start', format(startDate, 'yyyy-MM-dd')) //again probably gonna have to reformat the date but oh well
        .lte('week_end', format(endDate, 'yyyy-MM-dd'))
        .order('created_at', {ascending: false} );

        if (error) {
          console.error("Error loading Quotas", error)
          return;
        }
        setQuotas(data || [])
    };
    loadQuotas();

    // set up real time subscription 
    // basically This enables a real-time user experience where quota changes (by you or me) instantly appear without needing manual refreshes. So like when someone adds or completes a quota, everyone's dashboard updates immediately.
    const subscription = supabase
    .channel('weekly_quotas_changes')
    .on(
      'postgres_changes',
      { event: '*',  schema: 'public', table:'weekly_quotas'},
      () => loadQuotas()
    )
    .subscribe();
    // The return function is React's useEffect cleanup it'll unsubscribe when the component unmounts
    return () => {
      subscription.unsubscribe(); 
    };

  }, [currentUser, selectedWeek]);


// Handle week navigation
const previousWeek = () => setSelectedWeek(subWeeks(selectedWeek, 1));
const nextWeek = () => setSelectedWeek(addWeeks(selectedWeek, 1));
const currentWeek = () => setSelectedWeek(new Date());

// Handle saving new/edited quota
const handleSaveQuota = async (quotaData : any) => {
  if (!currentUser) return;

  const week_start = format(startDate, 'yyyy-MM-dd');
  const week_end = format(endDate, 'yyyy-MM-dd');
  
  if (quotaData.id) {
    // Update existing quota
    const { error } = await supabase
      .from('weekly_quotas')
      .update({
        title: quotaData.title,
        description: quotaData.description,
        status: quotaData.status,
        deadline: quotaData.deadline,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quotaData.id);

    if (error) console.error('Error updating quota:', error);
  } else {
    // Add new quota
    const { error } = await supabase
      .from('weekly_quotas')
      .insert({
        title: quotaData.title,
        description: quotaData.description,
        status: quotaData.status,
        deadline: quotaData.deadline,
        user_id: currentUser.supa_id,
        week_start,
        week_end,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error) console.error('Error adding quota:', error);
  }
};

// handle status changeey
  const handleStatusChange = async ( id : any, newStatus : any) => {
    const { error } = await supabase
      .from('weekly_quotas')
      .update({
        status: newStatus,
        updated_at : new Date().toISOString(),
      })
      .eq('id', id);

      if ( error ) console.error('Error updating quota status', error)
  };

  // handle delete
  const handleDeleteQuota = async (id:any) => {
    const { error } = await supabase
    .from('weekly_quotas')
    .delete()
    .eq('id', id);

    if(error) console.error('Error deleting quota', error)

  };
  //handle editing
  const handleEditQuota = (quota:any) => {
    setEditingQuota(quota);
    setDialogOpen(true);
  } ;

  // Filter quotas based on search query and selected status tab
  const filteredQuotas = quotas.filter(quota => {
    const matchesSearch = 
      quota.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (quota.description && quota.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = quota.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });


  // stats ( we loves some stats ;) 
  const totalQuotas = quotas.length;
  const completedQuotas = quotas.filter(q => q.status === 'completed').length;
  const pendingQuotas = quotas.filter(q => q.status === 'pending').length;
  const inProgressQuotas = quotas.filter(q => q.status === 'in-progress').length;

  return (
    <div className="min-h-screen bg-black overflow-y-auto">
      {/* Navigation Bar */}
      <nav className="border-b border-red-900/30 bg-black/40 sticky top-0 z-50">
        <div className="flex items-center justify-between h-14 px-6">
          <div className="flex items-center space-x-4">
            <h1 className="bg-gradient-to-r from-red-500 to-red-900 bg-clip-text text-transparent font-bold">
              Weekly Quotas
            </h1>
          </div>
        </div>
      </nav>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-6 space-y-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Statistics Cards */}
          <motion.div whileHover={{ scale: 1.02 }} className="bg-black/40 border border-red-900/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-900/20">
                <Target className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-amber-50/70">Total Quotas</p>
                <h3 className="text-xl font-bold text-amber-50">{totalQuotas}</h3>
              </div>
            </div>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} className="bg-black/40 border border-red-900/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-900/20">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-amber-50/70">Completed</p>
                <h3 className="text-xl font-bold text-amber-50">{completedQuotas}</h3>
              </div>
            </div>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} className="bg-black/40 border border-red-900/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-900/20">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-amber-50/70">In Progress</p>
                <h3 className="text-xl font-bold text-amber-50">{inProgressQuotas}</h3>
              </div>
            </div>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} className="bg-black/40 border border-red-900/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-900/20">
                <Calendar className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-amber-50/70">Pending</p>
                <h3 className="text-xl font-bold text-amber-50">{pendingQuotas}</h3>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Main Quotas Card */}
        <Card className="bg-black/40 border-red-900/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-amber-50">Weekly Quotas</CardTitle>
              <CardDescription className="text-amber-50/70">
                {dateRangeText}
              </CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button 
                onClick={previousWeek} 
                variant="outline" 
                size="sm"
                className="bg-black/40 border-red-900/30 text-amber-50 hover:bg-red-900/20"
              >
                Previous
              </Button>
              <Button 
                onClick={currentWeek} 
                variant="outline" 
                size="sm"
                className="bg-black/40 border-red-900/30 text-amber-50 hover:bg-red-900/20"
              >
                Current
              </Button>
              <Button 
                onClick={nextWeek} 
                variant="outline" 
                size="sm"
                className="bg-black/40 border-red-900/30 text-amber-50 hover:bg-red-900/20"
              >
                Next
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <Input
                placeholder="Search quotas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[300px] bg-black/40 border-red-900/30 text-amber-50"
              />
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={() => setEditingQuota(null)}
                    className="bg-red-900 hover:bg-red-800 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Quota
                  </Button>
                </DialogTrigger>
                <QuotaFormDialog 
                  isOpen={dialogOpen} 
                  onOpenChange={setDialogOpen} 
                  onSave={handleSaveQuota} 
                  editingQuota={editingQuota} 
                />
              </Dialog>
            </div>
            
            <Tabs 
              defaultValue="pending" 
              value={selectedStatus} 
              onValueChange={setSelectedStatus}
              className="mb-4"
            >
              <TabsList className="bg-black/40 border border-red-900/30">
                <TabsTrigger 
                  value="pending" 
                  className="data-[state=active]:bg-red-900/20"
                >
                  Pending ({pendingQuotas})
                </TabsTrigger>
                <TabsTrigger 
                  value="in-progress" 
                  className="data-[state=active]:bg-red-900/20"
                >
                  In Progress ({inProgressQuotas})
                </TabsTrigger>
                <TabsTrigger 
                  value="completed" 
                  className="data-[state=active]:bg-red-900/20"
                >
                  Completed ({completedQuotas})
                </TabsTrigger>
              </TabsList>
            </Tabs>



            <ScrollArea className="h-[500px] pr-4">
              <AnimatePresence>
                {filteredQuotas.length > 0 ? (
                  filteredQuotas.map((quota) => (
                    <QuotaItem
                      key={quota.id}
                      quota={quota}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDeleteQuota}
                      onEdit={handleEditQuota}
                    />
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center p-8 text-amber-50/70"
                  >
                    <Target className="h-12 w-12 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No quotas found</h3>
                    <p className="text-sm text-center max-w-md">
                      {selectedStatus === "all" 
                        ? "Start by adding your weekly goals and targets to track your progress."
                        : `No ${selectedStatus} quotas for this week.`}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </ScrollArea>
          </CardContent>
          <CardFooter className="border-t border-red-900/30 pt-4">
            <p className="text-xs text-amber-50/70">
              Weekly quotas help track team goals and personal targets.
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
};