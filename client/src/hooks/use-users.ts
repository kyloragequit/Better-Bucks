import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

export function useUsers() {
  return useQuery({
    queryKey: [api.users.list.path],
    queryFn: async () => {
      const res = await fetch(api.users.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return api.users.list.responses[200].parse(await res.json());
    },
  });
}

export function useUserDetails(id: number) {
  return useQuery({
    queryKey: [api.users.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.users.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch user details");
      return api.users.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: z.infer<typeof insertUserSchema>) => {
      const res = await fetch(api.users.create.path, {
        method: api.users.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.users.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create user");
      }
      
      return api.users.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
      toast({
        title: "Success",
        description: "Employee created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateBalance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, amount, reason }: { id: number; amount: number; reason: string }) => {
      const url = buildUrl(api.users.updateBalance.path, { id });
      const res = await fetch(url, {
        method: api.users.updateBalance.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, reason }),
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Failed to update balance");
      
      return api.users.updateBalance.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.users.get.path, variables.id] });
      // Also update the list view just in case
      queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
      
      toast({
        title: "Balance Updated",
        description: `Successfully adjusted balance by ${variables.amount}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, role }: { id: number; role: "admin" | "employee" }) => {
      const url = buildUrl(api.users.updateRole.path, { id });
      const res = await fetch(url, {
        method: api.users.updateRole.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Failed to update role");
      
      return api.users.updateRole.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.users.get.path, variables.id] });
      queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
      
      toast({
        title: "Role Updated",
        description: `User role changed to ${variables.role}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
