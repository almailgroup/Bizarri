import { createFileRoute, notFound } from "@tanstack/react-router";

/** A real 404, inside a language, so the page can speak it. */
export const Route = createFileRoute("/$lang/$")({
  beforeLoad: () => {
    throw notFound();
  },
});
