import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MessageCircle, X, Send, ThumbsUp, ThumbsDown, Check, RotateCcw } from "lucide-react";
import { useChatbotPreload } from "./useChatbotPreload";
import { ChatbotService } from "./chatbot.service";
import type { ChatbotAnswer } from "./chatbot.service";

const QWALL_ROUTE_PREFIXES = ["/quality/qwall", "/quality/rejections"];
const TYPING_DELAY_MS = 550;

type TabKey = "faq" | "historial" | "feedback";

interface AskedEntry {
  question_key: string;
  question: string;
  answer?: string;
  askedAt: number;
}

export default function ChatbotWidget() {
  const location = useLocation();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("faq");
  const [askedHistory, setAskedHistory] = useState<AskedEntry[]>([]);
  const [ratedKeys, setRatedKeys] = useState<Set<string>>(new Set());
  const [typingQuestionKey, setTypingQuestionKey] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isQWallRoute = QWALL_ROUTE_PREFIXES.some((prefix) =>
    location.pathname.startsWith(prefix)
  );

  const { data, isLoading, isError } = useChatbotPreload("qwall", isQWallRoute);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!isQWallRoute) return null;

  const handleAsk = (item: ChatbotAnswer) => {
    setTypingQuestionKey(item.question_key);
    window.setTimeout(() => {
      setAskedHistory((prev) => [
        ...prev,
        {
          question_key: item.question_key,
          question: item.question,
          answer: item.answer,
          askedAt: Date.now(),
        },
      ]);
      setTypingQuestionKey(null);
    }, TYPING_DELAY_MS);
  };

  const handleRate = async (questionKey: string, wasHelpful: boolean) => {
    setRatedKeys((prev) => new Set(prev).add(questionKey));
    try {
      await ChatbotService.submitFeedback(questionKey, wasHelpful);
    } catch {
      // Fallo de red silencioso — ver nota en versión anterior.
    }
  };

  const handleReset = () => {
    setAskedHistory([]);
    setRatedKeys(new Set());
    setTypingQuestionKey(null);
  };

  const askedKeys = new Set(askedHistory.map((h) => h.question_key));
  const pendingQuestions = (data?.items ?? []).filter(
    (item) => !askedKeys.has(item.question_key) && item.question_key !== typingQuestionKey
  );

  return (
    <>
      <button
        style={styles.floatingButton}
        onClick={() => setIsOpen((v) => !v)}
        aria-label={t("chatbot.open", "Asistente Q-Wall")}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {isOpen && (
        <div ref={panelRef} style={styles.panel}>
          <div style={styles.header}>
            <span style={styles.headerTitle}>
              {t("chatbot.title", "Asistente Q-Wall")}
            </span>
            <div style={styles.headerActions}>
              {askedHistory.length > 0 && (
                <button
                  style={styles.resetBtn}
                  onClick={handleReset}
                  aria-label={t("chatbot.reset", "Reiniciar conversación")}
                  title={t("chatbot.reset", "Reiniciar conversación")}
                >
                  <RotateCcw size={15} />
                </button>
              )}
              <button style={styles.closeBtn} onClick={() => setIsOpen(false)}>
                <X size={16} />
              </button>
            </div>
          </div>

          <div style={styles.tabBar}>
            {(["faq", "historial", "feedback"] as TabKey[]).map((tab) => (
              <button
                key={tab}
                style={{
                  ...styles.tabBtn,
                  ...(activeTab === tab ? styles.tabBtnActive : {}),
                }}
                onClick={() => setActiveTab(tab)}
              >
                {t(`chatbot.tabs.${tab}`, tab)}
              </button>
            ))}
          </div>

          <div style={styles.content}>
            {activeTab === "faq" && (
              <ChatTab
                askedHistory={askedHistory}
                pendingQuestions={pendingQuestions}
                isLoading={isLoading}
                isError={isError}
                ratedKeys={ratedKeys}
                typingQuestionKey={typingQuestionKey}
                onAsk={handleAsk}
                onRate={handleRate}
              />
            )}
            {activeTab === "historial" && (
              <HistorialTab askedHistory={askedHistory} />
            )}
            {activeTab === "feedback" && <SuggestionTab />}
          </div>
        </div>
      )}
    </>
  );
}

