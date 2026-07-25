import { Link } from "wouter";
import { Logo } from "@/components/bits";
import { ShieldCheck, FileText } from "lucide-react";

function LegalShell({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Simple top bar */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo className="h-5 w-5 text-primary" />
            <span className="font-display text-sm font-bold">TrussPath</span>
          </Link>
          <Link href="/signup" className="text-sm text-muted-foreground hover:text-foreground">
            Back to app
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">Last updated: July 25, 2026</p>
          </div>
        </div>
        <div className="prose prose-sm max-w-none space-y-4 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Logo className="h-4 w-4 text-primary" />
            <span className="font-display font-bold text-foreground">TrussPath</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <a href="mailto:hello@trusspath.com" className="hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function TermsOfService() {
  return (
    <LegalShell title="Terms of Service" icon={FileText}>
      <p>
        These Terms of Service ("Terms") govern your use of TrussPath, a field project management
        platform operated by TrussPath ("we," "us," or "our"). By creating an account or using our
        services, you agree to these Terms.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">1. Accounts</h2>
      <p>
        You must provide accurate and complete information when creating an account. You are
        responsible for maintaining the security of your account credentials and for all activities
        that occur under your account. Notify us immediately of any unauthorized use.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">2. Subscriptions and Billing</h2>
      <p>
        Paid plans are billed on a recurring basis (monthly or annually) through our payment
        processor, Stripe. Subscription fees are non-refundable except as required by law. You may
        cancel your subscription at any time; cancellation takes effect at the end of the current
        billing cycle. We may change pricing with at least 30 days' notice.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">3. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul className="ml-4 list-disc space-y-1">
        <li>Use the service for any unlawful purpose or in violation of any local, state, or federal law</li>
        <li>Upload or transmit viruses, malware, or any other malicious code</li>
        <li>Attempt to gain unauthorized access to any part of the service, other accounts, or our systems</li>
        <li>Interfere with or disrupt the service, servers, or networks connected to the service</li>
        <li>Use the service to store or transmit infringing, defamatory, or otherwise objectionable content</li>
        <li>Reverse engineer, decompile, or otherwise attempt to extract source code from the service</li>
      </ul>

      <h2 className="font-display text-base font-bold text-foreground">4. Your Data</h2>
      <p>
        You retain ownership of all data you upload to TrussPath. We process your data in accordance
        with our Privacy Policy. You are responsible for ensuring you have the rights to upload any
        content, including project documents, photos, and contractor information. You may export or
        delete your data at any time.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">5. Intellectual Property</h2>
      <p>
        TrussPath, including its software, design, logos, and content, is the property of TrussPath
        and is protected by intellectual property laws. You may not copy, modify, distribute, or
        create derivative works from the service without our written consent.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">6. Service Availability</h2>
      <p>
        We strive to maintain high availability but do not guarantee uninterrupted service. We may
        modify, suspend, or discontinue any part of the service with reasonable notice. We are not
        liable for any downtime, data loss, or service interruptions.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">7. Disclaimers</h2>
      <p>
        The service is provided "as is" and "as available" without warranties of any kind, whether
        express or implied. We do not warrant that the service will be error-free, secure, or
        available at all times.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">8. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, TrussPath shall not be liable for any indirect,
        incidental, special, consequential, or punitive damages, or any loss of profits, data, or
        business, arising from your use of or inability to use the service. Our total liability shall
        not exceed the amount you paid in the 12 months preceding the claim.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">9. Indemnification</h2>
      <p>
        You agree to indemnify and hold TrussPath harmless from any claims, damages, or expenses
        arising from your use of the service or your violation of these Terms.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">10. Termination</h2>
      <p>
        You may delete your account at any time. We may suspend or terminate your account if you
        violate these Terms or if your account remains inactive for an extended period. Upon
        termination, your data will be deleted within 90 days unless required by law to retain it.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">11. Changes to Terms</h2>
      <p>
        We may update these Terms from time to time. We will notify you of significant changes via
        email or in-app notification at least 30 days before they take effect. Continued use of the
        service after changes take effect constitutes acceptance of the updated Terms.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">12. Contact</h2>
      <p>
        Questions about these Terms? Email us at{" "}
        <a href="mailto:hello@trusspath.com" className="text-primary hover:underline">hello@trusspath.com</a>.
      </p>
    </LegalShell>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalShell title="Privacy Policy" icon={ShieldCheck}>
      <p>
        This Privacy Policy describes how TrussPath ("we," "us," or "our") collects, uses, and
        protects your information when you use our field project management platform. We are committed
        to protecting your privacy and complying with applicable data protection laws.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">1. Information We Collect</h2>
      <p><strong className="text-foreground">Account Information:</strong> Name, email address, company name, and password (encrypted) when you create an account.</p>
      <p><strong className="text-foreground">Project Data:</strong> Information you enter into the platform, including project details, tasks, RFIs, submittals, change orders, daily logs, photos, documents, contacts, and team member assignments.</p>
      <p><strong className="text-foreground">Billing Information:</strong> Payment method details processed by Stripe. We do not store your full credit card number on our servers.</p>
      <p><strong className="text-foreground">Usage Data:</strong> IP address, browser type, device information, and interaction logs with the service.</p>

      <h2 className="font-display text-base font-bold text-foreground">2. How We Use Your Information</h2>
      <ul className="ml-4 list-disc space-y-1">
        <li>To provide, maintain, and improve the TrussPath platform</li>
        <li>To process subscription payments and manage your account</li>
        <li>To send service-related communications, including security alerts and billing notices</li>
        <li>To respond to your support requests and inquiries</li>
        <li>To monitor and analyze usage to detect and prevent fraud or abuse</li>
        <li>To comply with legal obligations</li>
      </ul>

      <h2 className="font-display text-base font-bold text-foreground">3. Data Storage and Security</h2>
      <p>
        Your data is stored on secure cloud infrastructure (Neon Postgres and Vercel). We use
        industry-standard encryption for data in transit (TLS/SSL) and at rest. Passwords are hashed
        using cryptographic hashing (scrypt). Access to production systems is restricted and
        audited. Despite these measures, no method of transmission or storage is 100% secure.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">4. Third-Party Services</h2>
      <p>We use the following third-party services to operate the platform:</p>
      <ul className="ml-4 list-disc space-y-1">
        <li><strong className="text-foreground">Stripe</strong> — Payment processing (billing data)</li>
        <li><strong className="text-foreground">Vercel</strong> — Application hosting and deployment</li>
        <li><strong className="text-foreground">Neon</strong> — Database hosting</li>
      </ul>
      <p>
        These providers process data on our behalf under appropriate data processing agreements.
        Integrations you connect (such as payroll or scheduling tools) are governed by those
        providers' own privacy policies.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">5. Data Retention</h2>
      <p>
        We retain your data for as long as your account is active. After account deletion, we remove
        your data within 90 days, except where retention is required by law (e.g., financial records).
        Deleted items moved to the recycle bin may be permanently removed after 30 days.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">6. Your Rights</h2>
      <p>Depending on your jurisdiction, you may have the right to:</p>
      <ul className="ml-4 list-disc space-y-1">
        <li>Access the personal data we hold about you</li>
        <li>Request correction of inaccurate data</li>
        <li>Request deletion of your data ("right to be forgotten")</li>
        <li>Export your data in a portable format</li>
        <li>Object to or restrict certain processing of your data</li>
        <li>Withdraw consent for marketing communications</li>
      </ul>
      <p>
        To exercise any of these rights, email{" "}
        <a href="mailto:hello@trusspath.com" className="text-primary hover:underline">hello@trusspath.com</a>.
        We will respond within 30 days.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">7. Cookies</h2>
      <p>
        We use essential cookies for authentication and session management. We do not use
        third-party advertising or tracking cookies. You can disable cookies in your browser
        settings, but this may affect your ability to log in.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">8. Data Breaches</h2>
      <p>
        In the event of a data breach affecting your personal information, we will notify affected
        users within 72 hours of becoming aware of the breach, in accordance with applicable laws.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">9. Children's Privacy</h2>
      <p>
        TrussPath is not intended for use by anyone under 18. We do not knowingly collect
        information from children. If you believe a child has provided us with information, please
        contact us.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">10. International Users</h2>
      <p>
        TrussPath is hosted in the United States. If you access the service from outside the US,
        your data will be transferred to and processed in the US. We take appropriate measures to
        ensure cross-border data transfers comply with applicable laws, including GDPR and CCPA.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">11. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of significant changes
        via email or in-app notification at least 30 days before they take effect.
      </p>

      <h2 className="font-display text-base font-bold text-foreground">12. Contact</h2>
      <p>
        Questions about your privacy? Email us at{" "}
        <a href="mailto:hello@trusspath.com" className="text-primary hover:underline">hello@trusspath.com</a>.
      </p>
    </LegalShell>
  );
}
