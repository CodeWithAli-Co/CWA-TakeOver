import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Label } from "@/components/ui/shadcnComponents/label";
import { Input } from "@/components/ui/shadcnComponents/input";
import {
  Card,
  CardDescription,
  CardTitle,
} from "@/components/ui/shadcnComponents/card";
import { takeOversupabase } from "../supabase";
import { TakeOverStronghold } from "@/stores/stronghold";

const COMPANY_INDUSTRIES = {
  tech: {
    label: "Tech",
    desc: "General Tech company (e.g. Software, Hardware)",
  },
  fintech: {
    label: "Fintech",
    desc: "",
  },
  ai: {
    label: "AI",
    desc: "",
  },
  law: {
    label: "Law",
    desc: "",
  },
  healthcare: {
    label: "Healthcare",
    desc: "",
  },
};
type CompanyIndustries = keyof typeof COMPANY_INDUSTRIES;

const TAKEOVER_COMPONENTS = {
  invoicer: "",
  coldemail: "",
  workspace: "",
};
type TakeOverComponents = keyof typeof TAKEOVER_COMPONENTS;

interface Props {
  completeInitialLaunch: () => void;
}

const InitialOnboarding = ({ completeInitialLaunch }: Props) => {
  // Steps
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Founder or Employee?
  const [isFounder, setIsFounder] = useState(false);

  // 2. Founder: multiple companies? (*For now: focus on one company) Employee: Enter company name & email
  const [companyID, setCompanyID] = useState<number | null>(null);
  const founderForm = useForm({
    defaultValues: {
      companyName: "",
      founderEmail: "",
      companyEmail: "",
    },
    onSubmit: async ({ value }) => {
      // Check if founder is Authorized to initialize the company
      const { data, error } = await takeOversupabase
        .from("takeover_companies")
        .select("id,initialized,companydb_url,companydb_key")
        .eq("company_name", value.companyName)
        .eq("founder_email", value.founderEmail)
        .eq("company_email", value.companyEmail)
        .single<{
          id: number;
          initialized: boolean;
          companydb_url: string;
          companydb_key: string;
        }>();

      if (!data || error) {
        founderForm.setErrorMap({
          onSubmit: {
            form: "Company not found",
            fields: {},
          },
        });
        return;
      }

      setCompanyID(data.id);

      // Save company DB creds in Stronghold
      // *Stronghold will be invalidated after 1 week for security purposes
      const stronghold = new TakeOverStronghold();
      await stronghold.insertRecord("company_name", value.companyName);

      // Pre-load data from company's database

      founderForm.reset();
    },
  });

  // 3. Founder: Industry --> Choose components
  const [companyIndustry, setCompanyIndustry] =
    useState<CompanyIndustries | null>(null);
  const [selectedComponents, setSelectedComponents] = useState<
    TakeOverComponents[]
  >([]);
  const saveComponents = async () => {
    setIsLoading(true);
    if (process.env.NODE_ENV === "development") {
      console.log("Selected Components: ", selectedComponents);
    }

    if (companyID === null) {
      setIsLoading(false);
      return;
    }

    // const { error } = await takeOversupabase.from("takeover_companies").update({ components: selectedComponents }).eq("id", companyID);
    // if (error) {
    //   // Notify user that there was an error
    //   return;
    // }

    setIsLoading(false);
  };

  useEffect(() => {
    // *Skip to login page ( handled in root.tsx ) since user is not a Founder
    if (step === 2 && !isFounder) {
      completeInitialLaunch();
    }

    // Save Components after finishing selecting them
    if (step === 4 && isFounder) {
      saveComponents();
    }

    // 4. Founder: Setup connectors/import files ( or skip )
    if (step === 5 && isFounder) {
      completeInitialLaunch();
    }
  }, [step]);

  return (
    <div className="">
      {/* Content */}
      <div className="">
        {/* Step 1 */}
        {step === 1 && (
          <div className="">
            <section>
              <span onClick={() => setIsFounder(true)}>Founder</span>
            </section>
            <section>
              <span onClick={() => setIsFounder(false)}>Employee</span>
            </section>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && isFounder && (
          <div className="">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                founderForm.handleSubmit();
              }}
            >
              <founderForm.Field
                name="founderEmail"
                children={(field) => {
                  return (
                    <Label>
                      <span>Founder Email</span>
                      <Input
                        type="text"
                        name={field.name}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="John Smith"
                      />
                    </Label>
                  );
                }}
              />

              <founderForm.Field
                name="companyName"
                children={(field) => {
                  return (
                    <Label>
                      <span>Company Name</span>
                      <Input
                        type="text"
                        name={field.name}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="johnsmith@company.com"
                      />
                    </Label>
                  );
                }}
              />

              <founderForm.Field
                name="companyEmail"
                children={(field) => {
                  return (
                    <Label>
                      <span>Company Email</span>
                      <Input
                        type="text"
                        name={field.name}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Company & Co."
                      />
                    </Label>
                  );
                }}
              />
            </form>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 &&
          isFounder &&
          (!companyIndustry ? (
            <div className="grid grid-flow-col-dense gap-2">
              {Object.entries(COMPANY_INDUSTRIES).map(([industry, det]) => {
                return (
                  <div
                    key={industry}
                    className="border p-1 hover:bg-red-500/25"
                    onClick={() =>
                      setCompanyIndustry(industry as CompanyIndustries)
                    }
                  >
                    <span>{det.label}</span>
                    <span>{det.desc}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="">
              {Object.entries(TAKEOVER_COMPONENTS).map(([name, desc]) => {
                return (
                  <Card
                    key={name}
                    onClick={() =>
                      setSelectedComponents((sc) => [
                        ...sc,
                        name as TakeOverComponents,
                      ])
                    }
                  >
                    <CardTitle>{name}</CardTitle>
                    <CardDescription>{desc}</CardDescription>
                  </Card>
                );
              })}
            </div>
          ))}

        {/* Step 4 */}
        {step === 4 && isFounder && (
          <div className="">
            <span>Connectors</span>
            <i>Connect your products to import their data</i>

            <hr />

            <span>Import Files</span>
            <i>Import files to import their data into TakeOver</i>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex justify-around">
        <button
          type="button"
          disabled={
            step === 1 || isLoading || founderForm.store.state.isSubmitting
          }
          onClick={() =>
            setStep((s) => {
              if (s > 1) return s - 1;
              else return s;
            })
          }
        >
          <ArrowLeft />
        </button>
        <button
          type="button"
          disabled={
            step === 5 || isLoading || founderForm.store.state.isSubmitting
          }
          onClick={() =>
            setStep((s) => {
              if (s < 5) return s + 1;
              else return s;
            })
          }
        >
          {isLoading || founderForm.store.state.isSubmitting ? (
            <Loader2 />
          ) : (
            "Next"
          )}
        </button>
      </div>
    </div>
  );
};
export default InitialOnboarding;
