import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type SurveyQuestion = {
  id: number;
  questionText: string;
  questionType: "multiple_choice" | "written";
  options: string[] | null;
  orderIndex: number;
};

type Survey = {
  id: number;
  title: string;
  description: string | null;
  status: "draft" | "active" | "closed";
  responseCount: number;
  createdAt: string;
  questions: SurveyQuestion[];
};

type ResultAnswer = { id: number; answerText: string | null; selectedOption: number | null };
type SurveyResults = {
  survey: Survey;
  results: { question: SurveyQuestion; answers: ResultAnswer[]; respondents: number }[];
  respondents: { user: { id: number; fullName: string }; submittedAt: string }[];
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: brand.textMuted },
  active: { label: "Active", color: brand.green },
  closed: { label: "Closed", color: brand.danger },
};

export default function SurveysScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [createModal, setCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [questions, setQuestions] = useState<{ text: string; type: "multiple_choice" | "written"; options: string[] }[]>([
    { text: "", type: "written", options: [] },
  ]);
  const [creating, setCreating] = useState(false);

  const [resultsModal, setResultsModal] = useState(false);
  const [resultsData, setResultsData] = useState<SurveyResults | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  const { data: surveys = [], isLoading, refetch, isRefetching } = useQuery<Survey[]>({
    queryKey: ["mobile-admin-surveys", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/admin/surveys"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load surveys");
      return res.json();
    },
    enabled: !!token,
  });

  const handleStatusChange = (survey: Survey, newStatus: "draft" | "active" | "closed") => {
    Alert.alert(
      `${newStatus === "active" ? "Activate" : newStatus === "closed" ? "Close" : "Set to Draft"} survey?`,
      `Change "${survey.title}" status to ${newStatus}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            const res = await fetch(apiUrl(`/api/mobile/admin/surveys/${survey.id}/status`), {
              method: "PATCH",
              headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
              body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
              queryClient.invalidateQueries({ queryKey: ["mobile-admin-surveys"] });
              refetch();
            } else {
              const d = await res.json().catch(() => ({}));
              Alert.alert("Failed", d?.message ?? "Try again.");
            }
          },
        },
      ],
    );
  };

  const handleDelete = (survey: Survey) => {
    Alert.alert("Delete survey?", `Remove "${survey.title}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const res = await fetch(apiUrl(`/api/mobile/admin/surveys/${survey.id}`), {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token ?? ""}` },
          });
          if (res.ok) {
            queryClient.invalidateQueries({ queryKey: ["mobile-admin-surveys"] });
            refetch();
          } else {
            const d = await res.json().catch(() => ({}));
            Alert.alert("Failed", d?.message ?? "Try again.");
          }
        },
      },
    ]);
  };

  const handleViewResults = async (survey: Survey) => {
    setLoadingResults(true);
    setResultsModal(true);
    try {
      const res = await fetch(apiUrl(`/api/mobile/admin/surveys/${survey.id}/results`), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load results");
      const data = await res.json();
      setResultsData(data);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Network error.");
      setResultsModal(false);
    } finally {
      setLoadingResults(false);
    }
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, { text: "", type: "written", options: [] }]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, field: string, value: string | string[]) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)),
    );
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) { Alert.alert("Required", "Enter a survey title."); return; }
    const validQs = questions.filter((q) => q.text.trim());
    if (validQs.length === 0) { Alert.alert("Required", "Add at least one question."); return; }
    for (const q of validQs) {
      if (q.type === "multiple_choice" && q.options.filter((o) => o.trim()).length < 2) {
        Alert.alert("Invalid", "Multiple choice questions need at least 2 options.");
        return;
      }
    }
    setCreating(true);
    try {
      const res = await fetch(apiUrl("/api/mobile/admin/surveys"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim() || null,
          questions: validQs.map((q, i) => ({
            questionText: q.text.trim(),
            questionType: q.type,
            options: q.type === "multiple_choice" ? q.options.filter((o) => o.trim()) : null,
            orderIndex: i,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { Alert.alert("Failed", data?.message ?? "Try again."); return; }
      setCreateModal(false);
      setNewTitle(""); setNewDesc("");
      setQuestions([{ text: "", type: "written", options: [] }]);
      queryClient.invalidateQueries({ queryKey: ["mobile-admin-surveys"] });
      refetch();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Network error.");
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={brand.green} size="large" />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={surveys}
        keyExtractor={(s) => String(s.id)}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={brand.green} />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 80 },
          surveys.length === 0 && styles.center,
        ]}
        ListEmptyComponent={
          <View style={{ alignItems: "center", gap: 12 }}>
            <Ionicons name="document-text-outline" size={48} color={brand.textMuted} />
            <Text style={styles.emptyTitle}>No surveys yet</Text>
            <Text style={styles.emptySubtitle}>Create your first survey below.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const cfg = STATUS_CONFIG[item.status];
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.surveyTitle}>{item.title}</Text>
                  {item.description ? (
                    <Text style={styles.surveyDesc} numberOfLines={2}>{item.description}</Text>
                  ) : null}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${cfg.color}15` }]}>
                  <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>

              <View style={styles.meta}>
                <Ionicons name="help-circle-outline" size={13} color={brand.textMuted} />
                <Text style={styles.metaText}>{item.questions?.length ?? 0} question{item.questions?.length !== 1 ? "s" : ""}</Text>
                <Ionicons name="people-outline" size={13} color={brand.textMuted} style={{ marginLeft: 10 }} />
                <Text style={styles.metaText}>{item.responseCount} response{item.responseCount !== 1 ? "s" : ""}</Text>
              </View>

              <View style={styles.cardActions}>
                {item.status === "draft" && (
                  <TouchableOpacity style={styles.actionChip} onPress={() => handleStatusChange(item, "active")}>
                    <Ionicons name="play" size={13} color={brand.green} />
                    <Text style={styles.actionChipText}>Activate</Text>
                  </TouchableOpacity>
                )}
                {item.status === "active" && (
                  <TouchableOpacity style={[styles.actionChip, { backgroundColor: "rgba(198,40,40,0.08)" }]} onPress={() => handleStatusChange(item, "closed")}>
                    <Ionicons name="stop" size={13} color={brand.danger} />
                    <Text style={[styles.actionChipText, { color: brand.danger }]}>Close</Text>
                  </TouchableOpacity>
                )}
                {item.responseCount > 0 && (
                  <TouchableOpacity style={[styles.actionChip, { backgroundColor: "rgba(21,101,192,0.08)" }]} onPress={() => handleViewResults(item)}>
                    <Ionicons name="bar-chart-outline" size={13} color="#1565C0" />
                    <Text style={[styles.actionChipText, { color: "#1565C0" }]}>Results</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.actionChip, { backgroundColor: "rgba(198,40,40,0.08)" }]} onPress={() => handleDelete(item)}>
                  <Ionicons name="trash-outline" size={13} color={brand.danger} />
                  <Text style={[styles.actionChipText, { color: brand.danger }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => setCreateModal(true)}
      >
        <Ionicons name="add" size={28} color={brand.white} />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={createModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setCreateModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCreateModal(false)} hitSlop={12}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Survey</Text>
            <TouchableOpacity onPress={handleCreate} disabled={creating} hitSlop={12}>
              <Text style={[styles.modalSave, creating && { opacity: 0.5 }]}>
                {creating ? "Creating…" : "Create"}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.textInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="e.g. Monthly Satisfaction Check"
              placeholderTextColor={brand.textMuted}
            />
            <Text style={styles.fieldLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.textInput, { minHeight: 60, textAlignVertical: "top" }]}
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="Tell employees what this is about…"
              placeholderTextColor={brand.textMuted}
              multiline
            />

            <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Questions</Text>
            {questions.map((q, idx) => (
              <View key={idx} style={styles.questionBlock}>
                <View style={styles.questionHeader}>
                  <Text style={styles.questionNum}>Q{idx + 1}</Text>
                  {questions.length > 1 && (
                    <TouchableOpacity onPress={() => removeQuestion(idx)} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={brand.danger} />
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={styles.textInput}
                  value={q.text}
                  onChangeText={(v) => updateQuestion(idx, "text", v)}
                  placeholder="Question text…"
                  placeholderTextColor={brand.textMuted}
                />
                <View style={styles.typeToggle}>
                  {(["written", "multiple_choice"] as const).map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeBtn, q.type === t && styles.typeBtnActive]}
                      onPress={() => updateQuestion(idx, "type", t)}
                    >
                      <Text style={[styles.typeBtnText, q.type === t && styles.typeBtnTextActive]}>
                        {t === "written" ? "Written" : "Multiple Choice"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {q.type === "multiple_choice" && (
                  <View style={{ gap: 6, marginTop: 4 }}>
                    {q.options.map((opt, oi) => (
                      <View key={oi} style={styles.optionRow}>
                        <TextInput
                          style={[styles.textInput, { flex: 1 }]}
                          value={opt}
                          onChangeText={(v) => {
                            const newOpts = [...q.options];
                            newOpts[oi] = v;
                            updateQuestion(idx, "options", newOpts);
                          }}
                          placeholder={`Option ${oi + 1}`}
                          placeholderTextColor={brand.textMuted}
                        />
                        {q.options.length > 2 && (
                          <TouchableOpacity onPress={() => {
                            const newOpts = q.options.filter((_, i) => i !== oi);
                            updateQuestion(idx, "options", newOpts);
                          }} hitSlop={8}>
                            <Ionicons name="close-circle" size={18} color={brand.danger} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                    <TouchableOpacity
                      style={styles.addOptionBtn}
                      onPress={() => updateQuestion(idx, "options", [...q.options, ""])}
                    >
                      <Ionicons name="add" size={16} color={brand.navy} />
                      <Text style={styles.addOptionText}>Add option</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity style={styles.addQuestionBtn} onPress={addQuestion}>
              <Ionicons name="add-circle-outline" size={18} color={brand.navy} />
              <Text style={styles.addQuestionText}>Add Question</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Results Modal */}
      <Modal visible={resultsModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setResultsModal(false)}>
        <View style={styles.modalHeader}>
          <View style={{ width: 60 }} />
          <Text style={styles.modalTitle}>Survey Results</Text>
          <TouchableOpacity onPress={() => setResultsModal(false)} hitSlop={12} style={{ width: 60, alignItems: "flex-end" }}>
            <Text style={styles.modalCancel}>Close</Text>
          </TouchableOpacity>
        </View>
        {loadingResults ? (
          <View style={styles.center}>
            <ActivityIndicator color={brand.green} size="large" />
          </View>
        ) : resultsData ? (
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Text style={styles.resultsTitle}>{resultsData.survey.title}</Text>
            <Text style={styles.resultsCount}>{resultsData.respondents.length} respondents</Text>
            {resultsData.results.map((r, i) => (
              <View key={i} style={styles.resultBlock}>
                <Text style={styles.resultQuestion}>Q{i + 1}: {r.question.questionText}</Text>
                {r.question.questionType === "multiple_choice" && r.question.options ? (
                  r.question.options.map((opt, oi) => {
                    const count = r.answers.filter((a) => a.selectedOption === oi).length;
                    const pct = r.respondents > 0 ? Math.round((count / r.respondents) * 100) : 0;
                    return (
                      <View key={oi} style={styles.resultOption}>
                        <View style={styles.resultOptionHeader}>
                          <Text style={styles.resultOptionText}>{opt}</Text>
                          <Text style={styles.resultOptionPct}>{count} ({pct}%)</Text>
                        </View>
                        <View style={styles.resultBar}>
                          <View style={[styles.resultBarFill, { width: `${pct}%` as any }]} />
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={{ gap: 6 }}>
                    {r.answers.filter((a) => a.answerText?.trim()).slice(0, 10).map((a, ai) => (
                      <View key={ai} style={styles.resultWritten}>
                        <Text style={styles.resultWrittenText}>{a.answerText}</Text>
                      </View>
                    ))}
                    {r.answers.filter((a) => a.answerText?.trim()).length > 10 && (
                      <Text style={styles.moreText}>+{r.answers.filter((a) => a.answerText?.trim()).length - 10} more responses</Text>
                    )}
                    {r.answers.filter((a) => a.answerText?.trim()).length === 0 && (
                      <Text style={styles.metaText}>No written responses yet.</Text>
                    )}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16, gap: 12 },
  card: {
    backgroundColor: brand.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: brand.border,
    gap: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  surveyTitle: { color: brand.text, fontFamily: "Inter_600SemiBold", fontSize: 15, marginBottom: 2 },
  surveyDesc: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 13 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 12 },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(46,125,50,0.08)",
  },
  actionChipText: { color: brand.green, fontFamily: "Inter_500Medium", fontSize: 13 },
  emptyTitle: { color: brand.text, fontFamily: "Inter_600SemiBold", fontSize: 17 },
  emptySubtitle: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 14 },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: brand.green,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: brand.border,
    backgroundColor: brand.white,
  },
  modalTitle: { color: brand.text, fontFamily: "Inter_600SemiBold", fontSize: 17 },
  modalCancel: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 16 },
  modalSave: { color: brand.green, fontFamily: "Inter_600SemiBold", fontSize: 16 },
  modalBody: { padding: 20, gap: 16 },
  fieldLabel: { color: brand.textSecondary, fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 6 },
  textInput: {
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: brand.text,
    backgroundColor: brand.white,
  },
  questionBlock: {
    backgroundColor: brand.offWhite,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: brand.border,
    gap: 10,
  },
  questionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  questionNum: { color: brand.navy, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  typeToggle: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.white,
  },
  typeBtnActive: { backgroundColor: brand.navy, borderColor: brand.navy },
  typeBtnText: { color: brand.textSecondary, fontFamily: "Inter_500Medium", fontSize: 13 },
  typeBtnTextActive: { color: brand.white },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  addOptionText: { color: brand.navy, fontFamily: "Inter_500Medium", fontSize: 14 },
  addQuestionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: brand.navy,
    borderStyle: "dashed",
  },
  addQuestionText: { color: brand.navy, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  // Results
  resultsTitle: { color: brand.text, fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 4 },
  resultsCount: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 14, marginBottom: 8 },
  resultBlock: {
    backgroundColor: brand.offWhite,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: brand.border,
  },
  resultQuestion: { color: brand.text, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  resultOption: { gap: 4 },
  resultOptionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultOptionText: { color: brand.textSecondary, fontFamily: "Inter_400Regular", fontSize: 13, flex: 1 },
  resultOptionPct: { color: brand.textMuted, fontFamily: "Inter_500Medium", fontSize: 12 },
  resultBar: { height: 6, backgroundColor: brand.border, borderRadius: 3, overflow: "hidden" },
  resultBarFill: { height: "100%", backgroundColor: brand.green, borderRadius: 3 },
  resultWritten: {
    backgroundColor: brand.white,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: brand.border,
  },
  resultWrittenText: { color: brand.text, fontFamily: "Inter_400Regular", fontSize: 13 },
  moreText: { color: brand.textMuted, fontFamily: "Inter_400Regular", fontSize: 12 },
});
