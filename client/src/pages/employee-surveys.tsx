import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmployeeLayout } from "@/components/layout-employee";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ClipboardList, CheckCircle2, ChevronRight, Target } from "lucide-react";
import type { Survey, SurveyQuestion } from "@shared/schema";

type Goal = { id: number; title: string; type: string; status: string };
type SurveyWithMeta = Survey & { questions: SurveyQuestion[]; responseCount: number; responded?: boolean; linkedGoalId?: number | null };

function SurveyTakeModal({
  survey,
  onClose,
}: {
  survey: SurveyWithMeta;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<number, { selectedOption?: number; answerText?: string }>>({});

  const mutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/surveys/${survey.id}/respond`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/surveys"] });
      qc.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({ title: "Response submitted!", description: "Thank you for your feedback." });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleSubmit() {
    const payload = survey.questions.map(q => ({
      questionId: q.id,
      ...(answers[q.id] || {}),
    }));
    mutation.mutate({ answers: payload });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8 px-4">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-xl" data-testid="survey-take-modal">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold">{survey.title}</h2>
          {survey.description && <p className="text-sm text-muted-foreground mt-1">{survey.description}</p>}
        </div>
        <div className="p-6 space-y-6">
          {survey.questions.map((q, i) => (
            <div key={q.id} className="space-y-3" data-testid={`survey-question-${q.id}`}>
              <p className="font-medium text-sm">
                {i + 1}. {q.questionText}
              </p>
              {q.questionType === "multiple_choice" && q.options ? (
                <RadioGroup
                  value={answers[q.id]?.selectedOption?.toString() ?? ""}
                  onValueChange={v => setAnswers(a => ({ ...a, [q.id]: { selectedOption: Number(v) } }))}
                  data-testid={`radio-group-${q.id}`}
                >
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center space-x-2">
                      <RadioGroupItem value={oi.toString()} id={`q${q.id}-o${oi}`} data-testid={`radio-option-${q.id}-${oi}`} />
                      <Label htmlFor={`q${q.id}-o${oi}`} className="cursor-pointer font-normal">{opt}</Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <Textarea
                  value={answers[q.id]?.answerText ?? ""}
                  onChange={e => setAnswers(a => ({ ...a, [q.id]: { answerText: e.target.value } }))}
                  placeholder="Your answer…"
                  rows={3}
                  data-testid={`textarea-answer-${q.id}`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="p-6 border-t flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-survey">Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending} data-testid="button-submit-survey">
            {mutation.isPending ? "Submitting…" : "Submit Response"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeSurveysPage() {
  const [taking, setTaking] = useState<SurveyWithMeta | null>(null);
  const { data: surveys = [], isLoading } = useQuery<SurveyWithMeta[]>({
    queryKey: ["/api/surveys"],
  });
  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["/api/goals"],
  });
  const goalMap: Record<number, Goal> = {};
  for (const g of goals) goalMap[g.id] = g;

  const activeSurveys = surveys.filter(s => s.status === "active");

  return (
    <EmployeeLayout>
      {taking && <SurveyTakeModal survey={taking} onClose={() => setTaking(null)} />}
      <div className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" /> Surveys
        </h1>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading surveys…</div>
        ) : activeSurveys.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No active surveys right now.</p>
            <p className="text-sm mt-1">Check back later — your admin may publish one soon.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeSurveys.map(survey => {
              const responded = (survey as any).responded;
              const linkedGoal = survey.linkedGoalId ? goalMap[survey.linkedGoalId] : null;
              return (
                <Card key={survey.id} data-testid={`card-survey-${survey.id}`} className={responded ? "opacity-70" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base">{survey.title}</CardTitle>
                          {responded && (
                            <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Completed
                            </Badge>
                          )}
                        </div>
                        {survey.description && <p className="text-sm text-muted-foreground mt-1">{survey.description}</p>}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <p className="text-xs text-muted-foreground">{survey.questions.length} question{survey.questions.length !== 1 ? "s" : ""}</p>
                          {linkedGoal && (
                            <span className="text-xs flex items-center gap-1 text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5" data-testid={`badge-goal-survey-${survey.id}`}>
                              <Target className="h-3 w-3" /> Contributes to: <strong>{linkedGoal.title}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                      {!responded && (
                        <Button size="sm" onClick={() => setTaking(survey)} data-testid={`button-take-survey-${survey.id}`}>
                          Take Survey <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  {responded && (
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">You have already submitted a response to this survey.</p>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
}
