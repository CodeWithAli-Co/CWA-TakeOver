import { createLazyFileRoute } from "@tanstack/react-router";
import { useAppStore } from "../stores/store";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, UserPlus } from "lucide-react";
import { Employees, Interns } from "@/stores/query";
import supabase from "@/MyComponents/supabase";
import { useEffect, useRef } from "react";
import { EditEmployee } from "@/MyComponents/subForms/editEmploy";
import { AddEmployee } from "@/MyComponents/subForms/addEmploy";

function Employee() {
  const { setDialog, dialog } = useAppStore();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  // Show dialog
  const showModal = () => {
    document.startViewTransition(() => {
      dialogRef.current?.showModal();
    });
    setDialog("shown");
  };

  // Close dialog
  const closeModal = () => {
    document.startViewTransition(() => {
      dialogRef.current?.close();
    });
    setDialog("closed");
  };

  // Close dialog when form is submitted (bc form sets dialog state to 'closed')
  useEffect(() => {
    if (dialog === "closed") {
      document.startViewTransition(() => {
        dialogRef.current?.close();
      });
    }
  }, [dialog]);

  const { displayer, setDisplayer } = useAppStore();
  const { data: employees, refetch: refetchEmployees } = Employees();
  // Added this already for Ali
  const { data: interns, refetch: refetchInterns } = Interns();

  // Realtime channel
  supabase
    .channel("employees-interns")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_users" },
      () => refetchEmployees()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "interns" },
      () => refetchInterns()
    )
    .subscribe();

  // Delete Employee
  const DelEmployee = async (rowID: number) => {
    const { data: result, error } = await supabase
      .from("app_users")
      .delete()
      .eq("id", rowID)
      .select();
    console.log(result);
    if (error) return console.log("Error: ", error.message);
  };

  return (
    <div className="min-h-screen w-full bg-black">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-950 via-red-900 to-red-950 border-b border-red-900/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h3 className="text-2xl text-amber-50 font-light">Users</h3>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs
          defaultValue={displayer}
          onValueChange={(value) => setDisplayer(value)}
          className="w-full"
        >
          <TabsList className="inline-flex bg-red-950/20 rounded-full p-1 gap-1">
            <TabsTrigger
              value="Employees"
              className="rounded-full px-6 py-2 data-[state=active]:bg-red-900 
                       data-[state=active]:text-amber-50 transition-all duration-300"
            >
              Employees
            </TabsTrigger>
            <TabsTrigger
              value="Interns"
              className="rounded-full px-6 py-2 data-[state=active]:bg-red-900 
                       data-[state=active]:text-amber-50 transition-all duration-300"
            >
              Interns
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="mt-8"
            >
              <TabsContent value="Employees">
                {/* Add New Employee Form */}
                {/* <Card className="bg-red-950/10 border-red-900/20 mb-8">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="username" className="text-amber-50/70">
                          Username
                        </Label>
                        <Input
                          id="username"
                          className="bg-black/40 border-red-900/30 text-amber-50 rounded-lg
                                   focus:border-red-500 hover:bg-black/60 transition-colors"
                          placeholder="Enter username"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-amber-50/70">
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          className="bg-black/40 border-red-900/30 text-amber-50 rounded-lg
                                   focus:border-red-500 hover:bg-black/60 transition-colors"
                          placeholder="Enter email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role" className="text-amber-50/70">
                          Role
                        </Label>
                        <Select>
                          <SelectTrigger
                            className="bg-black/40 border-red-900/30 text-amber-50 rounded-lg
                                                  focus:border-red-500 hover:bg-black/60 transition-colors"
                          >
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent className="bg-black text-amber-50 border-red-900/20">
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button className="mt-6 bg-red-900 hover:bg-red-800 text-amber-50">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Employee
                    </Button>
                  </CardContent>
                </Card> */}
                <AddEmployee />

                {/* Employee List */}
                <Card className="bg-red-950/10 border-red-900/20">
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-red-900/20">
                          <TableHead className="text-amber-50/70">
                            Username
                          </TableHead>
                          <TableHead className="text-amber-50/70">
                            Email
                          </TableHead>
                          <TableHead className="text-amber-50/70">
                            Role
                          </TableHead>
                          <TableHead className="text-amber-50/70 text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employees!.map((employee) => (
                          <TableRow
                            key={employee.username}
                            className="border-red-900/20 hover:bg-red-950/30 transition-colors"
                          >
                            <TableCell className="font-medium text-amber-50">
                              {employee.username}
                            </TableCell>
                            <TableCell className="text-amber-50/70">
                              {employee.email}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  employee.role === "admin"
                                    ? "default"
                                    : "secondary"
                                }
                                className={
                                  employee.role === "admin"
                                    ? "bg-red-900 text-amber-50"
                                    : "bg-gray-800 text-amber-50/70"
                                }
                              >
                                {employee.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-red-900/30 hover:bg-red-900/20 text-amber-50"
                                onClick={showModal}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-red-900/30 hover:bg-red-900/20 text-amber-50"
                                onClick={() => DelEmployee(employee.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            <dialog ref={dialogRef}>
                              <button
                                type="button"
                                id="dialog-close2"
                                onClick={() => closeModal()}
                              >
                                X
                              </button>
                              <EditEmployee rowID={employee.id} />
                            </dialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="Interns">
                {/* Similar structure for Interns */}
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  );
}

export const Route = createLazyFileRoute("/employee")({
  component: Employee,
});
