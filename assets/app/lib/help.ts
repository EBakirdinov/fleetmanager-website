/**
 * Which help article explains which page.
 *
 * The articles are server-rendered Twig under /help (see src/Help/HelpArticles.php
 * and templates/help/), not routes in this SPA, so TopBar links out to them
 * rather than navigating. Opening in a new tab is deliberate: a dispatcher
 * reading about appointment windows should come back to the half-built load
 * they left, not to a remounted app.
 *
 * Slugs here must match HelpArticles::ARTICLES on the server. There are a dozen
 * of them and they change rarely, which is why this is a literal rather than
 * something fetched at boot.
 */
const HELP_BY_PATH: ReadonlyArray<readonly [path: string, slug: string]> = [
  ["/dashboard", "getting-started"],
  ["/loads", "loads"],
  ["/drivers", "drivers"],
  ["/trucks", "trucks-and-trailers"],
  ["/trailers", "trucks-and-trailers"],
  ["/maintenance", "maintenance"],
  ["/expenses", "expenses"],
  ["/fuel", "expenses"],
  ["/workers", "users-and-permissions"],
  ["/settings/integrations", "integrations"],
];

/**
 * Longest path first, so /settings/integrations wins over any shorter prefix
 * it also matches. Same ordering trick as navEntryFor() in nav.ts.
 */
const ORDERED = [...HELP_BY_PATH].sort((a, b) => b[0].length - a[0].length);

/** The help URL for a pathname, falling back to the help index. */
export function helpUrlFor(pathname: string): string {
  const hit = ORDERED.find(([p]) => pathname === p || pathname.startsWith(p + "/"));
  return hit ? `/help/${hit[1]}` : "/help";
}
