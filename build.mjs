// ---------------------------------------------------------------------------
// H Heuristics research platform — static site generator.
//
//   node build.mjs      →  dist/
//
// No dependencies. Reads content/reports/*.json plus public/, emits a static
// site with Google Scholar citation metadata on every report page.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config, { isProduction } from './site.config.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const SITE = config.siteUrl;

/* ------------------------------------------------------------------ utils */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Strip markup for use inside meta tag content.
const plain = (s) =>
  String(s).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*?([^*]+)\*\*?/g, '$1');

// Minimal inline markdown: **strong**, *em*, [text](url with balanced parens).
function inline(s) {
  let out = esc(s);
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/(?:[^()\s]|\((?:[^()\s]*)\))*)\)/g,
    (_m, label, href) =>
      `<a href="${href}" rel="noopener noreferrer" target="_blank">${label}</a>`
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return out;
}

const slugify = (s) =>
  s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const MONTHS = ['January','February','March','April','May','June','July',
                'August','September','October','November','December'];

function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
const year = (iso) => iso.slice(0, 4);
const scholarDate = (iso) => iso.replace(/-/g, '/');

function write(rel, contents) {
  const dest = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, contents);
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, e.name);
    const dst = path.join(to, e.name);
    if (e.name === '.DS_Store') continue;
    if (e.isDirectory()) { fs.mkdirSync(dst, { recursive: true }); n += copyDir(src, dst); }
    else { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); n++; }
  }
  return n;
}

const fmtBytes = (b) =>
  b >= 1e6 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

/* ------------------------------------------------------------------- data */

function loadReports() {
  const dir = path.join(ROOT, 'content/reports');
  const reports = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .map((r) => {
      const pdfPath = path.join(ROOT, 'public/pdf', r.pdf);
      if (!fs.existsSync(pdfPath)) throw new Error(`Missing PDF for "${r.slug}": public/pdf/${r.pdf}`);
      return {
        ...r,
        url: `/reports/${r.slug}/`,
        absUrl: `${SITE}/reports/${r.slug}/`,
        pdfUrl: `/pdf/${r.pdf}`,
        pdfAbsUrl: `${SITE}/pdf/${r.pdf}`,
        bytes: fs.statSync(pdfPath).size,
      };
    })
    .sort((a, b) => (a.published < b.published ? 1 : a.published > b.published ? -1 : b.number.localeCompare(a.number)));

  const seen = new Set();
  for (const r of reports) {
    if (seen.has(r.slug)) throw new Error(`Duplicate slug: ${r.slug}`);
    seen.add(r.slug);
  }
  return reports;
}

function buildTopics(reports) {
  const map = new Map();
  for (const r of reports) {
    for (const t of r.topics) {
      if (!map.has(t)) map.set(t, { name: t, slug: slugify(t), reports: [] });
      map.get(t).reports.push(r);
    }
  }
  const order = config.topicOrder;
  return [...map.values()].sort((a, b) => {
    const ia = order.indexOf(a.name), ib = order.indexOf(b.name);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.name.localeCompare(b.name);
  });
}

/* ---------------------------------------------------------------- citation */

function surnameFirst(name) {
  const parts = name.trim().split(/\s+/);
  const last = parts.pop();
  return parts.length ? `${last}, ${parts.join(' ')}` : last;
}
const initialise = (name) => {
  const parts = name.trim().split(/\s+/);
  const last = parts.pop();
  return `${last}, ${parts.map((p) => p[0] + '.').join(' ')}`;
};

function citations(r) {
  const y = year(r.published);
  const authorsApa = r.authors.map(initialise).join(', & ');
  const authorsChi = r.authors.map(surnameFirst).join(', and ');
  const key = `hughes${y}${r.slug.split('-')[0]}`;
  return {
    APA: `${authorsApa} (${y}). ${r.title} (${config.series} No. ${r.number}). ${config.publisher}. ${r.absUrl}`,
    Chicago: `${authorsChi}. "${r.title}." ${config.series} ${r.number}. ${config.publisher}, ${y}. ${r.absUrl}.`,
    BibTeX: [
      `@techreport{${key},`,
      `  title       = {${r.title}},`,
      `  author      = {${r.authors.join(' and ')}},`,
      `  institution = {${config.publisher}},`,
      `  type        = {${config.series}},`,
      `  number      = {${r.number}},`,
      `  year        = {${y}},`,
      `  month       = {${MONTHS[Number(r.published.slice(5, 7)) - 1].toLowerCase().slice(0, 3)}},`,
      `  url         = {${r.absUrl}}`,
      `}`,
    ].join('\n'),
  };
}

