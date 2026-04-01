import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Job } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MapPin, Users, Clock, DollarSign, Briefcase, ChevronRight } from "lucide-react";

const stages = [
  { key: "intake", label: "Intake", color: "bg-slate-400" },
  { key: "sourcing", label: "Sourcing", color: "bg-blue-500" },
  { key: "screening", label: "Screening", color: "bg-cyan-500" },
  { key: "interview", label: "Interview", color: "bg-amber-500" },
  { key: "offer", label: "Offer", color: "bg-purple-500" },
  { key: "placed", label: "Placed", color: "bg-green-500" },
];

export default function Jobs() {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display font-bold text-xl">Jobs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {jobs.length} active searches across your pipeline
        </p>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
        {stages.map((stage) => {
          const stageJobs = jobs.filter((j) => j.stage === stage.key);
          return (
            <div key={stage.key} className="flex-shrink-0 w-[260px]">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {stage.label}
                </span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">
                  {stageJobs.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {stageJobs.map((job) => (
                  <Card
                    key={job.id}
                    className="border border-card-border hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedJob(job)}
                    data-testid={`card-job-${job.id}`}
                  >
                    <CardContent className="p-3 space-y-2.5">
                      <div>
                        <p className="text-sm font-semibold leading-tight">{job.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{job.company}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin size={11} />
                        <span>{job.location}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users size={11} />
                          <span>{job.candidateCount} candidates</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock size={11} />
                          <span>{job.daysOpen}d</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-medium text-primary">
                        <DollarSign size={11} />
                        <span>{job.feePotential}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {stageJobs.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border py-8 text-center">
                    <p className="text-xs text-muted-foreground">No jobs</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Job Detail */}
      <Sheet open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedJob && <JobDetail job={selectedJob} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function JobDetail({ job }: { job: Job }) {
  const reqs: string[] = JSON.parse(job.requirements);
  return (
    <div className="space-y-6">
      <SheetHeader>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Briefcase size={18} className="text-primary" />
          </div>
          <div>
            <SheetTitle className="text-lg font-display">{job.title}</SheetTitle>
            <p className="text-sm text-muted-foreground">{job.company}</p>
            <p className="text-xs text-muted-foreground">{job.location}</p>
          </div>
        </div>
      </SheetHeader>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border border-card-border">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{job.candidateCount}</p>
            <p className="text-xs text-muted-foreground">Candidates</p>
          </CardContent>
        </Card>
        <Card className="border border-card-border">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{job.daysOpen}</p>
            <p className="text-xs text-muted-foreground">Days Open</p>
          </CardContent>
        </Card>
        <Card className="border border-card-border">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-primary">{job.feePotential}</p>
            <p className="text-xs text-muted-foreground">Fee</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Description</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{job.description}</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Requirements</h3>
        <ul className="space-y-1.5">
          {reqs.map((req, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <ChevronRight size={12} className="mt-1 text-primary flex-shrink-0" />
              {req}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1" data-testid="button-add-candidates">
          Add Candidates
        </Button>
        <Button size="sm" variant="outline" className="flex-1">
          Edit Job
        </Button>
      </div>
    </div>
  );
}
