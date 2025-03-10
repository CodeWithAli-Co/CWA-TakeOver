type Option = { value: string; label: string };

const Roles = [
  {
    role: "Intern"
  },
  {
    role: "Member"
  },
  {
    role: "Marketing Specialist"
  },
  {
    role: "Admin"
  },
  {
    role: "Project Manager"
  }
]

export const RoleDynamicOptions = () => {
  const dynamicOptions: Option[] = Roles.map((role: any) => ({
    value: role.role,
    label: role.role,
  }));
  return dynamicOptions;
}