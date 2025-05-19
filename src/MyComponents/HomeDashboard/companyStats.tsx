import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, CircleDollarSign, BarChart3, Boxes, DollarSign, File, FolderCode } from "lucide-react";
import supabase from "../supabase";
import UserView, { Role } from "../Reusables/userView";
import { ActiveUser } from "@/stores/query";

// Enhanced Stat Card with animations
const StatCard = ({
  icon: Icon,
  label,
  value,
  change,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  change?: number;
}) => (
  <motion.div
    whileHover={{ scale: 1.0 }}
    className="bg-black/40 border border-red-900/30 rounded-lg p-4 hover:border-red-800/50 transition-colors"
  >
    <div className="flex items-center justify-between">
      <motion.div
        whileHover={{ scale: 1.1 }}
        className="p-2 rounded-lg bg-red-900/20"
      >
        <Icon className="h-4 w-4 text-red-500" />
      </motion.div>
      {change && (
        <span
          className={`text-xs ${change > 0 ? "text-emerald-400" : "text-red-400"}`}
        >
          {change > 0 ? "+" : ""}
          {change}%
        </span>
      )}
    </div>
    <div className="mt-3">
      <div className="text-2xl font-bold text-amber-50">{value}</div>
      <div className="text-sm text-amber-50/70">{label}</div>
    </div>
  </motion.div>
);

const CompanyStats = () => {
  const [initialCapital, setInitialCapital] = useState("");
  const [appUsers, setAppUsers] = useState("");
  const [subscription, setSubscription] = useState("");
  const [expenses, setExpenses] = useState("")
  // accounts
  const [accounts, setAccounts] = useState("")
  
  // Task plus the status of them
  const [totalTasks, setTotalTask] = useState(0)
  const [userTasks, setUserTasks] = useState(0)
  const [completedTasks, setCompletedTasks] = useState(0)
  const [pendingTasks, setPendingTasks] = useState(0)

  // get the current user role from activeUser hook
  const { data: user } = ActiveUser();
  const userRole = user[0].role || Role.Member; // or we default to member if the role is undefined
  
  useEffect(() => {
    async function fetchStats() {

      try{

      // const for accounts
      const { data: credentials, error: credentialsError} = await supabase
        .from("cwa_creds")
        .select("id, folder")
     
      // const for Task
      const { data: allTask, error: taskError } = await supabase
        .from("cwa_todos")
        .select("todo_id, label, status")
        .eq("label", userRole)
      const { data : expense, error : expenseError} = await supabase
        .from("cwa_expenses")
        .select("amount")

      const { data: revenue, error: revenueError } = await supabase
        .from("cwa_calculatorProps")
        .select("initialCapital")
        .single();

      const { data: userCount, error: userCountError } = await supabase
        .from("app_users")
        .select("id");

      const { data: subscriptions, error: subscriptionError } = await supabase
        .from("cwa_revenues")
        .select("amount")
        .eq("revenueType", "subscription");

      
      if ( credentialsError )
      {
        console.log("There was an error retrieving credential data from supabase", credentialsError.message)
      }
      if( taskError)
      {
        console.log("There was an error with fetching tasks", taskError.message);
      }
      if (revenueError)
        console.log(
          "there was an error grabbing the initialCapital",
          revenueError.message
        );

      if (userCountError)
        console.log(
          "could not count the users within the database to vsCode",
          userCountError.message
        );

      if (subscriptionError)
        console.log(
          "Error fetching subscription stat",
          subscriptionError.message
        );

      if ( expenseError ) console.log("There was an error retrieving the expenses from the database", expenseError.message)
      
      var totalExpense = 0
      if (expense!.length) 
      {
        totalExpense =  expense!.reduce((total, expenses) => {
          return total - (expenses.amount || 0);
        }, 0)
      }

      var totSubs = 0;
      if (subscriptions!.length) {
        totSubs = subscriptions!.reduce((total, subscription) => {
          return total + (subscription.amount || 0);
        }, 0);
      }
    
      // Need to assing the roles based on your role
      if(allTask)
      {
        // for later 
        const total = allTask.length;

        // Filter tasks assigned to current user's role
        // The label field might store the enum value (like "CEO") rather than the key
        const userRoleTasks = allTask.filter(task => task.label === userRole).length

        // count the completedd aand pending tasks for the user roles
        // might changee allTask.filter to userRoleTask.filter
        const completed = allTask.filter(task => task.status === "done").length
        const pending = allTask.filter(task => task.status === "in-progress" ).length


        // set task status
        setTotalTask(total );
        setUserTasks(userRoleTasks  );
        setCompletedTasks(completed  );
        setPendingTasks(pending );
       
      }

      // conditional statement for defaault and ccc
      if( credentials )
      {
        // filter creds by folder type based on role
        var accountsToShow = 0;

        if(userRole === Role.CEO)
        {
          // all accounts seen by these twwo roles
          accountsToShow = credentials.length;
        } else if (userRole === Role.AccManager || userRole === Role.COO) {
          accountsToShow = credentials.filter(cred => cred.folder === "default").length;
        } else {
          accountsToShow = 0;
        }

        setAccounts(accountsToShow.toString());
      }

   
      // accounts
      // setTotalTask(userTasks?.length as unknown as string)
      setInitialCapital(revenue?.initialCapital);
      setAppUsers(userCount!.length as unknown as string);
      setSubscription(totSubs.toFixed(2));
      setExpenses(totalExpense.toFixed(2))
    }
      catch (error) {
      console.error ("Error fetching error stats in index.lazy", error)
     }
    // Stat();
  }
  fetchStats();
}, [userRole]);

console.log({ accounts })
  return (
    <>
      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard icon={Users} label="Total Users" value={appUsers} />

        {/* Can either link up actual bank account or calc how much money there is on bank acc */}
        <StatCard
          icon={CircleDollarSign}
          label="Bank"
          value={`$${initialCapital}`}
        />
        {/* Can make it so it shows actual revenue ( income - expenses ) */}
        <StatCard
          icon={BarChart3}
          label="Subscription Income"
          value={`$${subscription}`}
        />
        <StatCard icon={DollarSign} label="Expenses" value={`$${expenses}`} />
        {/* <StatCard icon={Boxes} label="Active Bots" value="1" /> */}

        {/* NON-CEO/COO Eyes */}
        {/* Task */} 
        {/* # of Accounts for account manager */}
        {/*  */}
        <StatCard 
        label="Tasks"
        icon={File}
        // total - completed
        value={  ( userTasks - completedTasks )  }
        />

        <UserView userRole={[Role.CEO || Role.COO || Role.AccManager]}>

            <StatCard 
              label="Accounts"
              value={accounts}
              icon={FolderCode}
            />
        </UserView>
      </motion.div>
    </>
  );
};

export default CompanyStats;