function ChatTab({
  askedHistory,
  pendingQuestions,
  isLoading,
  isError,
  ratedKeys,
  typingQuestionKey,
  onAsk,
  onRate,
}: {
  askedHistory: AskedEntry[];
  pendingQuestions: ChatbotAnswer[];
  isLoading: boolean;
  isError: boolean;
  ratedKeys: Set<string>;
  typingQuestionKey: string | null;
  onAsk: (item: ChatbotAnswer) => void;
  onRate: (questionKey: string, wasHelpful: boolean) => void;
}) {
  const { t } = useTranslation();
  const feedEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [askedHistory.length, typingQuestionKey]);

  const typingQuestionText = typingQuestionKey
    ? pendingQuestions.find((q) => q.question_key === typingQuestionKey)?.question
    : null;

  return (
    <div style={styles.chatContainer}>
      <div style={styles.chatFeed}>
        {askedHistory.length === 0 && !typingQuestionKey && (
          <div style={styles.emptyState}>
            {t("chatbot.startPrompt", "Selecciona una pregunta para comenzar.")}
          </div>
        )}
        {askedHistory.map((entry, idx) => (
          <div key={`${entry.question_key}-${idx}`} style={styles.chatEntry}>
            <div style={styles.chatBubbleQuestion}>{entry.question}</div>
            <div style={styles.chatBubbleAnswer}>{entry.answer}</div>
            <FeedbackRow
              questionKey={entry.question_key}
              rated={ratedKeys.has(entry.question_key)}
              onRate={onRate}
            />
          </div>
        ))}
        {typingQuestionKey && (
          <div style={styles.chatEntry}>
            <div style={styles.chatBubbleQuestion}>{typingQuestionText}</div>
            <div style={styles.typingBubble}>
              <span style={styles.typingDot} />
              <span style={{ ...styles.typingDot, animationDelay: "0.15s" }} />
              <span style={{ ...styles.typingDot, animationDelay: "0.3s" }} />
            </div>
          </div>
        )}
        <div ref={feedEndRef} />
      </div>

      <div style={styles.suggestedWrap}>
        {isLoading && (
          <div style={styles.emptyState}>{t("chatbot.loading", "Cargando...")}</div>
        )}
        {isError && (
          <div style={styles.emptyState}>
            {t("chatbot.error", "No se pudo cargar la información en este momento.")}
          </div>
        )}
        {!isLoading && !isError && pendingQuestions.length === 0 && askedHistory.length === 0 && !typingQuestionKey && (
          <div style={styles.emptyState}>
            {t("chatbot.empty", "No hay preguntas disponibles.")}
          </div>
        )}
        <div style={styles.chipList}>
          {pendingQuestions.map((item) => (
            <button
              key={item.question_key}
              style={styles.chip}
              onClick={() => onAsk(item)}
              disabled={typingQuestionKey !== null}
            >
              <Send size={12} style={{ marginRight: "6px", flexShrink: 0 }} />
              {item.question}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeedbackRow({
  questionKey,
  rated,
  onRate,
}: {
  questionKey: string;
  rated: boolean;
  onRate: (questionKey: string, wasHelpful: boolean) => void;
}) {
  const { t } = useTranslation();

  if (rated) {
    return (
      <div style={styles.feedbackRowDone}>
        <Check size={12} />
        <span>{t("chatbot.feedbackThanks", "Gracias por tu retroalimentación")}</span>
      </div>
    );
  }

  return (
    <div style={styles.feedbackRow}>
      <span style={styles.feedbackLabel}>
        {t("chatbot.wasHelpful", "¿Te sirvió esta respuesta?")}
      </span>
      <button
        style={styles.feedbackBtn}
        onClick={() => onRate(questionKey, true)}
        aria-label={t("chatbot.helpful", "Sí")}
      >
        <ThumbsUp size={14} />
      </button>
      <button
        style={styles.feedbackBtn}
        onClick={() => onRate(questionKey, false)}
        aria-label={t("chatbot.notHelpful", "No")}
      >
        <ThumbsDown size={14} />
      </button>
    </div>
  );
}

function HistorialTab({ askedHistory }: { askedHistory: AskedEntry[] }) {
  const { t } = useTranslation();

  if (askedHistory.length === 0) {
    return (
      <div style={styles.emptyState}>
        {t("chatbot.noHistory", "Aún no has hecho preguntas en esta sesión.")}
      </div>
    );
  }

  return (
    <div style={styles.faqList}>
      {askedHistory.map((entry, idx) => (
        <div key={`${entry.question_key}-${idx}`} style={styles.faqItem}>
          <div style={styles.faqQuestion}>{entry.question}</div>
          <div style={styles.faqAnswer}>{entry.answer}</div>
        </div>
      ))}
    </div>
  );
}

function SuggestionTab() {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setStatus("sending");
    try {
      await ChatbotService.submitSuggestion("qwall", text.trim());
      setStatus("sent");
      setText("");
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div style={styles.emptyState}>
        {t("chatbot.suggestionSent", "¡Gracias! Tu sugerencia fue enviada.")}
      </div>
    );
  }

  return (
    <div style={styles.suggestionForm}>
      <label style={styles.suggestionLabel}>
        {t("chatbot.suggestionPrompt", "¿Qué te gustaría poder preguntarle al asistente?")}
      </label>
      <textarea
        style={styles.suggestionTextarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={t("chatbot.suggestionPlaceholder", "Escribe tu idea aquí...")}
      />
      {status === "error" && (
        <div style={styles.suggestionError}>
          {t("chatbot.suggestionError", "No se pudo enviar. Intenta de nuevo.")}
        </div>
      )}
      <button
        style={styles.suggestionSubmitBtn}
        onClick={handleSubmit}
        disabled={!text.trim() || status === "sending"}
      >
        {status === "sending"
          ? t("chatbot.sending", "Enviando...")
          : t("chatbot.send", "Enviar")}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  floatingButton: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    backgroundColor: "var(--color-primary)",
    color: "#ffffff",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
    zIndex: 1000,
  },
  panel: {
    position: "fixed",
    bottom: "92px",
    right: "24px",
    width: "380px",
    maxHeight: "min(560px, 70vh)",
    backgroundColor: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    zIndex: 1000,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.75rem 1rem",
    borderBottom: "1px solid var(--color-border)",
  },
  headerTitle: {
    fontWeight: 700,
    fontSize: "0.95rem",
    color: "var(--color-text-primary)",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
  },
  resetBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--color-text-secondary)",
    display: "flex",
    alignItems: "center",
    padding: "4px",
    borderRadius: "var(--radius-sm)",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--color-text-secondary)",
    display: "flex",
    alignItems: "center",
    padding: "4px",
    borderRadius: "var(--radius-sm)",
  },
  tabBar: {
    display: "flex",
    borderBottom: "1px solid var(--color-border)",
  },
  tabBtn: {
    flex: 1,
    padding: "0.625rem",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "var(--color-text-secondary)",
    borderBottom: "2px solid transparent",
  },
  tabBtnActive: {
    color: "var(--color-primary)",
    borderBottomColor: "var(--color-primary)",
  },
  content: {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  chatContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  chatFeed: {
    flex: 1,
    overflowY: "auto",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  chatEntry: {
    display: "flex",
    flexDirection: "column",
    gap: "0.375rem",
  },
  chatBubbleQuestion: {
    alignSelf: "flex-end",
    backgroundColor: "var(--color-primary)",
    color: "#ffffff",
    padding: "0.5rem 0.75rem",
    borderRadius: "var(--radius-md) var(--radius-md) 2px var(--radius-md)",
    fontSize: "0.825rem",
    maxWidth: "85%",
  },
  chatBubbleAnswer: {
    alignSelf: "flex-start",
    backgroundColor: "var(--color-bg)",
    color: "var(--color-text-primary)",
    border: "1px solid var(--color-border)",
    padding: "0.5rem 0.75rem",
    borderRadius: "var(--radius-md) var(--radius-md) var(--radius-md) 2px",
    fontSize: "0.825rem",
    maxWidth: "85%",
    lineHeight: 1.5,
  },
  typingBubble: {
    alignSelf: "flex-start",
    backgroundColor: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    padding: "0.625rem 0.875rem",
    borderRadius: "var(--radius-md) var(--radius-md) var(--radius-md) 2px",
    display: "flex",
    gap: "4px",
    alignItems: "center",
  },
  typingDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: "var(--color-text-secondary)",
    animation: "chatbotTypingBounce 1s infinite ease-in-out",
    display: "inline-block",
  },
  feedbackRow: {
    alignSelf: "flex-start",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginTop: "2px",
  },
  feedbackRowDone: {
    alignSelf: "flex-start",
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    color: "var(--color-text-secondary)",
    fontSize: "0.7rem",
    marginTop: "2px",
  },
  feedbackLabel: {
    fontSize: "0.7rem",
    color: "var(--color-text-secondary)",
  },
  feedbackBtn: {
    background: "transparent",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    color: "var(--color-text-secondary)",
    display: "flex",
    alignItems: "center",
    padding: "3px 6px",
  },
  suggestedWrap: {
    borderTop: "1px solid var(--color-border)",
    padding: "0.75rem 1rem",
    maxHeight: "95px",
    overflowY: "auto",
  },
  chipList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  chip: {
    display: "flex",
    alignItems: "center",
    textAlign: "left",
    padding: "0.5rem 0.75rem",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)",
    backgroundColor: "var(--color-surface)",
    color: "var(--color-text-primary)",
    fontSize: "0.8rem",
    cursor: "pointer",
  },
  emptyState: {
    textAlign: "center",
    padding: "2rem 1rem",
    color: "var(--color-text-secondary)",
    fontSize: "0.875rem",
  },
  faqList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.875rem",
    padding: "1rem",
    overflowY: "auto",
  },
  faqItem: {
    padding: "0.75rem",
    backgroundColor: "var(--color-bg)",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)",
  },
  faqQuestion: {
    fontWeight: 700,
    fontSize: "0.85rem",
    color: "var(--color-text-primary)",
    marginBottom: "0.375rem",
  },
  faqAnswer: {
    fontSize: "0.825rem",
    color: "var(--color-text-secondary)",
    lineHeight: 1.5,
  },
  suggestionForm: {
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  suggestionLabel: {
    fontSize: "0.825rem",
    fontWeight: 600,
    color: "var(--color-text-primary)",
  },
  suggestionTextarea: {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "0.625rem",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)",
    backgroundColor: "var(--color-bg)",
    color: "var(--color-text-primary)",
    fontSize: "0.825rem",
    fontFamily: "inherit",
    resize: "vertical" as const,
  },
  suggestionError: {
    fontSize: "0.75rem",
    color: "#ef4444",
  },
  suggestionSubmitBtn: {
    alignSelf: "flex-end",
    padding: "0.5rem 1.25rem",
    borderRadius: "var(--radius-md)",
    border: "none",
    backgroundColor: "var(--color-primary)",
    color: "#ffffff",
    fontSize: "0.825rem",
    fontWeight: 600,
    cursor: "pointer",
  },
};