/* ------------------------------------------------------------------ layout */

const LOGO = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="1" fill="currentColor"/><path d="M9 8v16M23 8v16M9 16h14" stroke="var(--paper)" stroke-width="2.6" fill="none" stroke-linecap="square"/></svg>`;

function layout({ title, description, canonical, head = '', body, cls = '', activeNav = '' }) {
  const fullTitle = title === config.name ? `${config.name} — ${config.tagline}` : `${title} · ${config.name}`;
  const nav = config.nav
    .map((n) => `<a href="${n.href}"${activeNav === n.href ? ' aria-current="page"' : ''}>${n.label}</a>`)
    .join('');

  return `<!doctype html>
<html lang="${config.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
${isProduction ? '' : '<meta name="robots" content="noindex, nofollow">\n'}<meta name="theme-color" content="#1D4E89" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0E1420" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(config.name)} — Reports" href="${SITE}/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300..700;1,8..60,300..600&family=Inter:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/assets/styles.css">
${head}<meta property="og:site_name" content="${esc(config.name)}">
<meta property="og:locale" content="en_GB">
</head>
<body class="${cls}">
<a class="skip" href="#main">Skip to content</a>

<header class="masthead">
  <div class="wrap masthead__inner">
    <a class="wordmark" href="/">
      ${LOGO}
      <span class="wordmark__text">
        <span class="wordmark__name">H Heuristics</span>
        <span class="wordmark__tag">${esc(config.tagline)}</span>
      </span>
    </a>
    <nav class="nav" aria-label="Primary">${nav}</nav>
  </div>
</header>

<main id="main">
${body}
</main>

<footer class="footer">
  <div class="wrap footer__inner">
    <div class="footer__brand">
      <p class="footer__name">H Heuristics</p>
      <p class="footer__tag">${esc(config.tagline)}</p>
      <p class="footer__note">Independent research on systemic risk, resilience, and development. Published open access.</p>
    </div>
    <div class="footer__cols">
      <div>
        <h2 class="footer__h">Research</h2>
        <a href="/reports/">All reports</a>
        <a href="/topics/">Topics</a>
        <a href="/feed.xml">RSS feed</a>
        <a href="/reports.json">Metadata (JSON)</a>
      </div>
      <div>
        <h2 class="footer__h">About</h2>
        <a href="/about/">About H Heuristics</a>
        <a href="/about/#citation">Citation policy</a>
        <a href="mailto:${config.email}">Contact</a>
      </div>
    </div>
  </div>
  <div class="wrap footer__legal">
    <p>© ${new Date().getFullYear()} H Heuristics · ${esc(config.author)}</p>
    <p>Reports licensed under <a href="${config.license.url}" rel="license noopener" target="_blank">${config.license.name}</a>.</p>
  </div>
</footer>

<script src="/assets/site.js" defer></script>
</body>
</html>
`;
}

/* --------------------------------------------------------------- fragments */

function topicPills(r, linked = true) {
  return `<ul class="pills">${r.topics
    .map((t) =>
      linked
        ? `<li><a class="pill" href="/topics/${slugify(t)}/">${esc(t)}</a></li>`
        : `<li><span class="pill">${esc(t)}</span></li>`
    )
    .join('')}</ul>`;
}

function entry(r) {
  return `<article class="entry" data-slug="${r.slug}" data-topics="${esc(r.topics.join('|'))}" data-search="${esc(
    (r.title + ' ' + r.dek + ' ' + r.keywords.join(' ') + ' ' + r.topics.join(' ')).toLowerCase()
  )}">
  <div class="entry__meta">
    <span class="ref">${esc(r.number)}</span>
    <time datetime="${r.published}">${fmtDate(r.published)}</time>
    <span class="entry__spec">${r.pages} pp · PDF</span>
  </div>
  <div class="entry__body">
    <h3 class="entry__title"><a href="${r.url}">${esc(r.title)}</a></h3>
    <p class="entry__dek">${esc(r.dek)}</p>
    ${topicPills(r)}
  </div>
