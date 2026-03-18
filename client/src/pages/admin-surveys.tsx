import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout-admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ClipboardList, Plus, Trash2, Eye, Play, Square, Users, ChevronDown, ChevronUp, X } from "lucide-react";
import type { Survey, SurveyQuestion } from "@shared/schema";
import { useUser } from "@/hooks/use-auth";

type SurveyWithMeta = Survey & { questions: SurveyQuestion[]; responseCount: number };

type QuestionDraft = {
  questionType: "multiple_choice" | "written";
  questionText: string;
  options: string[];
};

function statusBadge(status: string) {
  if (status === "active") return <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>;
  if (status === "closed") return <Badge className="bg-gray-100 text-gray-600 border-gray-200">Closed</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Draft</Badge>;
}

function ResultsDialog({ survey, onClose }: { survey: SurveyWithMeta; onClose: () => void }) {
  const { data, isLoading } = useQuery<{
    survey: Survey & { questions: SurveyQuestion[] };
    results: { question: SurveyQuestion; answers: { id: number; selectedOption: number | null; answerText: string | null }[]; respondents: number }[];
    respondents: { user: { id: number; fullName: string }; submittedAt: string }[];
  }>({
    queryKey: ["/api/admin/surveys", survey.id, "results"],
    queryFn: () => fetch(`/api/admin/surveys/${survey.id}/results`, { credentials: "include" }).then(r => r.json()),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Results: {survey.title}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading results…</div>
        ) : !data ? (
          <div className="py-8 text-center text-muted-foreground">Failed to load results.</div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{data.respondents.length} respondent{data.respondents.length !== 1 ? "s" : ""}</span>
            </div>
            {data.results.map((r) => (
              <div key={r.question.id} className="space-y-2" data-testid={`result-question-${r.question.id}`}>
                <p className="font-medium text-sm">{r.question.questionText}</p>
                {r.question.questionType === "multiple_choice" && r.question.options ? (
                  <div className="space-y-1">
                    {r.question.options.map((opt, i) => {
                      const count = r.answers.filter(a => a.selectedOption === i).length;
                      const pct = r.respondents > 0 ? Math.round((count / r.respondents) * 100) : 0;
                      return (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="w-40 truncate text-muted-foreground">{opt}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-16 text-right text-muted-foreground">{count} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {r.answers.filter(a => a.answerText).map((a) => (
                      <p key={a.id} className="text-sm bg-muted/50 rounded px-3 py-1.5">"{a.answerText}"</p>
                    ))}
                    {r.answers.filter(a => a.answerText).length === 0 && (
                      <p className="text-sm text-muted-foreground italic">No written answers yet.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {data.respondents.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Respondents</p>
                <div className="space-y-1">
                  {data.respondents.map(r => (
                    <div key={r.user.id} className="flex justify-between text-sm text-muted-foreground">
                      <span>{r.user.fullName}</span>
                      <span>{new Date(r.submittedAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-close-results">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateSurveyDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    { questionType: "multiple_choice", questionText: "", options: ["", ""] },
  ]);

  const mutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/admin/surveys", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/surveys"] });
      toast({ title: "Survey created" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function addQuestion() {
    setQuestions(qs => [...qs, { questionType: "multiple_choice", questionText: "", options: ["", ""] }]);
  }

  function removeQuestion(i: number) {
    setQuestions(qs => qs.filter((_, idx) => idx !== i));
  }

  function updateQuestion(i: number, patch: Partial<QuestionDraft>) {
    setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  }

  function addOption(qi: number) {
    setQuestions(qs => qs.map((q, idx) => idx === qi ? { ...q, options: [...q.options, ""] } : q));
  }

  function updateOption(qi: number, oi: number, val: string) {
    setQuestions(qs => qs.map((q, idx) => idx === qi ? { ...q, options: q.options.map((o, j) => j === oi ? val : o) } : q));
  }

  function removeOption(qi: number, oi: number) {
    setQuestions(qs => qs.map((q, idx) => idx === qi ? { ...q, options: q.options.filter((_, j) => j !== oi) } : q));
  }

  function handleSubmit() {
    if (!title.trim()) return toast({ title: "Title is required", variant: "destructive" });
    mutation.mutate({ title: title.trim(), description: description.trim() || undefined, status, questions });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Survey</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Title *</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Survey title" data-testid="input-survey-title" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Description</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" rows={2} data-testid="input-survey-description" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Initial Status</label>
            <Select value={status} onValueChange={v => setStatus(v as any)}>
              <SelectTrigger data-testid="select-survey-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active (visible to employees)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Questions</p>
            {questions.map((q, qi) => (
              <div key={qi} className="border rounded-lg p-4 space-y-3 bg-muted/20" data-testid={`question-block-${qi}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={q.questionText}
                      onChange={e => updateQuestion(qi, { questionText: e.target.value })}
                      placeholder={`Question ${qi + 1}`}
                      data-testid={`input-question-text-${qi}`}
                    />
                    <Select value={q.questionType} onValueChange={v => updateQuestion(qi, { questionType: v as any })}>
                      <SelectTrigger data-testid={`select-question-type-${qi}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                        <SelectItem value="written">Written Answer</SelectItem>
                      </SelectContent>
                    </Select>
                    {q.questionType === "multiple_choice" && (
                      <div className="space-y-1.5 pl-2">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex gap-2">
                            <Input
                              value={opt}
                              onChange={e => updateOption(qi, oi, e.target.value)}
                              placeholder={`Option ${oi + 1}`}
                              className="h-8 text-sm"
                              data-testid={`input-option-${qi}-${oi}`}
                            />
                            {q.options.length > 2 && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeOption(qi, oi)}>
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addOption(qi)} data-testid={`button-add-option-${qi}`}>
                          <Plus className="h-3 w-3 mr-1" /> Add Option
                        </Button>
                      </div>
                    )}
                  </div>
                  {questions.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={() => removeQuestion(qi)} data-testid={`button-remove-question-${qi}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addQuestion} data-testid="button-add-question">
              <Plus className="h-4 w-4 mr-1" /> Add Question
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending} data-testid="button-create-survey">
            {mutation.isPending ? "Creating…" : "Create Survey"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SurveyCard({ survey }: { survey: SurveyWithMeta }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: user } = useUser();
  const [showResults, setShowResults] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const statusMutation = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/admin/surveys/${survey.id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/surveys"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/admin/surveys/${survey.id}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/surveys"] });
      toast({ title: "Survey deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isPrimeAdmin = user?.role === "prime_admin";

  return (
    <>
      {showResults && <ResultsDialog survey={survey} onClose={() => setShowResults(false)} />}
      <Card data-testid={`card-survey-${survey.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base">{survey.title}</CardTitle>
                {statusBadge(survey.status)}
              </div>
              {survey.description && <p className="text-sm text-muted-foreground mt-1">{survey.description}</p>}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setExpanded(e => !e)} data-testid={`button-expand-survey-${survey.id}`}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{survey.questions.length} question{survey.questions.length !== 1 ? "s" : ""}</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {survey.responseCount} response{survey.responseCount !== 1 ? "s" : ""}</span>
            <span>•</span>
            <span>{new Date(survey.createdAt).toLocaleDateString()}</span>
          </div>
        </CardHeader>
        {expanded && survey.questions.length > 0 && (
          <CardContent className="pt-0 pb-3">
            <div className="space-y-2 border-t pt-3">
              {survey.questions.map((q, i) => (
                <div key={q.id} className="text-sm">
                  <span className="font-medium">{i + 1}. </span>
                  <span>{q.questionText}</span>
                  <span className="text-muted-foreground ml-2 text-xs">({q.questionType === "multiple_choice" ? "multiple choice" : "written"})</span>
                  {q.questionType === "multiple_choice" && q.options && (
                    <ul className="mt-1 ml-4 space-y-0.5">
                      {q.options.map((o, oi) => <li key={oi} className="text-muted-foreground text-xs">• {o}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        )}
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowResults(true)} data-testid={`button-view-results-${survey.id}`}>
              <Eye className="h-3.5 w-3.5 mr-1" /> Results
            </Button>
            {survey.status === "draft" && (
              <Button size="sm" onClick={() => statusMutation.mutate("active")} disabled={statusMutation.isPending} data-testid={`button-activate-survey-${survey.id}`}>
                <Play className="h-3.5 w-3.5 mr-1" /> Activate
              </Button>
            )}
            {survey.status === "active" && (
              <Button variant="outline" size="sm" onClick={() => statusMutation.mutate("closed")} disabled={statusMutation.isPending} data-testid={`button-close-survey-${survey.id}`}>
                <Square className="h-3.5 w-3.5 mr-1" /> Close
              </Button>
            )}
            {survey.status === "closed" && (
              <Button variant="outline" size="sm" onClick={() => statusMutation.mutate("active")} disabled={statusMutation.isPending} data-testid={`button-reactivate-survey-${survey.id}`}>
                <Play className="h-3.5 w-3.5 mr-1" /> Reactivate
              </Button>
            )}
            {isPrimeAdmin && (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this survey?")) deleteMutation.mutate(); }} disabled={deleteMutation.isPending} data-testid={`button-delete-survey-${survey.id}`}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default function AdminSurveysPage() {
  const [creating, setCreating] = useState(false);
  const { data: surveys = [], isLoading } = useQuery<SurveyWithMeta[]>({
    queryKey: ["/api/surveys"],
  });

  const active = surveys.filter(s => s.status === "active");
  const draft = surveys.filter(s => s.status === "draft");
  const closed = surveys.filter(s => s.status === "closed");

  return (
    <AdminLayout>
      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" /> Surveys
          </h1>
          <Button onClick={() => setCreating(true)} data-testid="button-new-survey">
            <Plus className="h-4 w-4 mr-1" /> New Survey
          </Button>
        </div>

        {creating && <CreateSurveyDialog onClose={() => setCreating(false)} />}

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading surveys…</div>
        ) : surveys.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No surveys yet. Create one to gather team feedback.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {active.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Active</h2>
                <div className="space-y-3">{active.map(s => <SurveyCard key={s.id} survey={s} />)}</div>
              </section>
            )}
            {draft.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Drafts</h2>
                <div className="space-y-3">{draft.map(s => <SurveyCard key={s.id} survey={s} />)}</div>
              </section>
            )}
            {closed.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Closed</h2>
                <div className="space-y-3">{closed.map(s => <SurveyCard key={s.id} survey={s} />)}</div>
              </section>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
