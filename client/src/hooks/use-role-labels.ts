import { useQuery } from "@tanstack/react-query";

type RoleLabels = {
  adminRoleLabel: string;
  employeeRoleLabel: string;
};

export function useRoleLabels() {
  const { data } = useQuery<RoleLabels>({
    queryKey: ["/api/organizations/role-labels"],
  });

  const getRoleLabel = (role: string) => {
    if (!data) return role === "prime_admin" ? "Prime Admin" : role.charAt(0).toUpperCase() + role.slice(1);
    if (role === "prime_admin") return `Prime ${data.adminRoleLabel}`;
    if (role === "admin") return data.adminRoleLabel;
    if (role === "employee") return data.employeeRoleLabel;
    return role;
  };

  return { roleLabels: data, getRoleLabel };
}