</article>`;
}

/* ------------------------------------------------------------------- pages */

function pageHome(reports, topics) {
  const [lead, ...rest] = reports;

  const body = `
<section class="hero">
  <div class="wrap hero__inner">
    <p class="eyebrow">Independent research · Open access</p>
    <h1 class="hero__title">Research on the risks that travel together.</h1>
    <p class="hero__lede">H Heuristics publishes long-form analytical reports on systemic risk, climate resilience, development finance, and the energy transition — written for the people who have to decide what to build, fund, and sequence first.</p>
    <p class="hero__actions">
      <a class="btn btn--primary" href="/reports/">Browse the reports</a>
      <a class="btn" href="${lead.url}">Latest: ${esc(lead.number)}</a>
    </p>
  </div>
</section>

<section class="band band--feature">
  <div class="wrap">
    <div class="sec-head"><h2 class="sec-head__h">Latest report</h2><span class="sec-head__rule"></span></div>
    <article class="feature">
      <div class="feature__meta">
        <span class="ref">${esc(lead.number)}</span>
        <time datetime="${lead.published}">${fmtDate(lead.published)}</time>
        <span class="entry__spec">${lead.pages} pp · ${fmtBytes(lead.bytes)}</span>
      </div>
      <h3 class="feature__title"><a href="${lead.url}">${esc(lead.title)}</a></h3>
      <p class="feature__dek">${esc(lead.dek)}</p>
      <p class="feature__abstract">${inline(lead.abstract[0])}</p>
      <p class="feature__actions">
        <a class="btn btn--primary" href="${lead.url}">Abstract &amp; details</a>
        <a class="btn" href="${lead.pdfUrl}" target="_blank" rel="noopener">Read the PDF</a>
      </p>
      ${topicPills(lead)}
    </article>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <div class="sec-head"><h2 class="sec-head__h">More from the series</h2><span class="sec-head__rule"></span><a class="sec-head__more" href="/reports/">All reports →</a></div>
    <div class="entries">${rest.map(entry).join('\n')}</div>
  </div>
</section>

<section class="band band--tint">
  <div class="wrap">
    <div class="sec-head"><h2 class="sec-head__h">Research areas</h2><span class="sec-head__rule"></span></div>
    <ul class="topicgrid">
      ${topics
        .map(
          (t) => `<li><a href="/topics/${t.slug}/">
        <span class="topicgrid__name">${esc(t.name)}</span>
        <span class="topicgrid__n">${t.reports.length} report${t.reports.length === 1 ? '' : 's'}</span>
      </a></li>`
        )
        .join('')}
    </ul>
  </div>
</section>`;

  const head = `<meta property="og:type" content="website">
<meta property="og:title" content="${esc(config.name)} — ${esc(config.tagline)}">
<meta property="og:description" content="${esc(config.description)}">
<meta property="og:url" content="${SITE}/">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: config.name,
    url: SITE + '/',
    slogan: config.tagline,
    description: config.description,
    founder: { '@type': 'Person', name: config.author },
  })}</script>
`;

  return layout({
    title: config.name,
    description: config.description,
    canonical: SITE + '/',
    head,
    body,
    cls: 'page-home',
  });
}

function pageReports(reports, topics) {
  const body = `
<section class="pagehead">
  <div class="wrap">
    <p class="eyebrow">The series</p>
    <h1 class="pagehead__title">Reports</h1>
    <p class="pagehead__lede">${reports.length} reports in the ${esc(config.series)} series. Every report is open access; each page carries the abstract, key findings, structured metadata, and the full PDF.</p>
  </div>
</section>

<section class="band">
  <div class="wrap">
    <form class="filters" role="search" data-filters>
      <div class="filters__search">
        <label class="sr-only" for="q">Search reports</label>
        <input id="q" type="search" placeholder="Search titles, topics, keywords…" autocomplete="off" data-filter-input>
      </div>
      <div class="filters__topics" role="group" aria-label="Filter by topic">
        <button type="button" class="chip is-active" data-topic="">All</button>
        ${topics.map((t) => `<button type="button" class="chip" data-topic="${esc(t.name)}">${esc(t.name)}</button>`).join('')}
      </div>
    </form>
    <p class="filters__count" data-filter-count hidden></p>
    <div class="entries" data-filter-list>${reports.map(entry).join('\n')}</div>
    <p class="empty" data-filter-empty hidden>No reports match that filter.</p>
  </div>
