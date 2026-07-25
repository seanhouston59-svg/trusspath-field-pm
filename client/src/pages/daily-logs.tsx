import { useState } from "react";
import { Plus, X, ClipboardList } from "lucide-react";
import { Layout } from "@/components/layout";
import { GhostState, GhostDailyLogCards } from "@/components/ghost-state";
import { DailyLogList } from "@/components/tables";
import { DailyLogForm } from "@/components/daily-log-form";
import { useDailyLogs, useTeamMap, useProjects, useDeleteDailyLog } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { DailyLog } from "@shared/schema";

export default function DailyLogsPage() {
  const { data: logs = [], isLoading } = useDailyLogs();
  const team = useTeamMap();
  const { data: projects = [] } = useProjects();
  const projectList = projects.map((p) => ({ id: p.id, name: p.name }));
  const del = useDeleteDailyLog();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DailyLog | null>(null);

  const openNew = () => { setEditing(null); setShowForm(true); };
  const openEdit = (l: DailyLog) => { setEditing(l); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const handleDelete = (l: DailyLog) => {
    if (!window.confirm(`Delete the daily log for ${l.date}? This cannot be undone.`)) return;
    del.mutate(l.id, { onSuccess: () => toast({ title: "Daily log deleted" }) });
  };

  return (
    <Layout
      title="Daily Logs"
      actions={
        <Button size="sm" onClick={openNew} data-testid="button-new-log">
          <Plus className="size-4" /> Log Day
        </Button>
      }
    >
      {showForm && (
        <div className="mb-4">
          <DailyLogForm editing={editing} onDone={closeForm} />
        </div>
      )}

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" />
      ) : logs.length === 0 ? (
        <div>
          <GhostDailyLogCards />
          <div className="mt-4">
            <GhostState
              title="No daily logs yet"
              description="The sample entries above show what daily logs will look like. Create one to start recording field activity."
              icon={ClipboardList}
            />
          </div>
        </div>
      ) : (
        <DailyLogList logs={logs} team={team} projects={projectList} onEdit={openEdit} onDelete={handleDelete} />
      )}
    </Layout>
  );
}
