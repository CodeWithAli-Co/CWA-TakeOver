import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/shadcnComponents/card'
import { Input } from '@/components/ui/shadcnComponents/input'
import { Dialog, DialogTrigger } from '@radix-ui/react-dialog'
import { ScrollArea } from '@radix-ui/react-scroll-area'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Target } from 'lucide-react'
import { QuotaFormDialog, QuotaItem } from '../WeeklyQuota'
import supabase from '../supabase'
import { ActiveUser } from '@/stores/query'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/shadcnComponents/button'


const Quotas = () => {
  const [quotas, setQuotas] =  useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuota, setEditingQuota] = useState<any | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedWeek, setSelectedWeek]  = useState<Date>(new Date());

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

  // filter quotas based on search query
  const filteredQuotas = quotas.filter(quota => 
    quota.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (quota.description && quota.description.toLowerCase().includes(searchQuery.toLowerCase()) )
  );


  // stats ( we loves some stats ;) 
  const totalQuotas = quotas.length;
  const completedQuotas = quotas.filter(q => q.status === 'completed').length;
  const pendingQuotas = quotas.filter(q => q.status==='pending').length;
  const inProgressQuotas = quotas.filter(q => q.status  === "in-progress").length;

  return (
    <Card className="bg-black/40 border-red-900/30 col-span-2">
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

      <ScrollArea className="h-[500px] pr-4 overflow-y-auto">
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
              <h3 className="text-lg font-medium mb-2">No quotas for this week</h3>
              <p className="text-sm text-center max-w-md">
                Start by adding your weekly goals and targets to track your progress.
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
  )
}

export default Quotas