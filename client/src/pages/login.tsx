import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { HardHat, Lock, LogIn } from "lucide-react";
import { Logo } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/lib/auth";
import { consumePendingRedirect } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password required"),
});

type FormValues = z.infer<typeof schema>;

function getNextParam(): string {
  return consumePendingRedirect();
}

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // If already logged in, bounce straight to /app
  useEffect(() => {
    if (isAuthenticated) window.location.hash = consumePendingRedirect();
  }, [isAuthenticated]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await login(values.email, values.password);
      const next = consumePendingRedirect();
      window.location.hash = next.startsWith("/") ? next : `/${next}`;
    } catch (err: any) {
      const msg = /401/.test(err?.message) ? "Invalid email or password" : err?.message || "Login failed";
      toast({ title: "Sign in failed", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      {/* Left: brand / value panel */}
      <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-primary/10 via-background to-background border-r border-border">
        <Link href="/" className="inline-flex items-center gap-2" data-testid="link-home">
          <Logo className="h-14 w-auto rounded-lg" />
        </Link>
        <div className="max-w-md space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <HardHat className="size-3.5 text-primary" />
            Field-first construction PM
          </div>
          <h1 className="font-display text-3xl font-bold leading-tight">
            Sign in to your job site command center.
          </h1>
          <p className="text-sm text-muted-foreground">
            Schedules, RFIs, submittals, change orders, daily logs, and Jarvis — everything your project
            team needs, one login away.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} TrussPath, Inc.
        </div>
      </div>

      {/* Right: sign-in form */}
      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="md:hidden">
            <Logo className="h-14 w-auto rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <LogIn className="size-5 text-primary" /> Sign in
            </h2>
            <p className="text-sm text-muted-foreground">
              Use your TrussPath credentials to access the app.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="form-login">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        data-testid="input-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        data-testid="input-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full gap-2"
                disabled={submitting}
                data-testid="button-submit"
              >
                <Lock className="size-4" /> {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </Form>

          <div className="text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/signup" className="text-primary hover:underline" data-testid="link-signup">
              Create one
            </Link>
            .{" "}
            <Link href="/" className="text-muted-foreground hover:underline" data-testid="link-back-home">
              Back to home
            </Link>
          </div>

          <div className="text-center text-sm">
            <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground hover:underline" data-testid="link-forgot-password">
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
