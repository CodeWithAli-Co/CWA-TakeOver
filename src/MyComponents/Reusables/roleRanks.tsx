export const RolesList = [
  "Intern",
  "Member",
  "UI/UX Designer",
  "Software Developer",
  "Mechanical engineer",
  "Recruiter",
  "AI Specialist",
  "Database Administrator",
  "Account Manager",
  "Data Scientist",
  "Project Manager",
  "Marketing Specialist",
  "Customer Support",
  "Admin",
  "Security Engineer",
];

export const CEORolesList = [
  "Intern",
  "Member",
  "UI/UX Designer",
  "Software Developer",
  "Mechanical engineer",
  "Recruiter",
  "AI Specialist",
  "Database Administrator",
  "Account Manager",
  "Data Scientist",
  "Project Manager",
  "Marketing Specialist",
  "Customer Support",
  "Admin",
  "Security Engineer",
  "Partnership Lead",
  "COO",
];

export const COORolesList = [
  "Intern",
  "Member",
  "UI/UX Designer",
  "Software Developer",
  "Mechanical engineer",
  "Recruiter",
  "AI Specialist",
  "Database Administrator",
  "Account Manager",
  "Data Scientist",
  "Project Manager",
  "Marketing Specialist",
  "Customer Support",
  "Admin",
  "Security Engineer",
  "Partnership Lead"
];

const Roles = [
  "Intern",
  "Member",
  "UI/UX Designer",
  "Software Developer",
  "Mechanical engineer",
  "Recruiter",
  "AI Specialist",
  "Database Administrator",
  "Account Manager",
  "Data Scientist",
  "Project Manager",
  "Marketing Specialist",
  "Customer Support",
  "Admin",
  "Security Engineer",
  "Partnership Lead",
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
      case "UI/UX Designer":
        return 3;
      case "Software Developer":
        return 4;
      case "Mechanical engineer":
        return 5;
      case "Recruiter":
        return 6;
      case "AI Specialist":
        return 7;
      case "Database Administrator":
        return 8;
      case "Account Manager":
        return 9;
      case "Data Scientist":
        return 10;
      case "Project Manager":
        return 11;
      case "Marketing Specialist":
        return 12;
      case "Customer Support":
        return 13;
      case "Admin":
        return 14;
      case "Security Engineer":
        return 15;
      case "Partnership Lead":
        return 16;
      case "COO":
        return 99;
      case "CEO":
        return 100;
      default:
        return 1;
    }
  }
};
