// ---------------------------------------------------------------------------
// Site-wide configuration.
//
// siteUrl matters: Google Scholar requires absolute URLs in citation_pdf_url,
// so canonical links and PDF URLs are all built from it. Set SITE_URL in the
// Cloudflare Pages build environment once a custom domain is attached.
// ---------------------------------------------------------------------------

const fallback = 'https://research-platform-for-reports.pages.dev';

export const isProduction =
  process.env.CF_PAGES_BRANCH === undefined ||
  process.env.CF_PAGES_BRANCH === 'main' ||
  process.env.CF_PAGES_BRANCH === 'master';

export default {
  siteUrl: (process.env.SITE_URL || process.env.CF_PAGES_URL || fallback).replace(/\/$/, ''),

  name: 'H Heuristics',
  tagline: 'Navigating a Changing World',
  description:
    'Independent research on systemic risk, climate resilience, development finance, and the energy transition. Long-form reports, published open access.',
  author: 'Hunter Hughes',
  email: 'hunter.hughes.r@gmail.com',
  series: 'H Heuristics Research Report',
  publisher: 'H Heuristics',
  language: 'en',
  license: {
    name: 'CC BY-NC-ND 4.0',
    url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
  },

  // Order in which topic facets are displayed.
  topicOrder: [
    'Systemic Risk',
    'Climate Adaptation',
    'Development Finance',
    'Energy Transition',
    'Infrastructure',
    'Institutions & Governance',
    'Public Health',
    'Emerging Markets',
  ],

  nav: [
    { href: '/reports/', label: 'Reports' },
    { href: '/topics/', label: 'Topics' },
    { href: '/about/', label: 'About' },
  ],
};
