import { Employees } from "@/stores/query";

type Option = { value: string; label: string };

export const UserDynamicOptions = () => {
  const { data, error } = Employees();
  const dynamicOptions: Option[] = data!.map((user: any) => ({
    value: user.username,
    label: user.username,
  }));
  if (error) {
    console.log('Error fetching Dynamic Users', error.message)
    return [];
  }
  return dynamicOptions;
}