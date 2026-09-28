import { notFound } from "@tanstack/react-router";
import { LANGS, type Lang } from "./i18n";

/**
 * Every page is /<page>/<lang>, so every page route has to check that the
 * last segment really is a language. Shared rather than repeated eleven
 * times, and used as `beforeLoad` so a bad one never reaches the component.
 */
export function requireLang({ params }: { params: { lang: string } }) {
  if (!LANGS.includes(params.lang as Lang)) throw notFound();
}
