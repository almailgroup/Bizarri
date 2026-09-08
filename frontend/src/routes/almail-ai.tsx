import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Image as ImageIcon, MessageCircle } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import almailLogo from "@/assets/almail-ai-logo-white.png";

export const Route = createFileRoute("/almail-ai")({
  component: AlmailAIPage,
});

interface Msg {
  role: "user" | "assistant";
  content: string;
  image?: string;
}

function AlmailAIPage() {
  const { lang, tr } = useI18n();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"text" | "image">("text");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Almail AI — Bizarri Chalet";
    return () => {
      document.title = "Bizarri";
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  const typeOut = (full: string) =>
    new Promise<void>((resolve) => {
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

  const sendText = async (text: string) => {
    const history = [...msgs, { role: "user" as const, content: text }];
    setMsgs(history);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: { messages: history.map(({ role, content }) => ({ role, content })) },
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

  const sendImage = async (text: string) => {
    setMsgs((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt: text, lang },
      });
      if (error) throw error;
      setLoading(false);
      if (data?.refused) {
        await typeOut(data.message);
        return;
      }
      if (data?.imageUrl) {
        setMsgs((m) => [
          ...m,
          {
            role: "assistant",
            content: lang === "ar" ? "تفضل صورتك:" : "Here is your image:",
            image: data.imageUrl,
          },
        ]);
        return;
      }
      await typeOut(
        lang === "ar"
          ? "تعذّر إنشاء الصورة. حاول مرة أخرى."
          : "Could not generate the image. Please try again.",
      );
    } catch {
      setLoading(false);
      await typeOut(
        lang === "ar"
          ? "حدث خطأ أثناء إنشاء الصورة."
          : "Something went wrong while generating the image.",
      );
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    if (mode === "image") await sendImage(text);
    else await sendText(text);
  };

  return (
    <PageShell>
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-10">
        <div className="text-center mb-8">
          <img src={almailLogo} alt="Almail AI" className="h-14 w-auto mx-auto mb-5 invert" />
          <h1 className="text-4xl md:text-5xl font-display tracking-wide">{tr("chatTitle")}</h1>
          <p className="text-muted-foreground mt-3 text-sm tracking-wider uppercase">
            {lang === "ar" ? "مساعدك الشخصي" : "Your personal concierge"}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-4">
          <button
            onClick={() => setMode("text")}
            className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-widest border ${
              mode === "text"
                ? "bg-black text-white border-black"
                : "border-border hover:bg-secondary"
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" /> {tr("textMode")}
          </button>
          <button
            onClick={() => setMode("image")}
            className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-widest border ${
              mode === "image"
                ? "bg-black text-white border-black"
                : "border-border hover:bg-secondary"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" /> {tr("imageMode")}
          </button>
        </div>
        {mode === "image" && (
          <p className="text-center text-xs text-muted-foreground mb-4 max-w-xl mx-auto">
            {tr("imageNotice")}
          </p>
        )}

        <div className="border border-border bg-background flex flex-col h-[60vh] shadow-luxe">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-3 text-sm">
            {msgs.length === 0 && (
              <div className="text-muted-foreground text-center pt-16 px-4">
                <img
                  src={almailLogo}
                  alt=""
                  className="h-10 w-auto mx-auto mb-4 opacity-70 invert"
                />
                <p className="max-w-md mx-auto">{tr("chatGreet")}</p>
              </div>
            )}
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] px-4 py-2.5 leading-relaxed whitespace-pre-wrap ${
                    m.role === "user" ? "bg-black text-white" : "bg-secondary"
                  }`}
                >
                  {m.content || <Dots />}
                  {m.image && (
                    <img
                      src={m.image}
                      alt="Generated"
                      className="mt-3 max-w-full h-auto border border-border"
                    />
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-secondary px-4 py-3 text-xs">
                  {mode === "image" ? tr("generating") : <Dots />}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-3 flex gap-2 shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={
                mode === "image"
                  ? lang === "ar"
                    ? "صف صورة عن بيزاري…"
                    : "Describe a Bizarri-related image…"
                  : tr("chatPlaceholder")
              }
              className="flex-1 px-4 py-3 text-sm bg-secondary outline-none"
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={loading}
              className="px-5 bg-black text-white disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function Dots() {
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
