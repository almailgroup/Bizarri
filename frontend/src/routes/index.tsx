import { createFileRoute, redirect } from "@tanstack/react-router";
import { preferredLang } from "@/lib/i18n";

/** The bare domain picks a language and sends you to it. */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/$lang", params: { lang: preferredLang() }, replace: true });
  },
});
