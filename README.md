# TB Sweeps &amp; Stoves

Marketing website for TB Sweeps &amp; Stoves — a HETAS approved chimney sweep and
stove installer serving Manchester, Tameside and the surrounding areas.

The site is a set of static HTML pages served through a single Cloudflare Worker.
The Worker also handles the booking/contact form submission at `/api/contact`,
sending enquiries by email via [Resend](https://resend.com/).

## Project layout

```
.                      Repository root — all assets are served from here
├── *.html             Individual pages (index, services, booknow, shop, etc.)
├── styles.css         Shared site styles
├── theme.css          Theme tokens / generated styles
├── header-fix.css     Header-specific overrides
├── hero-background.css Hero section styles
├── worker.js          Cloudflare Worker: serves assets + /api/contact endpoint
├── wrangler.toml      Worker + static asset configuration
└── *.jpg / *.png / *.mp4  Images and hero video
```

## How it works

- **Static assets** are served by the Worker via the `ASSETS` binding
  (`[assets] directory = "."` in `wrangler.toml`).
- The Worker uses `HTMLRewriter` to enhance HTML responses at serve time
  (injects the hero background video, normalises "Book Now" links to
  `booknow.html`, and adds no-cache headers).
- **`POST /api/contact`** receives the booking form as `multipart/form-data`,
  validates it, and emails the enquiry (with optional photo attachments) to the
  business via Resend.

## Local development

Requires [Node.js](https://nodejs.org/) and the Cloudflare
[Wrangler](https://developers.cloudflare.com/workers/wrangler/) CLI.

```bash
# Run the Worker + static site locally
npx wrangler dev
```

Note: the contact form calls the live Worker route `/api/contact`, which needs
the `RESEND_API_KEY` secret (see below). Opening the `.html` files directly from
disk will not exercise the form submission.

## Deployment

The site deploys as a Cloudflare Worker:

```bash
npx wrangler deploy
```

### Required configuration

- **`RESEND_API_KEY`** — a Resend API key, stored as a Worker **secret**
  (never commit it):

  ```bash
  npx wrangler secret put RESEND_API_KEY
  ```

- **`RESEND_FROM`** — the "from" address for enquiry emails. Set as a plain var
  in `wrangler.toml` (`[vars]`). Must be a verified Resend sender/domain.

Enquiries are currently emailed to the address configured in `worker.js`.

## Notes

- Pages are hand-maintained and each include their own copy of the header, nav,
  footer and Google Ads tracking snippet. When changing shared elements (nav
  links, phone number, footer), update every page to keep them in sync.
