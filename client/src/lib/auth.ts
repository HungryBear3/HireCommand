import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface CurrentUser {
  id: number;
  username: string;
  email: string | null;
  role: string; // 'admin' | 'user'
  recruiterName: string | null;
}

export function useCurrentUser() {
  return useQuery<CurrentUser | null>({
    queryKey: ["/api/me"],
    queryFn: async () => {
      const res = await fetch("/api/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Login failed");
      }
      return res.json() as Promise<CurrentUser>;
    },
    onSuccess: (user) => {
      qc.setQueryData(["/api/me"], user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    },
    onSuccess: () => {
      qc.setQueryData(["/api/me"], null);
      qc.clear();
    },
  });
}

export function isAdmin(user: CurrentUser | null | undefined): boolean {
  return user?.role === "admin";
}
