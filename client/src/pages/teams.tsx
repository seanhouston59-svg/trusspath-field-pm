import { useState } from "react";
import { Video, ExternalLink, Copy, Check, Calendar, Users, PhoneCall } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

/**
 * Microsoft Teams launcher.
 *
 * We do NOT try to iframe teams.microsoft.com — Microsoft sets
 * X-Frame-Options: SAMEORIGIN so it refuses to render in any embed. Instead
 * this page acts as a launcher: quick actions that deep-link into Teams
 * (native app if installed, browser otherwise) plus a "join meeting by ID"
 * form that constructs the official meetup-join URL.
 *
 * Deep-link reference:
 *   https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/deep-links
 */

const TEAMS_HOME = "https://teams.microsoft.com/";
const TEAMS_CALENDAR = "https://teams.microsoft.com/_#/calendar";
const TEAMS_CHAT = "https://teams.microsoft.com/_#/conversations";
const TEAMS_CALLS = "https://teams.microsoft.com/_#/calls";
const TEAMS_DOWNLOAD = "https://www.microsoft.com/en-us/microsoft-teams/download-app";

function buildJoinUrl(meetingId: string, passcode: string): string {
  // Two shapes are accepted:
  //   1) A full URL that the user pasted (starts with https://) — pass through.
  //   2) A meeting ID (numeric with spaces, or GUID-like). We hand it to
  //      teams.microsoft.com/l/meetup-join, which is the canonical
  //      "join by ID" entry point.
  const trimmed = meetingId.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Strip anything that isn't a digit — Outlook copies "123 456 789 012".
  const digits = trimmed.replace(/\s+/g, "");
  const base = `https://teams.microsoft.com/l/meetup-join/${encodeURIComponent(digits)}`;
  const qs = passcode ? `?passcode=${encodeURIComponent(passcode.trim())}` : "";
  return base + qs;
}

function launch(url: string) {
  // Open in a new tab; Teams' own URL scheme will hand off to the desktop
  // app when the user has it installed.
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function TeamsPage() {
  const [meetingId, setMeetingId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const joinUrl = meetingId.trim() ? buildJoinUrl(meetingId, passcode) : "";

  const copyJoinUrl = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ title: "Couldn't copy", description: "Your browser blocked clipboard access.", variant: "destructive" });
    }
  };

  const onJoin = () => {
    if (!meetingId.trim()) {
      toast({ title: "Enter a meeting ID or link", description: "Paste the Teams meeting link from your invite, or type the meeting ID." });
      return;
    }
    launch(joinUrl);
  };

  return (
    <Layout title="Microsoft Teams">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">

        {/* Hero / header */}
        <section className="rounded-xl border border-border/60 bg-gradient-to-br from-[#4b53bc]/10 via-background to-background p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-11 items-center justify-center rounded-lg bg-[#4b53bc] text-white shadow-sm">
                <Video className="size-6" />
              </div>
              <div>
                <div className="ff-kicker text-xs text-muted-foreground">Communication</div>
                <h2 className="font-display text-xl font-extrabold tracking-tight">Microsoft Teams</h2>
                <p className="mt-1 text-sm text-muted-foreground">Join meetings, message crews, and jump into Teams from inside TrussPath.</p>
              </div>
            </div>
            <Button onClick={() => launch(TEAMS_HOME)} className="gap-2" data-testid="button-teams-open">
              <ExternalLink className="size-4" />
              Open Teams
            </Button>
          </div>
        </section>

        {/* Join a meeting */}
        <section className="rounded-xl border border-border/60 bg-card p-5">
          <div className="mb-3">
            <h3 className="font-display text-base font-bold">Join a meeting</h3>
            <p className="text-xs text-muted-foreground">Paste the full Teams link from your calendar invite, or type the meeting ID (with or without spaces).</p>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr,180px]">
            <div>
              <Label htmlFor="teams-meeting-id" className="text-xs">Meeting link or ID</Label>
              <Input
                id="teams-meeting-id"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                placeholder="https://teams.microsoft.com/l/meetup-join/…  or  123 456 789 012"
                className="mt-1"
                data-testid="input-teams-meeting-id"
                onKeyDown={(e) => e.key === "Enter" && onJoin()}
              />
            </div>
            <div>
              <Label htmlFor="teams-passcode" className="text-xs">Passcode (optional)</Label>
              <Input
                id="teams-passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="e.g. 4G8k2z"
                className="mt-1"
                data-testid="input-teams-passcode"
                onKeyDown={(e) => e.key === "Enter" && onJoin()}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={onJoin} className="gap-2" data-testid="button-teams-join">
              <Video className="size-4" />
              Join meeting
            </Button>
            <Button variant="outline" onClick={copyJoinUrl} disabled={!joinUrl} className="gap-2" data-testid="button-teams-copy">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy join link"}
            </Button>
          </div>
        </section>

        {/* Quick actions */}
        <section className="grid gap-3 md:grid-cols-3">
          <QuickTile
            title="Calendar"
            description="See today's meetings and join with one click."
            Icon={Calendar}
            onClick={() => launch(TEAMS_CALENDAR)}
            testId="tile-teams-calendar"
          />
          <QuickTile
            title="Chats"
            description="Message a super, PM, or the whole crew."
            Icon={Users}
            onClick={() => launch(TEAMS_CHAT)}
            testId="tile-teams-chat"
          />
          <QuickTile
            title="Calls"
            description="Dial a phone number or start a 1:1 Teams call."
            Icon={PhoneCall}
            onClick={() => launch(TEAMS_CALLS)}
            testId="tile-teams-calls"
          />
        </section>

        <section className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Teams runs in a new tab. If you have the desktop app installed, meeting links will hand off automatically.
            </span>
            <a
              href={TEAMS_DOWNLOAD}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              data-testid="link-teams-download"
            >
              Download the Teams app
              <ExternalLink className="size-3" />
            </a>
          </div>
        </section>

      </div>
    </Layout>
  );
}

function QuickTile({
  title,
  description,
  Icon,
  onClick,
  testId,
}: {
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start gap-2 rounded-xl border border-border/60 bg-card p-4 text-left transition hover-elevate"
      data-testid={testId}
    >
      <div className="flex size-9 items-center justify-center rounded-lg bg-[#4b53bc]/10 text-[#4b53bc] transition group-hover:bg-[#4b53bc] group-hover:text-white">
        <Icon className="size-4" />
      </div>
      <div className="font-display text-sm font-bold">{title}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
      <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
        Open <ExternalLink className="size-3" />
      </div>
    </button>
  );
}
