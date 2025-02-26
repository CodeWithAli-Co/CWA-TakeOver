import React from "react";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/shadcnComponents/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/shadcnComponents/accordion";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/shadcnComponents/card";

interface AccountDetails {
  id: string;
  platform: string;
  username: string;
  email: string;
  password: string;
  additionalInfo: string;
  status: boolean;
}

export default function AccountManager() {
  // Example data - in a real app this would come from your backend
  const accounts: AccountDetails[] = [
    {
      id: "1",
      platform: "Patreon",
      username: "username",
      email: "unfold@codewithali.com",
      password: "••••••••",
      additionalInfo: "",
      status: true,
    },
    {
      id: "2",
      platform: "Upwork",
      username: "username",
      email: "unfold@codewithali.com",
      password: "••••••••",
      additionalInfo: "First & Last Name: Ali Alibrahimi",
      status: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Details Page</h1>
          <Button variant="outline">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Data
          </Button>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {accounts.map((account) => (
            <AccordionItem
              key={account.id}
              value={account.id}
              className="border rounded-lg bg-card"
            >
              <AccordionTrigger className="px-4">
                <span className="text-lg font-semibold">
                  Platform: {account.platform}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <Card className="border-0 shadow-none">
                  <CardContent className="space-y-4 p-4">
                    <div className="grid gap-2">
                      <div className="font-medium">Username:</div>
                      <div className="text-muted-foreground">
                        {account.username}
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <div className="font-medium">Email:</div>
                      <div className="text-muted-foreground">
                        {account.email}
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <div className="font-medium">Password:</div>
                      <div className="text-muted-foreground">
                        {account.password}
                      </div>
                    </div>
                    {account.additionalInfo && (
                      <div className="grid gap-2">
                        <div className="font-medium">Additional Info:</div>
                        <div className="text-muted-foreground">
                          {account.additionalInfo}
                        </div>
                      </div>
                    )}
                    <div className="grid gap-2">
                      <div className="font-medium">Status:</div>
                      <div className="text-muted-foreground">
                        {account.status ? "Active" : "Inactive"}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="grid grid-cols-3 gap-2 p-4">
                    <Button variant="outline" className="w-full">
                      Reveal Pass
                    </Button>
                    <Button variant="outline" className="w-full">
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full text-destructive"
                    >
                      Delete
                    </Button>
                  </CardFooter>
                </Card>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
