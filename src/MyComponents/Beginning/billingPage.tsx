

// src/MyComponents/BillingSubscription/StripeBillingPage.tsx
import { useState } from "react";
import { Crown, Check, RefreshCw, Download, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


// import { SensitiveDataManager } from "@/stores/themeStore";

import { useCurrentPlan, useSubscriptionStore } from "@/stores/BillingSubscription/subscriptionStore";
import { formatCurrency } from "@/stores/BillingSubscription/CurrencyFormater";


interface Plan {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  invoiceUrl?: string;
}

const BillingPage = () => {
  // const navigate = useNavigate();
  const currentPlan = useCurrentPlan();
  const { setSubscriptionPlan } = useSubscriptionStore();
  // const { hideSensitiveData } = SensitiveDataManager();
  // const { data: user } = UserDetails();

  const [isLoading, setIsLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const plans: Plan[] = [
    {
      id: "free",
      name: "Free",
      price: 0,
      description: "Perfect for getting started",
      features: [
        "Manual expense tracking",
        "Basic reports",
        "Up to 100 transactions",
      ],
    },
    {
      id: "basic",
      name: "Basic",
      price: 6.99,
      description: "Great for individuals",
      features: [
        "Everything in Free",
        "Bank sync (2 accounts)",
        "Advanced reports",
        "Email support",
      ],
    },
    {
      id: "premium",
      name: "Premium",
      price: 12.99,
      description: "For power users",
      features: [
        "Everything in Basic",
        "Unlimited accounts",
        "Investment tracking",
        "Priority support",
      ],
    },
  ];

  const transactions: Transaction[] = [
    {
      id: "inv_001",
      date: "Dec 1, 2024",
      description: "Basic Plan - Monthly",
      amount: 6.99,
      status: "paid",
      invoiceUrl: "#",
    },
    {
      id: "inv_002",
      date: "Nov 1, 2024",
      description: "Basic Plan - Monthly",
      amount: 6.99,
      status: "paid",
      invoiceUrl: "#",
    },
    {
      id: "inv_003",
      date: "Oct 1, 2024",
      description: "Basic Plan - Monthly",
      amount: 6.99,
      status: "paid",
      invoiceUrl: "#",
    },
  ];

  const currentPlanData =
    plans.find((plan) => plan.id === currentPlan) || plans[0];

  const handleUpgrade = (plan: Plan) => {
    setSelectedPlan(plan);
    setShowUpgradeModal(true);
  };

  const confirmUpgrade = () => {
    if (selectedPlan) {
      setIsLoading(true);
      setTimeout(() => {
        setSubscriptionPlan(selectedPlan.id as any);
        setIsLoading(false);
        setShowUpgradeModal(false);
        setSelectedPlan(null);
      }, 2000);
    }
  };

  return (
    <>
    
   
    <div className="min-h-screen w-full  bg-zinc-950">
      <div className="mx-auto max-w-6xl pb-12">
        {/* Header */}
       

        {/* Current Subscription */}
        <div className="mb-16">
          <h2 className="text-xl font-medium text-white  mb-6">
            Current subscription
          </h2>

          <div className=" bg-zinc-900 border  border-zinc-800 rounded-lg p-3 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 ">
                <div className="w-12 h-10  bg-zinc-900 rounded-lg flex items-center justify-center">
                  <Crown className="w-6 h-6  text-yellow-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-medium text-white ">
                      {currentPlanData.name}
                    </span>
                    {currentPlan !== "free" && (
                      <Badge variant="secondary" className="text-xs">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm  text-gray-400">
                    {currentPlanData.description}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-semibold text-white ">
                  {currentPlanData.price === 0
                    ? "Free"
                    : formatCurrency(currentPlanData.price)}
                </div>
                {currentPlanData.price > 0 && (
                  <div className="text-sm  text-gray-400">
                    per month
                  </div>
                )}
              </div>
            </div>
          </div>

          {currentPlan !== "free" && (
            <div className="text-sm  text-gray-400 mb-6">
              <div className="flex justify-between py-2">
                <span>Next payment</span>
                <span>January 1, 2025</span>
              </div>
              <div className="flex justify-between py-2">
                <span>Amount</span>
                <span>{formatCurrency(currentPlanData.price)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            {currentPlan === "free" ? (
              <Button
                className="text-white  bg-teal-600 "
                onClick={() => handleUpgrade(plans[1])}
              >
                Upgrade plan
              </Button>
            ) : (
              <>
                <Button
                  className="text-white  bg-teal-600 hover:bg-teal-700 "
                  onClick={() => handleUpgrade(plans[2])}
                  variant="outline"
                >
                  Change plan
                </Button>
                <Button
                  className="bg-red-500 text-white  hover:bg-red-600 "
                  variant="outline"
                >
                  Cancel subscription
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Payment Method */}
        <div className="mb-16">
          <h2 className="text-xl font-medium text-white  mb-6">
            Payment method
          </h2>

          {currentPlan === "free" ? (
            <div className=" bg-zinc-900 border  border-zinc-800 rounded-lg p-6">
              <p className=" text-gray-400">
                No payment method required for free plan
              </p>
            </div>
          ) : (
            <div className=" bg-zinc-900 border  border-zinc-800 rounded-lg p-5">
              <div className="flex items-center justify-between">
                {/* {hideSensitiveData ? (
                  <span className="flex justify-center text-2xl text-black  select-none">
                    ••••
                  </span>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-5 bg-blue-600 rounded text-white text-xs font-bold flex items-center justify-center">
                      VISA
                    </div>
                    <span className="text-white ">
                      •••• •••• •••• 4242
                    </span>
                    <span className="text-sm  text-gray-400">
                      12/25
                    </span>
                  </div>
                )} */}
                <Button
                  className="text-white hover:bg-teal-800   bg-teal-600  "
                  variant="outline"
                  size="sm"
                >
                  Update
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Available Plans */}
        <div className="mb-16">
          <h2 className="text-xl font-medium text-white  mb-6">
            Available plans
          </h2>

          <div className="">
            {plans.map((plan) => {
              const isCurrentPlan = plan.id === currentPlan;

              return (
                <div
                  key={plan.id}
                  className={` bg-zinc-900 border  border-zinc-800 rounded-lg px-3 py-1.5 mb-4 ${
                    isCurrentPlan ? "ring-1 ring-red-500" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-md font-medium text-white ">
                          {plan.name}
                        </h3>
                        {isCurrentPlan && (
                          <Badge variant="secondary" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="  text-sm  mb-3">
                        {plan.description}
                      </p>
                      <div className="flex flex-wrap gap-4 text-sm  /80">
                        {plan.features.map((feature, index) => (
                          <div key={index} className="flex items-center text-xs gap-1">
                            <Check className="w-3 h-3 text-green-500" />
                            {feature}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-right ml-6">
                      <div className="text-lg font-semibold text-white  mb-2">
                        {plan.price === 0 ? "Free" : formatCurrency(plan.price)}
                      </div>
                      {plan.price > 0 && (
                        <div className="text-sm   mb-4">
                          per month
                        </div>
                      )}
                      {!isCurrentPlan && (
                        <Button
                          variant={plan.price === 0 ? "outline" : "default"}
                          size="sm"
                          onClick={() => handleUpgrade(plan)}
                          className={`  h-7 ${
                            plan.price === 0
                              ? "bg-red-500  text-white hover:bg-red-600 hover:text-white  "
                              : "bg-yellow-600  0 shadow-md hover:bg-yellow-500  "
                          }`}
                        >
                          {plan.price === 0 ? "Downgrade " : "Upgrade"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Billing History */}
        {currentPlan !== "free" && (
          <div className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-medium text-white ">
                Billing history
              </h2>
              <Button
                className="bg-zinc-900 border  border-zinc-800  border  border-zinc-800-none shadow-md  border  border-zinc-800-white "
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Download all
              </Button>
            </div>

            <div className=" bg-zinc-900 border  border-zinc-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className=" bg-zinc-950">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium  text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium  text-gray-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium  text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium  text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium  text-gray-400 uppercase tracking-wider">
                      Invoice
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y  divide-gray-700">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      {/* {hideSensitiveData ? (
                        <span className="flex justify-center text-2xl text-black  select-none">
                          ••••
                        </span>
                      ) : (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white ">
                            {transaction.date}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white ">
                            {transaction.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white ">
                            {formatCurrency(transaction.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge
                              variant={
                                transaction.status === "paid"
                                  ? "secondary"
                                  : "destructive"
                              }
                              className="text-xs"
                            >
                              {transaction.status === "paid"
                                ? "Paid"
                                : "Failed"}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {transaction.invoiceUrl && (
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            )}
                          </td>
                        </>
                      )} */}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Upgrade Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="max-w-md  bg-zinc-900 border  border-zinc-800 border  border-zinc-800-white/20">
          <DialogHeader>
            <DialogTitle className="text-black ">
              Change subscription
            </DialogTitle>
            <DialogDescription>
              {selectedPlan &&
                `You're about to ${selectedPlan.price > currentPlanData.price ? "upgrade" : "change"} to the ${selectedPlan.name} plan.`}
            </DialogDescription>
          </DialogHeader>

          {selectedPlan && (
            <div className="gap-4">
              <div className="p-4 bg-gray-50 /90 rounded-lg mb-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{selectedPlan.name} Plan</span>
                  <span className="font-semibold">
                    {selectedPlan.price === 0
                      ? "Free"
                      : formatCurrency(selectedPlan.price) + "/month"}
                  </span>
                </div>
              </div>

              {selectedPlan.price > currentPlanData.price && (
                <p className="text-sm  text-gray-400">
                  You'll be charged immediately and your billing cycle will
                  reset.
                </p>
              )}
            </div>
          )}

          <DialogFooter className=" text-black">
            <Button
              className="bg-red-400 hover:bg-red-500"
              onClick={() => setShowUpgradeModal(false)}
            >
              Cancel
            </Button>
            <Button onClick={confirmUpgrade} disabled={isLoading}>
              {isLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
};

export default BillingPage;