</section>`;

  const head = `<meta property="og:type" content="website">
<meta property="og:title" content="Reports · ${esc(config.name)}">
<meta property="og:description" content="${esc(config.description)}">
<meta property="og:url" content="${SITE}/reports/">
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Reports — ${config.name}`,
    url: `${SITE}/reports/`,
    hasPart: reports.map((r) => ({ '@type': 'Report', name: r.title, url: r.absUrl })),
  })}</script>
`;

  return layout({
    title: 'Reports',
    description: `All ${reports.length} reports in the ${config.series} series — systemic risk, climate resilience, development finance, and the energy transition.`,
    canonical: `${SITE}/reports/`,
    head,
    body,
    activeNav: '/reports/',
  });
}

function pageReport(r, reports) {
  const cite = citations(r);
  const related = reports
    .filter((o) => o.slug !== r.slug)
    .map((o) => ({ o, n: o.topics.filter((t) => r.topics.includes(t)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || (a.o.published < b.o.published ? 1 : -1))
    .slice(0, 3)
    .map((x) => x.o);

  const abstractText = r.abstract.map(plain).join(' ');

  // Google Scholar citation metadata (technical-report profile) + Dublin Core.
  const head = `<meta name="citation_title" content="${esc(r.title)}">
${r.authors.map((a) => `<meta name="citation_author" content="${esc(surnameFirst(a))}">`).join('\n')}
<meta name="citation_author_institution" content="${esc(config.publisher)}">
<meta name="citation_publication_date" content="${scholarDate(r.published)}">
<meta name="citation_online_date" content="${scholarDate(r.published)}">
<meta name="citation_technical_report_institution" content="${esc(config.publisher)}">
<meta name="citation_technical_report_number" content="${esc(r.number)}">
<meta name="citation_publisher" content="${esc(config.publisher)}">
<meta name="citation_language" content="${r.language}">
<meta name="citation_keywords" content="${esc(r.keywords.join('; '))}">
<meta name="citation_abstract_html_url" content="${r.absUrl}">
<meta name="citation_pdf_url" content="${r.pdfAbsUrl}">
<meta name="citation_firstpage" content="1">
<meta name="citation_lastpage" content="${r.pages}">
<meta name="DC.title" content="${esc(r.title)}">
${r.authors.map((a) => `<meta name="DC.creator" content="${esc(a)}">`).join('\n')}
<meta name="DC.date" content="${r.published}">
<meta name="DC.publisher" content="${esc(config.publisher)}">
<meta name="DC.type" content="Text">
<meta name="DC.format" content="application/pdf">
<meta name="DC.identifier" content="${r.absUrl}">
<meta name="DC.language" content="${r.language}">
<meta name="DC.rights" content="${esc(config.license.name)}">
<meta name="DC.description" content="${esc(plain(r.abstract[0]))}">
<meta name="DC.subject" content="${esc(r.keywords.join('; '))}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(r.title)}">
<meta property="og:description" content="${esc(r.dek)}">
<meta property="og:url" content="${r.absUrl}">
<meta property="article:published_time" content="${r.published}">
${r.topics.map((t) => `<meta property="article:tag" content="${esc(t)}">`).join('\n')}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(r.title)}">
<meta name="twitter:description" content="${esc(r.dek)}">
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Report',
    headline: r.title,
    name: r.title,
    abstract: abstractText,
    description: r.dek,
    reportNumber: r.number,
    datePublished: r.published,
    dateModified: r.updated,
    inLanguage: r.language,
    keywords: r.keywords.join(', '),
    about: r.topics,
    numberOfPages: r.pages,
    license: config.license.url,
    url: r.absUrl,
    isPartOf: { '@type': 'PublicationVolume', name: config.series },
    author: r.authors.map((a) => ({ '@type': 'Person', name: a })),
    publisher: { '@type': 'Organization', name: config.publisher, url: SITE + '/' },
    encoding: {
      '@type': 'MediaObject',
      contentUrl: r.pdfAbsUrl,
      encodingFormat: 'application/pdf',
      contentSize: String(r.bytes),
    },
    mainEntityOfPage: r.absUrl,
  })}</script>
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Reports', item: SITE + '/reports/' },
      { '@type': 'ListItem', position: 3, name: r.title, item: r.absUrl },
    ],
  })}</script>
`;

  const body = `
<article class="paper">

<div class="paper__top">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="/">Home</a><span>/</span><a href="/reports/">Reports</a><span>/</span><span aria-current="page">${esc(r.number)}</span>
    </nav>
    <p class="eyebrow">${esc(config.series)} · ${esc(r.number)}</p>
    <h1 class="paper__title">${esc(r.title)}</h1>
    <p class="paper__dek">${esc(r.dek)}</p>
    <p class="paper__byline">
      <span class="paper__author">${r.authors.map(esc).join(' · ')}</span>
      <span class="paper__sep">·</span>
      <time datetime="${r.published}">${fmtDate(r.published)}</time>
      <span class="paper__sep">·</span>
      <span>${r.pages} pages</span>
    </p>
    <p class="paper__actions">
      <a class="btn btn--primary" href="${r.pdfUrl}" target="_blank" rel="noopener">Read the PDF <span class="btn__hint">opens in a new tab</span></a>
      <a class="btn" href="${r.pdfUrl}" download="${esc(r.pdf)}">Download <span class="btn__hint">${fmtBytes(r.bytes)}</span></a>
      <button class="btn btn--ghost" type="button" data-preview-toggle aria-expanded="false" aria-controls="pdf-preview">Preview inline</button>
    </p>
    ${topicPills(r)}
  </div>
</div>

<div class="wrap paper__grid">
  <div class="paper__main">

    <section class="sect" id="abstract">
      <h2 class="sect__h">Abstract</h2>
      <div class="prose prose--abstract">
        ${r.abstract.map((p) => `<p>${inline(p)}</p>`).join('\n        ')}
      </div>
    </section>

    <section class="sect" id="findings">
      <h2 class="sect__h">Key findings</h2>
      <ol class="findings">
        ${r.findings.map((f) => `<li>${inline(f)}</li>`).join('\n        ')}
      </ol>
    </section>

    <section class="sect" id="contents">
      <h2 class="sect__h">Contents</h2>
      <ol class="toc">
        ${r.contents.map((c) => `<li>${esc(c.replace(/^\d+\.\s*/, ''))}</li>`).join('\n        ')}
        <li class="toc__end">References and Further Reading</li>
      </ol>
    </section>

    <section class="sect" id="method">
      <h2 class="sect__h">Data and method</h2>
      <div class="prose prose--small"><p>${inline(r.method)}</p></div>
    </section>

    <section class="sect" id="pdf-preview" data-preview hidden>
      <h2 class="sect__h">Full text</h2>
      <div class="pdfframe" data-preview-mount data-src="${r.pdfUrl}"></div>
      <p class="pdfframe__fallback">Trouble viewing? <a href="${r.pdfUrl}" target="_blank" rel="noopener">Open the PDF in a new tab</a>.</p>
    </section>

    ${
      related.length
        ? `<section class="sect" id="related">
      <h2 class="sect__h">Related reports</h2>
      <div class="entries entries--compact">${related.map(entry).join('\n')}</div>
    </section>`
        : ''
    }

  </div>

  <aside class="rail" aria-label="Report details">

    <div class="railcard railcard--dl">
      <h2 class="railcard__h">Full report</h2>
      <p class="railcard__spec">PDF · ${r.pages} pages · ${fmtBytes(r.bytes)}</p>
      <a class="btn btn--primary btn--block" href="${r.pdfUrl}" target="_blank" rel="noopener">Read in a new tab</a>
      <a class="btn btn--block" href="${r.pdfUrl}" download="${esc(r.pdf)}">Download PDF</a>
    </div>

    <div class="railcard">
      <h2 class="railcard__h">Details</h2>
      <dl class="deflist">
        <dt>Series</dt><dd>${esc(config.series)}</dd>
        <dt>Number</dt><dd class="tabular">${esc(r.number)}</dd>
        <dt>Published</dt><dd><time datetime="${r.published}">${fmtDate(r.published)}</time></dd>
        <dt>Author</dt><dd>${r.authors.map(esc).join(', ')}</dd>
        <dt>Publisher</dt><dd>${esc(config.publisher)}</dd>
        <dt>Pages</dt><dd class="tabular">${r.pages}</dd>
        <dt>Language</dt><dd>English</dd>
        <dt>JEL codes</dt><dd class="tabular">${r.jelCodes.map(esc).join(', ')}</dd>
        <dt>Licence</dt><dd><a href="${config.license.url}" rel="license noopener" target="_blank">${esc(config.license.name)}</a></dd>
      </dl>
      ${r.jelNote ? `<p class="railcard__note">${esc(r.jelNote)}</p>` : ''}
    </div>

    <div class="railcard">
      <h2 class="railcard__h">Keywords</h2>
      <ul class="keywords">${r.keywords.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>
    </div>

    <div class="railcard" id="cite">
      <h2 class="railcard__h">Cite this report</h2>
      <div class="cite" data-cite>
        <div class="cite__tabs" role="tablist">
          ${Object.keys(cite)
            .map(
              (k, i) =>
                `<button type="button" role="tab" class="cite__tab${i === 0 ? ' is-active' : ''}" data-cite-tab="${k}" aria-selected="${i === 0}">${k}</button>`
            )
            .join('')}
        </div>
        ${Object.entries(cite)
          .map(
            ([k, v], i) =>
              `<pre class="cite__body" data-cite-panel="${k}"${i === 0 ? '' : ' hidden'}><code>${esc(v)}</code></pre>`
          )
          .join('')}
        <button type="button" class="btn btn--small btn--block" data-cite-copy>Copy citation</button>
      </div>
    </div>

  </aside>
</div>
</article>`;

  return layout({
    title: r.title,
    description: r.dek,
    canonical: r.absUrl,
    head,
    body,
    cls: 'page-report',
    activeNav: '/reports/',
  });
}

function pageTopicsIndex(topics) {
  const body = `
<section class="pagehead">
  <div class="wrap">
    <p class="eyebrow">Research areas</p>
    <h1 class="pagehead__title">Topics</h1>
    <p class="pagehead__lede">The series returns to a small number of connected questions. These are the threads that run through it.</p>
  </div>
</section>
<section class="band">
  <div class="wrap">
    <ul class="topicgrid topicgrid--lg">
      ${topics
        .map(
          (t) => `<li><a href="/topics/${t.slug}/">
      <span class="topicgrid__name">${esc(t.name)}</span>
      <span class="topicgrid__n">${t.reports.length} report${t.reports.length === 1 ? '' : 's'}</span>
    </a></li>`
        )
        .join('')}
    </ul>
  </div>
</section>`;
  return layout({
    title: 'Topics',
    description: 'Research areas covered by the H Heuristics report series.',
    canonical: `${SITE}/topics/`,
    head: `<meta property="og:type" content="website">\n<meta property="og:url" content="${SITE}/topics/">\n`,
    body,
    activeNav: '/topics/',
  });
}

function pageTopic(t) {
  const body = `
<section class="pagehead">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/topics/">Topics</a><span>/</span><span aria-current="page">${esc(t.name)}</span></nav>
    <p class="eyebrow">Research area</p>
    <h1 class="pagehead__title">${esc(t.name)}</h1>
    <p class="pagehead__lede">${t.reports.length} report${t.reports.length === 1 ? '' : 's'} in the series.</p>
  </div>
</section>
<section class="band">
  <div class="wrap"><div class="entries">${t.reports.map(entry).join('\n')}</div></div>
</section>`;
  return layout({
    title: t.name,
    description: `H Heuristics reports on ${t.name.toLowerCase()}.`,
    canonical: `${SITE}/topics/${t.slug}/`,
    head: `<meta property="og:type" content="website">\n<meta property="og:url" content="${SITE}/topics/${t.slug}/">\n`,
    body,
    activeNav: '/topics/',
  });
}

function pageAbout(reports) {
  const body = `
<section class="pagehead">
  <div class="wrap">
    <p class="eyebrow">About</p>
    <h1 class="pagehead__title">H Heuristics</h1>
    <p class="pagehead__lede">${esc(config.tagline)}</p>
  </div>
</section>

<section class="band">
  <div class="wrap prose prose--page">
    <p class="prose__lede">H Heuristics is an independent research practice publishing long-form analytical reports on systemic risk, climate resilience, development finance, and the energy transition.</p>

    <p>The series works on a single premise: the risks that matter most now are the ones that travel together. A drought becomes a harvest failure, a price spike, a run on reserves, and a strain on a health system. A pandemic becomes a supply-chain crisis, an inflation shock, and a sovereign-debt crisis. Institutions that were built to handle these problems one at a time are, predictably, overwhelmed by them arriving at once.</p>

    <p>Each report takes one facet of that problem and works it through in full — the mechanism, the numbers, the country experience, and the practical implication for what to build, fund, and sequence first. The audience is the people who make those decisions: analysts, policy staff, development-finance practitioners, and the researchers who inform them.</p>

    <h2>Method</h2>
    <p>Reports synthesise institutional and peer-reviewed research. Every quantitative claim is attributed inline to a primary or authoritative secondary source, and each report states explicitly which of its figures are conceptual schematics, which are illustrative, and which report values drawn from the cited sources. The reports are analytical rather than predictive: they set out mechanisms and their implications, not forecasts.</p>

    <h2>Access and licensing</h2>
    <p>Every report is open access and free to read and download. No registration, no paywall, no tracking. Reports are licensed under <a href="${config.license.url}" rel="license noopener" target="_blank">${esc(config.license.name)}</a>: you may share them with attribution, for non-commercial purposes, without modification.</p>

    <h2 id="citation">Citation</h2>
    <p>Each report page carries a structured citation in APA, Chicago, and BibTeX form, alongside its report number in the ${esc(config.series)} series. Report pages also expose Google Scholar citation metadata and Dublin Core tags, so the series can be indexed and cited like any other working-paper series. Machine-readable metadata for the whole series is available at <a href="/reports.json">/reports.json</a>, and new reports are announced on the <a href="/feed.xml">RSS feed</a>.</p>

    <h2>Contact</h2>
    <p>Corrections, questions, and requests are welcome at <a href="mailto:${config.email}">${config.email}</a>.</p>

    <hr class="rule">
    <p class="prose__meta">The series currently comprises ${reports.length} reports, published between ${fmtDate(
      reports[reports.length - 1].published
    )} and ${fmtDate(reports[0].published)}.</p>
  </div>
</section>`;

  return layout({
    title: 'About',
    description: 'About H Heuristics — independent research on systemic risk, climate resilience, development finance, and the energy transition.',
    canonical: `${SITE}/about/`,
    head: `<meta property="og:type" content="website">\n<meta property="og:url" content="${SITE}/about/">\n`,
    body,
    activeNav: '/about/',
  });
}

function page404() {
  return layout({
    title: 'Page not found',
    description: 'Page not found.',
    canonical: `${SITE}/404.html`,
    body: `
<section class="pagehead">
  <div class="wrap">
    <p class="eyebrow">Error 404</p>
    <h1 class="pagehead__title">Page not found</h1>
    <p class="pagehead__lede">That page has moved or never existed. The full series is listed on the reports page.</p>
    <p class="paper__actions"><a class="btn btn--primary" href="/reports/">Browse the reports</a><a class="btn" href="/">Home</a></p>
  </div>
</section>`,
  });
}

/* --------------------------------------------------------------- machinery */

function sitemap(reports, topics) {
  const urls = [
    { loc: `${SITE}/`, pri: '1.0', freq: 'weekly' },
    { loc: `${SITE}/reports/`, pri: '0.9', freq: 'weekly' },
    { loc: `${SITE}/topics/`, pri: '0.5', freq: 'monthly' },
    { loc: `${SITE}/about/`, pri: '0.4', freq: 'yearly' },
    ...reports.map((r) => ({ loc: r.absUrl, pri: '0.8', freq: 'monthly', lastmod: r.updated })),
    ...reports.map((r) => ({ loc: r.pdfAbsUrl, pri: '0.7', freq: 'yearly', lastmod: r.updated })),
    ...topics.map((t) => ({ loc: `${SITE}/topics/${t.slug}/`, pri: '0.5', freq: 'monthly' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`
  )
  .join('\n')}
</urlset>
`;
}

function feed(reports) {
  const rfc = (iso) => new Date(iso + 'T12:00:00Z').toUTCString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>${esc(config.name)} — Research reports</title>
  <link>${SITE}/</link>
  <description>${esc(config.description)}</description>
  <language>en</language>
  <lastBuildDate>${rfc(reports[0].published)}</lastBuildDate>
  <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
${reports
  .map(
    (r) => `  <item>
    <title>${esc(r.title)}</title>
    <link>${r.absUrl}</link>
    <guid isPermaLink="true">${r.absUrl}</guid>
    <pubDate>${rfc(r.published)}</pubDate>
    <dc:creator>${esc(r.authors.join(', '))}</dc:creator>
${r.topics.map((t) => `    <category>${esc(t)}</category>`).join('\n')}
    <description>${esc(r.dek)}</description>
    <content:encoded><![CDATA[<p><strong>${esc(
      r.number
    )}</strong> · ${r.pages} pages</p>${r.abstract.map((p) => `<p>${plain(p)}</p>`).join('')}<p><a href="${
      r.pdfAbsUrl
    }">Download the PDF</a></p>]]></content:encoded>
  </item>`
  )
  .join('\n')}
</channel>
</rss>
`;
}

function metadataJson(reports) {
  return JSON.stringify(
    {
      name: config.name,
      series: config.series,
      url: SITE + '/',
      license: config.license,
      generated: new Date().toISOString(),
      count: reports.length,
      reports: reports.map((r) => ({
        number: r.number,
        slug: r.slug,
        title: r.title,
        authors: r.authors,
        published: r.published,
        updated: r.updated,
        language: r.language,
        pages: r.pages,
        bytes: r.bytes,
        topics: r.topics,
        keywords: r.keywords,
        jel: r.jelCodes,
        dek: r.dek,
        abstract: r.abstract,
        url: r.absUrl,
        pdf: r.pdfAbsUrl,
        license: r.license || config.license.name,
      })),
    },
    null,
    2
  );
}

/* -------------------------------------------------------------------- main */

function build() {
  const t0 = Date.now();
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const reports = loadReports();
  const topics = buildTopics(reports);

  write('index.html', pageHome(reports, topics));
  write('reports/index.html', pageReports(reports, topics));
  write('topics/index.html', pageTopicsIndex(topics));
  write('about/index.html', pageAbout(reports));
  write('404.html', page404());
  for (const r of reports) write(`reports/${r.slug}/index.html`, pageReport(r, reports));
  for (const t of topics) write(`topics/${t.slug}/index.html`, pageTopic(t));

  write('sitemap.xml', sitemap(reports, topics));
  write('feed.xml', feed(reports));
  write('reports.json', metadataJson(reports));
  write(
    'robots.txt',
    `# ${config.name} — ${config.tagline}\n${
      isProduction
        ? `User-agent: *\nAllow: /\nAllow: /pdf/\n`
        : `User-agent: *\nDisallow: /\n`
    }\nSitemap: ${SITE}/sitemap.xml\n`
  );

  // Cloudflare Pages headers: serve PDFs inline, cache hashed-free assets sanely.
  write(
    '_headers',
    `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), camera=(), microphone=(), interest-cohort=()
  Content-Security-Policy: default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; object-src 'self'; frame-src 'self'

/assets/*
  Cache-Control: public, max-age=604800

/pdf/*
  Content-Type: application/pdf
  Content-Disposition: inline
  Cache-Control: public, max-age=604800
  X-Robots-Tag: all

/feed.xml
  Content-Type: application/rss+xml; charset=utf-8

/reports.json
  Content-Type: application/json; charset=utf-8
  Access-Control-Allow-Origin: *
`
  );

  const nAssets = copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));
  const nPublic = copyDir(path.join(ROOT, 'public'), DIST);

  const pages = reports.length + topics.length + 5;
  console.log(`\n  ${config.name} — research platform`);
  console.log(`  ${'─'.repeat(46)}`);
  console.log(`  site url    ${SITE}${isProduction ? '' : '  (preview → noindex)'}`);
  console.log(`  reports     ${reports.length}`);
  console.log(`  topics      ${topics.length}`);
  console.log(`  pages       ${pages} HTML`);
  console.log(`  files       ${nAssets} asset, ${nPublic} public`);
  console.log(`  output      dist/`);
  console.log(`  built in    ${Date.now() - t0} ms\n`);
}

build();
