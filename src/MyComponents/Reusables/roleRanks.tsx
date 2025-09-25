const roleDefinition = [
  { key : "Client", name : "Client"},
  { key : "Intern", name : "Intern"},
  { key: "Member", name: "Member"},
  { key: "UIDesigner", name: "UI/UX Designer"},
  { key: "SoftwareDev", name: "Software Developer"},
  { key: "MechEngineer", name: "Mechanical Engineer"},
  { key: "Recruiter", name: "HR Recruiter"},
  { key: "AiDev", name: "Ai Specialist"},
  { key: "DBAdmin", name : "Database Administrator"},
  { key: "AccManager", name: "Account Manager"},
  { key: "DataScientist", name: "Data Scientist"},
  { key: "ProjectManager", name: "Project Manager"},
  { key: "Marketing", name: "Marketing Specialist"},
  { key: "CustomerSupport", name: "Customer Support"},
  { key: "Admin", name: "Admin"},
  { key: "SecurityEngineer", name: "SecurityEngineer"},
  { key: "Partner", name: "Partnership Lead"},

  // Speciaal Ranku for Executives des!
  { key: "COO", specialRank: 99, name: "COO"},
  { key: "CEO", specialRank: 100, name:"CEO"}

];

// Build the roles object with automatic rank assignment

// Reduce doesn't always have to a number blaze
// in this instance, the reduce transforms an arraay into a single value, it processes each elemeent of the array one by one, upading an "accumulator" value as it goes on
export const Roles  = roleDefinition.reduce((acc, role, index )   => {
  // use specialRank if provided, other than that use the index
  // If role.specialRank exists (like for CEO and COO), use that value (99 or 100) Otherwise, use the array index (0 for Client, 1 for Intern, etc.)
  const rank = role.specialRank !== undefined ? role.specialRank : index;
  acc[role.key ] = { rank, name: role.name};
  return acc;

  // for this we first start off with an empty  string, while also defining the typescript type, record (K, V) the keys type are going to be K and the values is going to be V
  // it'll asign a number for your rank so if your client your rank is 0, so its going to look like this
            // Client : { rank:   0,     name: "Client"}
}, {} as Record<string, { rank:  number, name: string} >)


// helper funtion to get role by name
export const getRoleRank = (roleName: string): number => {
  const role = Object.values(Roles).find(r => r.name === roleName)
  return role?.rank ??  0; // default to lowest raank if not found
}


// Helper fn to check if one role is higher than another
export const hasHigherRank = (role1: string, role2: string): boolean => {
  return getRoleRank(role1) > getRoleRank(role2);
}

//  Generate role lists aauto
export const RoleList = Object.values(Roles).map(r => r.name);

// COO cn manage everyone except CEO
export const COORolesList = Object.values(Roles)
  .filter(r => r.rank < Roles.COO.rank)
  // Without the mapping, you'd need to update every place in your code that uses these lists to handle objects instead of strings
  .map(r => r.name);

// CEO can manage everyone
export const CEORolesList = Object.values(Roles)
  .filter(r => r.rank <=  Roles.COO.rank)
  .map(r => r.name);

export type RoleType = keyof typeof Roles;