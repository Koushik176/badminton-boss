import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api, setSession } from "@/lib/api";
import { Shuttle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Organizer sign in — Smash Court" },
      { name: "description", content: "Sign in to manage badminton tournaments and live scoring." },
      { property: "og:title", content: "Organizer sign in — Smash Court" },
      {
        property: "og:description",
        content: "Sign in to manage badminton tournaments and live scoring.",
      },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const status = useQuery({
    queryKey: ["auth-status"],
    queryFn: () => api<{ hasOrganizer: boolean }>("/auth/status"),
  });
  const setup = status.data && !status.data.hasOrganizer;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ token: string; email: string }>(setup ? "/auth/setup" : "/auth/login", {
        body: { email, password },
      });
      setSession(r.token, r.email);
      toast.success(setup ? "Organizer account created" : "Signed in");
      navigate({ to: "/" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-5 rounded-2xl bg-card p-8 shadow-xl"
      >
        <div className="text-center">
          <Shuttle className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-2 font-display text-3xl font-extrabold uppercase">Smash Court</h1>
          <p className="text-sm text-muted-foreground">
            {setup ? "Create the first organizer account" : "Organizer sign in"}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw">Password</Label>
          <Input
            id="pw"
            type="password"
            required
            minLength={setup ? 8 : 1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={busy || status.isLoading}>
          {setup ? "Create account" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
