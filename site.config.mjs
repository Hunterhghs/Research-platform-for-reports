// ---------------------------------------------------------------------------
// Site-wide configuration.
//
// siteUrl is load-bearing: Google Scholar requires an absolute citation_pdf_url,
// and canonical links, the sitemap, and the feed are all built from it. Whatever
// it says is what gets indexed and cited, so it must be the permanent public
// domain — not whichever host happens to serve a given deployment.
//
// Note CF_PAGES_URL is deliberately NOT used on production builds. Cloudflare
// sets it to the per-deployment host (70c3490d.<project>.pages.dev), which is a
// different string on every deploy; canonicalising to it would publish citation
// URLs that break on the next push. Preview builds may use it, since they are
// noindex anyway and their deployment host is the correct self-reference.
// ---------------------------------------------------------------------------

const CANONICAL_ORIGIN = 'https://researchreports.hheuristics.com';

export const isProduction =
  process.env.CF_PAGES_BRANCH === undefined ||
  process.env.CF_PAGES_BRANCH === 'main' ||
  process.env.CF_PAGES_BRANCH === 'master';

const resolvedOrigin =
  process.env.SITE_URL ||
  (isProduction ? CANONICAL_ORIGIN : process.env.CF_PAGES_URL || CANONICAL_ORIGIN);

export default {
  siteUrl: resolvedOrigin.replace(/\/$/, ''),

  name: 'H Heuristics',
  tagline: 'Navigating a Changing World',
  description:
    'Independent research on systemic risk, climate resilience, development finance, and the energy transition. Long-form reports, published open access.',
  author: 'Hunter Hughes',
  email: 'hunter.hughes.r@gmail.com',
  series: 'H Heuristics Research Report',
  publisher: 'H Heuristics',
  language: 'en',
  // Default licence for the series. A report record may override it with a
  // `license` naming any key in `licenses` below — the Zenodo deposit is the
  // source of truth for anything with a DOI.
  license: {
    name: 'CC BY-NC-ND 4.0',
    url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
  },
  licenses: {
    'CC BY-NC-ND 4.0': { name: 'CC BY-NC-ND 4.0', url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/' },
    'CC BY-NC 4.0':    { name: 'CC BY-NC 4.0',    url: 'https://creativecommons.org/licenses/by-nc/4.0/' },
    'CC BY 4.0':       { name: 'CC BY 4.0',       url: 'https://creativecommons.org/licenses/by/4.0/' },
  },

  // Order in which topic facets are displayed.
  topicOrder: [
    'Systemic Risk',
    'Climate Adaptation',
    'Development Finance',
    'Energy Transition',
    'Infrastructure',
    'Technology & Innovation',
    'Institutions & Governance',
    'Environment & Biodiversity',
    'Public Health',
    'Water & Food Security',
    'Emerging Markets',
    'Demography & Migration',
    'Complexity & Natural Form',
  ],

  nav: [
    { href: '/reports/', label: 'Reports' },
    { href: '/topics/', label: 'Topics' },
    { href: '/about/', label: 'About' },
  ],
};
