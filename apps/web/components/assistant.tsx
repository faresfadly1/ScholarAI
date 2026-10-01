"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Sparkles, Quote, LoaderCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/types";
import { Button } from "./ui/button";
import { ErrorState, Loading } from "./ui/common";
export function Assistant({ analysisId }: { analysisId: string }) {
  const client = useQueryClient(),
    [message, setMessage] = useState("");
  const q = useQuery({
    queryKey: ["chat", analysisId],
    queryFn: () => api<ChatMessage[]>(`/analyses/${analysisId}/chat`),
    refetchInterval: (query) =>
      query.state.data?.some((m) => m.data.status === "Processing") ? 1500 : false,
  });
  const send = useMutation({
    mutationFn: (text: string) =>
      api(`/analyses/${analysisId}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: text }),
      }),
    onSuccess: () => {
      setMessage("");
      client.invalidateQueries({ queryKey: ["chat", analysisId] });
    },
  });
  return (
    <section className="panel assistant-panel">
      <div className="assistant-intro">
        <span className="assistant-icon">
          <Sparkles size={25} />
        </span>
        <h2>A little guidance, grounded in your evidence.</h2>
        <p>Ask about requirements, missing documents, or your next steps.</p>
      </div>
      {!q.data?.length && (
        <div className="question-suggestions">
          {[
            "Does my TOEFL satisfy this program?",
            "What documents am I missing?",
            "What should I improve first?",
            "Why is my research score low?",
          ].map((s) => (
            <button key={s} onClick={() => send.mutate(s)} disabled={send.isPending}>
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="chat-messages" aria-live="polite">
        {q.isLoading ? (
          <Loading />
        ) : q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : (
          q.data?.map((m) => (
            <div className="chat-pair" key={m.id}>
              <div className="chat-user">{m.data.question}</div>
              <div className="chat-answer">
                <Sparkles size={18} />
                <div>
                  {m.data.status === "Processing" ? (
                    <p>
                      <LoaderCircle size={15} className="spin" /> Reviewing your evidence…
                    </p>
                  ) : (
                    <>
                      <p>{m.data.answer}</p>
                      {m.data.sources?.length ? (
                        <details className="chat-sources">
                          <summary>
                            <Quote size={14} /> {m.data.sources.length} supporting sources
                          </summary>
                          {m.data.sources.map((s) => (
                            <div key={s.id}>
                              <strong>{s.title}</strong>
                              <blockquote>{s.requirement || s.text}</blockquote>
                              {s.evidence?.map((e, i) => (
                                <p key={i}>
                                  {e.source}
                                  {e.page ? ` · Page ${e.page}` : ""}: {e.snippet}
                                </p>
                              ))}
                            </div>
                          ))}
                        </details>
                      ) : null}
                      <span className="chat-mode">{m.data.mode}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {send.error && <p className="error-message">{send.error.message}</p>}
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          if (message.trim()) send.mutate(message);
        }}
      >
        <input
          aria-label="Ask your application assistant"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          placeholder="Ask a question about your application…"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send question"
          disabled={send.isPending || !message.trim()}
        >
          <Send size={18} />
        </Button>
      </form>
      <p className="chat-footnote">
        Answers use your saved analysis and cited sources. Always confirm requirements with the
        scholarship provider.
      </p>
    </section>
  );
}
