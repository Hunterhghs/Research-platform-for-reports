# H Heuristics — Research Platform

Publishing platform for the *H Heuristics Research Report* series. A dependency-free
static site generator: reports are JSON records plus a PDF, and every report gets an
abstract page carrying Google Scholar citation metadata.

## Quick start

```bash
npm run build     # → dist/
npm run dev       # build, then serve on http://localhost:4321
```

There are no dependencies to install. Node 18+ is the only requirement.

## Adding a report

1. **Scaffold it from the PDF.** This copies the PDF in, reads its page count, and
   writes a metadata stub with the next report number:

   ```bash
   npm run new -- "~/Desktop/My New Report - H Heuristics.pdf" my-report-slug
   ```

2. **Fill in the stub** at `content/reports/my-report-slug.json`. Every field marked
   `TODO` needs a real value:

   | Field | What it is |
   | --- | --- |
   | `title` | Full report title, as it appears on the cover |
   | `dek` | One or two sentences. Used on cards, in search results, and in social previews |
   | `abstract` | Array of paragraphs. Rendered on the page **and** used for indexing |
   | `findings` | 3–6 key findings, each with the hard numbers |
   | `topics` | 3–4 values, drawn from `topicOrder` in `site.config.mjs` |
   | `keywords` | The report's keyword line, split into an array |
   | `jelCodes` / `jelNote` | JEL classification, split into codes and the prose gloss |
   | `method` | The report's "Data and method" note |
   | `contents` | Section headings, for the on-page table of contents |

   Inline markdown is supported in `abstract`, `findings`, and `method`:
   `*italic*`, `**bold**`, and `[text](https://url)`.

3. **Build.** `npm run build`, then commit and push. Cloudflare Pages deploys on push.

Topics are derived from the reports themselves — adding a new topic to a record
creates its topic page automatically. Adding it to `topicOrder` controls where it sorts.

## Deployment (Cloudflare Pages)

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | *(repository root)* |

The site is served at **https://researchreports.hheuristics.com**, which is set as
`CANONICAL_ORIGIN` in `site.config.mjs`. No environment variable is required; set
`SITE_URL` only to override it (for a staging host, say).

**If the domain ever changes, change `CANONICAL_ORIGIN`.** Google Scholar requires an
absolute `citation_pdf_url`, and canonical links, the sitemap, the feed, and every
citation tag are built from that one constant. Whatever it says is what gets indexed
and cited.

`CF_PAGES_URL` is deliberately *not* consulted on production builds. Cloudflare sets
it to the per-deployment host (`70c3490d.<project>.pages.dev`), a different string on
every deploy — canonicalising to it publishes citation URLs that break on the next
push. Preview builds may use it, since they are `noindex` anyway and their deployment
host is the correct self-reference.

Preview deployments (any branch other than `main`) are marked `noindex` and served a
`Disallow: /` robots file, so they cannot pollute the index.

Because Pages also serves the project on `*.pages.dev`, every page carries a
`rel="canonical"` pointing at `researchreports.hheuristics.com` regardless of which host served
it — that is what keeps the duplicate hosts out of Scholar and Google.

## Google Scholar indexing

Each report page implements Scholar's technical-report profile:

- `citation_title`, `citation_author`, `citation_publication_date`
- `citation_technical_report_institution`, `citation_technical_report_number`
- `citation_pdf_url` (absolute), `citation_abstract_html_url`
- `citation_keywords`, `citation_language`, `citation_firstpage` / `citation_lastpage`

Plus Dublin Core (`DC.*`) tags, schema.org `Report` and `BreadcrumbList` JSON-LD, and
Open Graph metadata. The PDFs themselves are stamped with `/Title`, `/Author`,
`/Subject`, and `/Keywords`, and their first page carries the title in large type —
both things Scholar's parser looks for.

Scholar crawls from the browse pages, so `/reports/` links to every abstract page and
each abstract page links to its PDF with a plain `<a href>`. `robots.txt` explicitly
allows `/pdf/`.

Before submitting to Scholar, confirm the live metadata is on the right host:

```bash
curl -s https://researchreports.hheuristics.com/reports/<slug>/ | grep citation_pdf_url
```

After the first deploy, submit the site through
[Google Search Console](https://search.google.com/search-console) and request Scholar
inclusion via their [inclusion form](https://scholar.google.com/intl/en/scholar/inclusion.html#overview).
Scholar indexing typically takes several weeks.

## What gets generated

```
dist/
  index.html                    home
  reports/index.html            browsable, filterable index
  reports/<slug>/index.html     abstract page + Scholar metadata
  topics/<slug>/index.html      one per topic
  about/index.html
  pdf/<slug>.pdf                full text
  sitemap.xml  feed.xml  robots.txt  reports.json  _headers  404.html
```

`reports.json` is a machine-readable index of the whole series, CORS-enabled, for
anyone who wants to consume the catalogue programmatically.

## Layout

```
build.mjs              the generator — templates, metadata, feeds
site.config.mjs        site identity, canonical URL, topic order, nav
content/reports/*.json one record per report
public/                copied verbatim to dist/ (PDFs, favicon)
assets/                styles.css, site.js → dist/assets/
scripts/               new-report.mjs, serve.mjs
```

Design: navy `#1D4E89`, ink `#16181C`, warm paper `#FBFAF8`, crimson `#9B2226`
accent — matching the report series' own house style. Source Serif 4 for prose,
Inter for metadata and interface. Dark mode follows the reader's system setting.

## Licence

Site code: private. Reports: CC BY-NC-ND 4.0.
