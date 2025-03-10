export const RolesList = [
  "Intern",
  "Member",
  "Marketing Specialist",
  "Admin",
  "Project Manager"
];

const Roles = [
  "Intern",
  "Member",
  "Marketing Specialist",
  "Admin",
  "Project Manager",
  "COO",
  "CEO",
];

export const RoleRank = async (userRole: string) => {
  if (!Roles.includes(userRole)) {
    console.log("Couldnt Find Role's Rank");
    return 0;
  } else {
    switch (userRole) {
      case "Intern":
        return 1;
      case "Member":
        return 2;
      case "Marketing Specialist":
        return 3;
      case "Admin":
        return 4;
      case "Project Manager":
        return 5;
      case "COO":
        return 6;
      case "CEO":
        return 7;
      default:
        return 1;
    }
  }
};
