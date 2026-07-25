import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { HardHat, UserPlus } from "lucide-react";
import { Logo } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  displayName: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  company: z.string().optional(),
  password: z.string().min(6, "At least 6 characters"),
  agreeTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms and Privacy Policy" }),
  }),
});

type FormValues = z.infer<typeof schema>;

export default function Signup() {
  const { signup, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: "", email: "", company: "", password: "", agreeTerms: false as any },
  });

  useEffect(() => {
    if (isAuthenticated) window.location.hash = "/app";
  }, [isAuthenticated]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await signup(values);
      window.location.hash = "/app";
    } catch (err: any) {
      const msg = /409/.test(err?.message) ? "That email is already registered" : err?.message || "Signup failed";
      toast({ title: "Sign up failed", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-primary/10 via-background to-background border-r border-border">
        <Link href="/" className="inline-flex items-center gap-2" data-testid="link-home">
          <Logo />
          <span className="font-display font-bold text-base">TrussPath</span>
        </Link>
        <div className="max-w-md space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <HardHat className="size-3.5 text-primary" />
            Field-first construction PM
          </div>
          <h1 className="font-display text-3xl font-bold leading-tight">
            Start your TrussPath workspace.
          </h1>
          <p className="text-sm text-muted-foreground">
            Create an account to spin up your first project, invite the crew, and stop losing paperwork
            between the trailer and the office.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} TrussPath, Inc.</div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="md:hidden flex items-center gap-2">
            <Logo />
            <span className="font-display font-bold text-base">TrussPath</span>
          </div>
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <UserPlus className="size-5 text-primary" /> Create your account
            </h2>
            <p className="text-sm text-muted-foreground">Free to try. No card required.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="form-signup">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jamie Rivera" data-testid="input-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="jamie@company.com" data-testid="input-email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Meridian Builders" data-testid="input-company" {...field} />
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
                      <Input type="password" placeholder="At least 6 characters" data-testid="input-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="agreeTerms"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-terms"
                      />
                    </FormControl>
                    <div className="text-xs leading-relaxed text-muted-foreground">
                      I agree to the{" "}
                      <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={submitting} data-testid="button-submit">
                {submitting ? "Creating…" : "Create account"}
              </Button>
            </form>
          </Form>

          <div className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
              Sign in
            </Link>
            .{" "}
            <Link href="/" className="text-muted-foreground hover:underline">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
