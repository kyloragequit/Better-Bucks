import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiUrl } from "@/constants/api";
import { brand } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/Button";

type SurveyQuestion = {
  id: number;
  questionText: string;
  questionType: "text" | "multiple_choice" | "rating";
  options: string[] | null;
  required: boolean;
};

type SurveyDetail = {
  id: number;
  title: string;
  description: string | null;
  bucksReward: number;
  questions: SurveyQuestion[];
  responded: boolean;
};

type SurveySummary = {
  id: number;
  title: string;
  description: string | null;
  bucksReward: number;
  status: string;
  responded: boolean;
  responseCount: number;
};

function SurveyRespond({
  survey,
  onDone,
}: {
  survey: SurveyDetail;
  onDone: () => void;
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  type Answer = {
    questionId: number;
    answerText?: string;
    selectedOption?: number;
  };

  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [submitting, setSubmitting] = useState(false);

  const setAnswer = (questionId: number, update: Partial<Answer>) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], questionId, ...update },
    }));
  };

  const handleSubmit = async () => {
    const requiredMissing = survey.questions.some(
      (q) => q.required && !answers[q.id],
    );
    if (requiredMissing) {
      Alert.alert("Incomplete", "Please answer all required questions.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/mobile/surveys/${survey.id}/respond`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ answers: Object.values(answers) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert("Failed", data?.message ?? "Try again.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["mobile-surveys"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-dashboard"] });
      Alert.alert(
        "Thank you!",
        survey.bucksReward > 0
          ? `You earned ${survey.bucksReward.toLocaleString()} Bucks for completing this survey.`
          : "Your response has been recorded.",
        [{ text: "Done", onPress: onDone }],
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={surveyStyles.root}
      contentContainerStyle={[
        surveyStyles.content,
        { paddingBottom: insets.bottom + 32 },
      ]}
    >
      <TouchableOpacity style={surveyStyles.backRow} onPress={onDone}>
        <Ionicons name="arrow-back" size={18} color={brand.navy} />
        <Text style={surveyStyles.backText}>Back to surveys</Text>
      </TouchableOpacity>

      <Text style={surveyStyles.surveyTitle}>{survey.title}</Text>
      {survey.description ? (
        <Text style={surveyStyles.surveyDesc}>{survey.description}</Text>
      ) : null}
      {survey.bucksReward > 0 ? (
        <View style={surveyStyles.rewardBadge}>
          <Ionicons name="star" size={14} color={brand.green} />
          <Text style={surveyStyles.rewardText}>
            Earn {survey.bucksReward.toLocaleString()} Bucks
          </Text>
        </View>
      ) : null}

      <View style={{ height: 20 }} />

      {survey.questions.map((q, idx) => (
        <QuestionBlock
          key={q.id}
          question={q}
          index={idx + 1}
          answer={answers[q.id]}
          onChange={(update) => setAnswer(q.id, update)}
        />
      ))}

      <Button
        title="Submit"
        onPress={handleSubmit}
        loading={submitting}
        style={{ marginTop: 16 }}
      />
    </ScrollView>
  );
}

function QuestionBlock({
  question,
  index,
  answer,
  onChange,
}: {
  question: SurveyQuestion;
  index: number;
  answer: { questionId: number; answerText?: string; selectedOption?: number } | undefined;
  onChange: (update: { answerText?: string; selectedOption?: number }) => void;
}) {
  if (question.questionType === "multiple_choice" && question.options) {
    return (
      <View style={questionStyles.block}>
        <Text style={questionStyles.text}>
          {index}. {question.questionText}
          {question.required ? <Text style={{ color: brand.danger }}> *</Text> : null}
        </Text>
        {question.options.map((opt, i) => (
          <TouchableOpacity
            key={i}
            style={[
              questionStyles.option,
              answer?.selectedOption === i ? questionStyles.optionSelected : null,
            ]}
            onPress={() => onChange({ selectedOption: i })}
          >
            <View
              style={[
                questionStyles.radio,
                answer?.selectedOption === i ? questionStyles.radioSelected : null,
              ]}
            />
            <Text style={[questionStyles.optionText, answer?.selectedOption === i ? { color: brand.navy } : null]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (question.questionType === "rating") {
    return (
      <View style={questionStyles.block}>
        <Text style={questionStyles.text}>
          {index}. {question.questionText}
          {question.required ? <Text style={{ color: brand.danger }}> *</Text> : null}
        </Text>
        <View style={questionStyles.ratingRow}>
          {[1, 2, 3, 4, 5].map((val) => (
            <TouchableOpacity
              key={val}
              style={[
                questionStyles.ratingBtn,
                answer?.selectedOption === val - 1
                  ? questionStyles.ratingBtnSelected
                  : null,
              ]}
              onPress={() => onChange({ selectedOption: val - 1 })}
            >
              <Text
                style={[
                  questionStyles.ratingBtnText,
                  answer?.selectedOption === val - 1
                    ? questionStyles.ratingBtnTextSelected
                    : null,
                ]}
              >
                {val}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={questionStyles.ratingLabels}>
          <Text style={questionStyles.ratingLabelText}>Poor</Text>
          <Text style={questionStyles.ratingLabelText}>Excellent</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={questionStyles.block}>
      <Text style={questionStyles.text}>
        {index}. {question.questionText}
        {question.required ? <Text style={{ color: brand.danger }}> *</Text> : null}
      </Text>
      <TouchableOpacity
        style={[
          questionStyles.textArea,
          answer?.answerText ? questionStyles.textAreaFilled : null,
        ]}
        onPress={() => {
          Alert.prompt(
            "Your answer",
            question.questionText,
            (text) => {
              if (text !== undefined) onChange({ answerText: text });
            },
            "plain-text",
            answer?.answerText ?? "",
          );
        }}
      >
        <Text
          style={[
            questionStyles.textAreaPlaceholder,
            answer?.answerText ? { color: brand.text } : null,
          ]}
        >
          {answer?.answerText ?? "Tap to write your answer…"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const questionStyles = StyleSheet.create({
  block: {
    marginBottom: 22,
    gap: 10,
  },
  text: {
    color: brand.text,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: brand.border,
    backgroundColor: brand.white,
  },
  optionSelected: {
    borderColor: brand.green,
    backgroundColor: "rgba(46,125,50,0.06)",
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: brand.border,
  },
  radioSelected: {
    borderColor: brand.green,
    backgroundColor: brand.green,
  },
  optionText: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    flex: 1,
  },
  ratingRow: {
    flexDirection: "row",
    gap: 8,
  },
  ratingBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: brand.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brand.white,
  },
  ratingBtnSelected: {
    borderColor: brand.green,
    backgroundColor: "rgba(46,125,50,0.08)",
  },
  ratingBtnText: {
    color: brand.textSecondary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  ratingBtnTextSelected: {
    color: brand.green,
  },
  ratingLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ratingLabelText: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  textArea: {
    borderWidth: 1.5,
    borderColor: brand.border,
    borderRadius: 10,
    padding: 14,
    minHeight: 80,
    backgroundColor: brand.offWhite,
  },
  textAreaFilled: {
    borderColor: brand.green,
    backgroundColor: brand.white,
  },
  textAreaPlaceholder: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
});

const surveyStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.white },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  backText: {
    color: brand.navy,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  surveyTitle: {
    color: brand.text,
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    marginBottom: 8,
  },
  surveyDesc: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(46,125,50,0.08)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(46,125,50,0.20)",
  },
  rewardText: {
    color: brand.green,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
});

export default function SurveysTab() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const { data: surveys = [], isLoading, refetch, isRefetching } = useQuery<SurveySummary[]>({
    queryKey: ["mobile-surveys", token],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/mobile/surveys"), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load surveys");
      return res.json();
    },
    enabled: !!token,
  });

  const [activeDetail, setActiveDetail] = useState<SurveyDetail | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const openSurvey = async (id: number) => {
    setLoadingId(id);
    try {
      const res = await fetch(apiUrl(`/api/mobile/surveys/${id}`), {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to load survey");
      const data = await res.json();
      setActiveDetail(data);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not load survey.");
    } finally {
      setLoadingId(null);
    }
  };

  if (activeDetail) {
    return (
      <SurveyRespond
        survey={activeDetail}
        onDone={() => setActiveDetail(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <View style={listStyles.center}>
        <ActivityIndicator color={brand.green} size="large" />
      </View>
    );
  }

  if (surveys.length === 0) {
    return (
      <View style={listStyles.center}>
        <Ionicons name="document-text-outline" size={48} color={brand.textMuted} />
        <Text style={listStyles.emptyText}>No surveys available</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={surveys}
      keyExtractor={(s) => String(s.id)}
      style={{ backgroundColor: brand.white }}
      contentContainerStyle={[
        { paddingHorizontal: 20, paddingTop: 16 },
        { paddingBottom: insets.bottom + 32 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={brand.green}
        />
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[listStyles.card, item.responded ? listStyles.cardDone : null]}
          onPress={() => !item.responded && openSurvey(item.id)}
          disabled={item.responded || loadingId === item.id}
        >
          <View style={listStyles.cardHeader}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={listStyles.title}>{item.title}</Text>
              {item.description ? (
                <Text style={listStyles.desc} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
            </View>
            {loadingId === item.id ? (
              <ActivityIndicator size="small" color={brand.green} />
            ) : item.responded ? (
              <Ionicons name="checkmark-circle" size={22} color={brand.green} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={brand.textMuted} />
            )}
          </View>
          <View style={listStyles.cardFooter}>
            {item.bucksReward > 0 && !item.responded ? (
              <View style={listStyles.rewardBadge}>
                <Ionicons name="star" size={12} color={brand.green} />
                <Text style={listStyles.rewardText}>
                  +{item.bucksReward.toLocaleString()} Bucks
                </Text>
              </View>
            ) : item.responded ? (
              <Text style={listStyles.completedText}>Completed</Text>
            ) : (
              <Text style={listStyles.noRewardText}>No reward</Text>
            )}
            <Text style={listStyles.responsesText}>
              {item.responseCount} response{item.responseCount !== 1 ? "s" : ""}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const listStyles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: brand.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  emptyText: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  card: {
    backgroundColor: brand.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: brand.border,
    gap: 12,
  },
  cardDone: {
    opacity: 0.65,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    color: brand.text,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  desc: {
    color: brand.textSecondary,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(46,125,50,0.08)",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(46,125,50,0.20)",
  },
  rewardText: {
    color: brand.green,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  completedText: {
    color: brand.green,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  noRewardText: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  responsesText: {
    color: brand.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
});
