import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Maximize2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import almailLogo from "@/assets/almail-ai-logo-white.png";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function Chatbot() {
  const { lang, tr } = useI18n();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  const typeOut = (full: string) => {
    return new Promise<void>((resolve) => {
      let i = 0;
      setMsgs((m) => [...m, { role: "assistant", content: "" }]);
      const step = () => {
        i = Math.min(full.length, i + Math.max(1, Math.round(full.length / 80)));
        setMsgs((m) => {
          const next = [...m];
          next[next.length - 1] = { role: "assistant", content: full.slice(0, i) };
          return next;
        });
        if (i < full.length) setTimeout(step, 22);
        else resolve();
      };
      setTimeout(step, 250);
    });
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const history = [...msgs, { role: "user" as const, content: text }];
    setMsgs(history);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: { messages: history },
      });
      if (error) throw error;
      const reply: string =
        data?.reply ||
        (lang === "ar"
          ? "عذراً، لم أتمكن من الرد. يرجى التواصل على ٩٤٠٤٠٩٥٥ ٩٦٥+ أو sales@bizarri.com."
          : "Sorry, I couldn't respond. Please reach us on +965 94040955 or sales@bizarri.com.");
      setLoading(false);
      await typeOut(reply);
    } catch {
      setLoading(false);
      await typeOut(
        lang === "ar"
          ? "حدث خطأ. للمزيد، يرجى التواصل على ٩٤٠٤٠٩٥٥ ٩٦٥+ أو sales@bizarri.com."
          : "Something went wrong. For more information, please contact us on +965 94040955 or sales@bizarri.com.",
      );
    }
  };

  const panelClass =
    "fixed bottom-24 right-4 z-40 w-[88vw] max-w-[340px] h-[60vh] max-h-[460px] bg-background border border-border shadow-luxe flex flex-col animate-scale-in";

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-black text-white shadow-luxe flex items-center justify-center hover:scale-105 transition-transform"
        aria-label="Open chat"
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </button>

      {open && (
        <div className={panelClass}>
          <div className="px-4 py-3 bg-black text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <img src={almailLogo} alt="Almail AI" className="h-6 w-auto" />
              <p className="text-[11px] tracking-[0.25em] uppercase">{tr("chatTitle")}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/almail-ai"
                onClick={() => setOpen(false)}
                aria-label="Open full page"
                className="opacity-80 hover:opacity-100"
              >
                <Maximize2 className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="opacity-80 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
            {msgs.length === 0 && (
              <div className="text-muted-foreground text-center pt-8 px-4">
                <img
                  src={almailLogo}
                  alt=""
                  className="h-8 w-auto mx-auto mb-3 opacity-70 invert"
                />
                <p>{tr("chatGreet")}</p>
              </div>
            )}
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] px-4 py-2.5 leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-black text-white" : "bg-secondary"}`}
                >
                  {m.content || <TypingDots />}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-secondary px-4 py-3">
                  <TypingDots />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-2.5 flex gap-2 shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={tr("chatPlaceholder")}
              className="flex-1 px-3 py-2 text-sm bg-secondary outline-none"
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={loading}
              className="px-3 bg-black text-white disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center py-1">
      <span
        className="w-1.5 h-1.5 bg-foreground/60 rounded-full animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-1.5 h-1.5 bg-foreground/60 rounded-full animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-1.5 h-1.5 bg-foreground/60 rounded-full animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </span>
  );
}
