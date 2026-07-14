# AnShow International Logistics Website Design

Date: 2026-07-14
Status: Awaiting written-spec review

## 1. Product Summary

AnShow will be a multilingual international freight-forwarding website with a custom administration console. English is the default language, with complete Simplified Chinese and Russian versions. The first release is a brand, content, and lead-generation platform rather than a logistics ERP.

The product has three bounded surfaces:

1. A public, SEO-friendly corporate website with high-impact logistics imagery and motion.
2. A private administration console under the same domain at `/admin`.
3. A server-side content, identity, lead, media, email, and configuration layer backed by SQLite.

The production deployment target is a Tencent Cloud CVM using Docker Compose. Tencent Cloud DNS points the production domain to the CVM. Caddy terminates HTTPS and automatically obtains and renews certificates.

## 2. Goals

- Present AnShow as a credible, modern, technology-driven global freight forwarder.
- Cover global transport modes, priority Eurasian corridors, and specialist cargo without overloading the homepage.
- Convert visitors through a short enquiry form and configurable instant-contact channels.
- Let staff manage all public content, translations, media, enquiries, settings, and staff access without code changes.
- Deliver complete English, Chinese, and Russian seed content, interface text, metadata, email templates, and image alt text.
- Deliver generated, production-ready visual assets and responsive optimized derivatives.
- Keep the experience fluid and readable on desktop, tablet, and mobile.
- Make deployment, HTTPS, backup, recovery, and upgrades repeatable.

## 3. Non-Goals for Version 1

Version 1 will not include:

- Customer accounts or a customer portal.
- Shipment tracking or carrier API integrations.
- Live freight pricing or quotation calculation.
- Logistics orders, billing, invoices, or document exchange.
- Warehouse, fleet, transport, or customs operations management.
- CRM synchronization beyond a future-compatible webhook boundary.

These boundaries prevent ERP complexity from entering the official website release. The architecture will preserve a migration path to PostgreSQL, object storage, external CRM, tracking, and customer portal modules.

## 4. Audience and Conversion Model

Primary audiences:

- Importers and exporters seeking international forwarding.
- Companies operating China-Russia, China-Europe, Central Asia, and global trade lanes.
- Shippers with project, oversized, dangerous, or temperature-controlled cargo.
- Procurement, supply-chain, operations, and logistics decision-makers.

Primary conversion action: submit a short enquiry.

The enquiry form contains:

- Name.
- Company.
- Email or phone.
- Transport requirement.
- Message.
- Consent to the privacy notice.

Secondary conversion actions are configurable WhatsApp, WeChat, Telegram, telephone, and email links. Each channel has an enable flag, display order, label, and target value in the administration console.

## 5. Brand System

### 5.1 Name and Logo

Brand name: AnShow.

Approved logo direction: Route Apex.

The mark is an abstract letter A formed by two converging route strokes. A cyan bridge represents connection and an orange node represents delivery. The system includes:

- Primary horizontal logo.
- Compact horizontal logo.
- Symbol-only mobile and social avatar.
- Dark-background and light-background variants.
- SVG source and production exports, plus PNG fallbacks where required.
- 32px, 48px, and 64px favicon exports.

The logo uses flat colors. It does not glow, animate, or contain gradients. Motion belongs to the surrounding interface so the brand remains stable and recognizable.

### 5.2 Visual Direction

Approved direction: Global Freight Command.

The public website combines:

- Realistic, high-quality freight operations imagery.
- Carbon-black cinematic sections.
- Bright white information chapters.
- Electric cyan route and data accents.
- Teal operational accents.
- Signal orange for primary calls to action.
- Sharp grids, restrained borders, route telemetry, and strong typography.

The site must not resemble a gaming HUD or generic cyberpunk interface. It must use solid-color surfaces and avoid gradients, decorative glowing blobs, fake terminal noise, excessive glass effects, and constant background motion.

### 5.3 Color Tokens

- Carbon background: `#06090D`.
- Elevated dark surface: `#0B1117`.
- Primary light surface: `#F5F7F8`.
- White content surface: `#FFFFFF`.
- Primary text on light: `#071018`.
- Primary text on dark: `#EEF6FB`.
- Muted text on dark: `#B9C7D1`.
- Electric cyan: `#38BDF8`.
- Operational teal: `#14B8A6`.
- Signal orange: `#F97316`.
- Error: `#DC2626`.

Semantic tokens, not raw color values, will be used in components. Normal text must meet WCAG AA contrast of at least 4.5:1.

### 5.4 Typography

- English and Russian display text: Exo 2 with Latin and Cyrillic subsets.
- English and Russian body text: Noto Sans with Latin and Cyrillic subsets.
- Simplified Chinese display and body text: Noto Sans SC.
- Data labels: Roboto Mono used only for short telemetry and numerical labels.
- Body text: minimum 16px on mobile with 1.5 to 1.7 line height.

Fonts are self-hosted in WOFF2 format, use `font-display: swap`, and load only the language subsets required by the active locale.

## 6. Motion System

The UI/UX Pro Max design dials are fixed at variance 7/10, motion 9/10, and density 4/10. High motion means coordinated visual chapters, not animation on every element.

### 6.1 Primary Motion Areas

- Homepage hero carousel: image crossfade, restrained image pan, content mask reveal, and synchronized progress indicator.
- Global route chapter: a full-width, unframed Three.js route globe or route field on capable desktop devices.
- Chapter transitions: GSAP ScrollTrigger sequences using opacity and transform, triggered once without scroll-jacking.
- Counters and proof metrics: animate once when entering the viewport.
- Menus, buttons, forms, accordions, and modals: 150 to 300ms state transitions.

### 6.2 Performance and Accessibility Rules

- Animate only transform and opacity for normal UI transitions.
- Keep one or two active animation groups in a viewport.
- Do not block input while animations run.
- Do not animate layout dimensions, top, left, width, or height.
- Do not use endless decorative animation.
- Respect `prefers-reduced-motion` across carousel, scrolling, counters, and Three.js.
- Disable the Three.js scene and expensive visual layers on low-capability devices, reduced-motion sessions, and mobile.
- Preserve readable content before JavaScript loads.

## 7. Public Information Architecture

All public routes use explicit locale prefixes:

- English: `/en`.
- Simplified Chinese: `/zh`.
- Russian: `/ru`.

The root path redirects to `/en`. Each localized page provides canonical metadata and `hreflang` links. The language switch keeps visitors on the equivalent page when that translation is published and otherwise leads to the target locale homepage.

### 7.1 Primary Navigation

- Services.
- Trade Lanes.
- Special Cargo.
- Insights.
- About.
- Contact.
- Language selector.
- Get a Quote primary action.

### 7.2 Public Pages

#### Homepage

1. Full-bleed four-slide hero carousel for ocean, air, rail, and road freight.
2. Short enquiry section.
3. Transport service overview.
4. Priority trade lanes.
5. Specialist cargo capabilities.
6. Company proof, metrics, certifications, and partners.
7. Featured case studies.
8. Latest insights.
9. Final contact call to action and configurable instant-contact channels.

#### Services

- Ocean Freight.
- Air Freight.
- Rail Freight.
- Road Freight.
- Multimodal Transport.
- Customs Services.
- Warehousing and Distribution.

Each service has a listing card and a dedicated SEO detail page.

#### Trade Lanes

- China-Russia.
- China-Europe.
- Central Asia.
- Global Network.

Each corridor page describes supported modes, typical cargo, operational strengths, process, and enquiry path without publishing unverified transit-time or coverage claims.

#### Special Cargo

- Project Cargo.
- Oversized Cargo.
- Dangerous Goods.
- Temperature-Controlled Cargo.

#### Company and Trust

- About AnShow.
- Global Network.
- Certifications and qualifications.
- Case Studies.
- Insights and News.
- Contact.

#### Utility and Legal

- Get a Quote.
- Privacy Notice.
- Terms of Use.
- Cookie Notice.
- Accessible 404 page.

## 8. Carousel and Media Experiences

The site uses carousels where sequencing provides real value:

1. Homepage hero: four slides, autoplay, pause/play control, arrows, progress, dots, keyboard navigation, and touch swipe.
2. Case studies: controlled card carousel, changing to a grid when all items fit on wide screens.
3. Partners and certificates: accessible horizontal scroller with a pause control, never an uncontrollable high-speed marquee.
4. Service and case galleries: optional image gallery with thumbnail navigation and lazy-loaded full images.

Autoplay pauses when the tab is hidden, when the carousel receives keyboard focus, when the pointer hovers over controls, and when reduced motion is enabled.

## 9. Generated Asset Deliverables

The implementation includes 23 approved source visuals, plus responsive derivatives:

- Four homepage hero scenes: ocean, air, rail, and road.
- Seven service-header scenes.
- Four trade-lane scenes.
- Four specialist-cargo scenes.
- Four trust and case visuals covering operations, warehouse, customs context, and coordination.
- Open Graph and social-sharing template exports.

Generation rules:

- Photorealistic, editorial logistics imagery with real material texture and credible operations.
- No third-party logos, watermarks, or embedded text.
- Do not fabricate AnShow-branded vehicles, facilities, employees, certifications, or documents as documentary proof.
- Leave safe negative space where HTML headings and calls to action overlay an image.
- Produce desktop-wide and mobile-portrait art direction where a crop alone would remove the subject.
- Store approved masters in the repository asset source area and production derivatives in the public media build output or Tencent COS.

## 10. Image Performance Pipeline

High-resolution masters are never served directly.

The build and upload pipeline will:

1. Validate dimensions, file type, and metadata.
2. Strip unnecessary EXIF metadata.
3. Generate AVIF and WebP variants at 480, 768, 1280, and 1920px widths.
4. Generate dedicated mobile art-direction variants for hero scenes.
5. Record intrinsic width, height, aspect ratio, dominant fallback color, and multilingual alt text.
6. Emit `picture`, `srcset`, and `sizes` markup.
7. Publish immutable hashed files to Tencent COS/CDN when COS mode is enabled.

Budgets:

- Desktop hero: at most 280KB.
- Mobile hero: at most 140KB.
- Standard content image: at most 90KB.
- Thumbnail: at most 35KB.

Only the first LCP hero is eagerly loaded and preloaded. Later hero slides load after idle time. Below-fold media is lazy-loaded. Layout space is reserved with explicit dimensions or aspect ratio to prevent CLS.

The media layer supports two drivers:

- Local persistent volume for simple deployment and development.
- Tencent COS/CDN for production global delivery.

## 11. Internationalization and Translation

There is no runtime machine translation. English, Chinese, and Russian are stored and published independently.

### 11.1 Interface Localization

Versioned locale dictionaries cover:

- Navigation.
- Buttons and labels.
- Enquiry and authentication forms.
- Validation and error messages.
- Loading, empty, success, and retry states.
- Cookie UI.
- Administration interface labels.
- Email subjects and templates.

No user-facing string is hardcoded directly in a component.

### 11.2 Editorial Localization

Every content collection has typed translation records for English, Chinese, and Russian. Translation records include:

- Title.
- Slug.
- Summary.
- Body.
- SEO title.
- SEO description.
- Image alt text.
- Locale-specific call-to-action text when required.

The initial delivery includes complete three-language content. A freight terminology glossary keeps ocean, air, rail, road, customs, corridor, and specialist cargo vocabulary consistent. Automated checks reject missing keys, untranslated strings, missing metadata, and overflowing critical controls.

Translation is natural and market-appropriate rather than literal. Public publishing is blocked when required fields for the selected locale are incomplete.

### 11.3 Truthfulness Rule

Generated content must not invent company age, shipment volume, office locations, licenses, certifications, customer logos, service guarantees, or transit times. Until official facts are configured, copy uses qualitative capability statements only. The administration console provides a first-run company profile checklist for official contact details, legal identity, verified metrics, qualifications, and privacy-controller information. Unconfigured proof modules remain unpublished rather than showing fabricated stand-ins.

## 12. Administration Console

The administration console is available at `/admin` on the production domain. It uses a quiet, work-focused interface rather than the public website's cinematic styling.

### 12.1 Dashboard

- New enquiries.
- Open and assigned leads.
- Translation gaps.
- Published items.
- Scheduled content.
- Unassigned enquiries.
- Recent activity.

### 12.2 Content Management

- Pages.
- Hero Slides.
- Services.
- Trade Lanes.
- Special Cargo.
- Case Studies.
- Insights and News.
- Partners.
- Certifications.
- Navigation and Footer.
- Media Library.

Content supports draft, published, archived, and scheduled states. Users with publish permission can publish directly. No mandatory approval workflow exists in version 1.

The editor uses English, Chinese, and Russian tabs with completion indicators. Locales publish independently.

### 12.3 Media Library

- Upload and browse media.
- Responsive derivative generation.
- Multilingual alt text.
- Focal-point selection for responsive crops.
- File usage references.
- Safe replacement and deletion checks.

### 12.4 Enquiry Management

- Search and filter.
- Status: New, Contacted, Qualified, Closed, or Spam.
- Assign an owner.
- Add internal notes.
- View immutable status history.
- Record source page, locale, and UTM data.
- Export authorized results to CSV.
- Retry failed email notifications.

### 12.5 Staff and Permissions

The Super Administrator can create, disable, and manage staff accounts and permissions.

Preset role groups:

- Super Administrator: all modules, staff, roles, security, and settings.
- Content role: configurable create, edit, translate, publish, schedule, and media permissions by collection.
- Enquiry role: configurable view, assign, update, note, and export permissions without site configuration access.

The permission system supports custom roles. Authorization is enforced on the server for every protected action.

### 12.6 Site Settings

- Company profile and verified facts.
- Addresses and contact details.
- Instant-contact channels.
- SMTP sender and notification recipients.
- Default SEO and social metadata.
- Navigation and footer settings.
- Cookie and legal settings.
- Media storage driver.
- Feature flags for optional public modules.

### 12.7 Audit Log

Audit events include:

- Login and logout.
- Failed authentication attempts.
- Account and role changes.
- Content create, edit, publish, unpublish, archive, and schedule actions.
- Enquiry assignment and status changes.
- Settings and contact-channel changes.
- Media deletion and replacement.

## 13. Technical Architecture

### 13.1 Application Shape

A single Next.js TypeScript application contains:

- Public locale routes.
- Administration routes.
- Server-rendered content pages.
- Route handlers and server actions.
- Authentication and RBAC.
- Enquiry and notification services.
- Media processing and storage adapters.
- Scheduled maintenance entry points.

Implementation components:

- Next.js App Router and TypeScript.
- Tailwind CSS with custom public-site components and restrained shadcn/ui primitives for the admin console.
- Drizzle ORM with SQLite migrations.
- Auth.js with database-backed sessions and a credentials-based staff login flow.
- Argon2id password hashing.
- next-intl for typed locale routing and interface dictionaries.
- Embla Carousel for accessible carousel behavior.
- GSAP and ScrollTrigger for public-site choreography.
- Three.js for the desktop route scene.
- Sharp for server-side image derivatives.
- Lucide icons for interface controls.
- SMTP through a configurable provider.

Three.js, GSAP-heavy scenes, and below-fold feature code are dynamically imported. The main page remains functional without them.

### 13.2 Database

SQLite runs with:

- WAL mode.
- Foreign keys enabled.
- Busy timeout configured.
- Versioned migrations.
- Transactional writes for publishing and enquiry intake.
- Online backup rather than copying a live database file.

Core table groups:

#### Identity

- users.
- roles.
- permissions.
- user_roles.
- role_permissions.
- sessions.

#### Content

- pages and page_translations.
- hero_slides and hero_slide_translations.
- services and service_translations.
- trade_lanes and trade_lane_translations.
- cargo_types and cargo_type_translations.
- case_studies and case_study_translations.
- articles and article_translations.
- partners and partner_translations.
- certificates and certificate_translations.
- navigation_items and navigation_item_translations.
- media_assets and media_asset_translations.

#### Leads

- inquiries.
- inquiry_notes.
- inquiry_history.
- notification_deliveries.

#### Configuration and Traceability

- site_settings.
- contact_channels.
- audit_logs.
- rate_limits.

Shared identity, ordering, visibility, timestamps, and publish state stay on base records. Language-specific slugs, text, SEO, and alt text stay in typed translation tables. Generic EAV content and opaque JSON translation blobs are not used.

### 13.3 Enquiry Flow

1. Validate fields, consent, locale, origin, honeypot, and rate limit.
2. Persist the enquiry and source metadata in one transaction.
3. Insert a notification job into the database-backed outbox in the same transaction.
4. Return a localized success response after persistence.
5. Let the worker claim outbox jobs, send SMTP notifications, and record delivery attempts.
6. Retry transient email failures without creating duplicate enquiries.
7. Let authorized staff assign, note, update, qualify, close, or mark the enquiry as spam.

## 14. Security Design

- Argon2id password hashing.
- Secure, HttpOnly, SameSite cookies.
- Database-backed session rotation.
- Invalidate sessions after password, role, or account-status changes.
- Default-deny RBAC on every protected server action and route.
- CSRF protection and origin validation for state-changing requests.
- Content Security Policy and standard security headers.
- Parameterized ORM queries and output encoding.
- Login and enquiry rate limits.
- Honeypot and submission-time checks. CAPTCHA is outside the version 1 scope and can be added behind the enquiry boundary if abuse data later justifies it.
- MIME, file-signature, dimension, and size validation for uploads.
- Randomized stored filenames and a non-executable upload location.
- Audit records for security-sensitive and business-sensitive actions.
- Secrets provided only through environment variables or Docker secrets.

## 15. Tencent Cloud Deployment

### 15.1 Docker Compose Services

- `app`: production Next.js standalone container.
- `worker`: the same application image running database-backed notifications, scheduled publishing, and maintenance jobs.
- `caddy`: public reverse proxy, HTTP-to-HTTPS redirect, automatic certificate issue and renewal.
- `backup`: scheduled SQLite, upload-manifest, and configuration backup process.

Persistent storage:

- SQLite data volume.
- Local media volume when local media mode is active.
- Caddy data and configuration volumes.
- Temporary backup staging volume.

### 15.2 Network and Domain

- Tencent Cloud DNS A record points the production domain to the CVM public IP.
- CVM security group exposes ports 80 and 443.
- The application container is reachable only from the internal Compose network.
- Caddy proxies the configured production domain and `/admin` to the application.
- Caddy automatically obtains and renews publicly trusted TLS certificates.

### 15.3 Deployment Behavior

- Multi-stage Docker build.
- Non-root application runtime.
- Health checks for app and proxy.
- Database migrations run as an explicit deploy step before traffic is switched to the new application.
- Deployment fails closed if migration or health checks fail.
- Persistent volumes are never replaced by a normal image update.
- Environment validation stops startup when required production settings are absent.

## 16. Backup and Recovery

Daily backup flow:

1. Use the SQLite online backup API to create a consistent snapshot.
2. Create a manifest of media and configuration.
3. Compress and encrypt the backup bundle.
4. Upload the bundle to Tencent COS.
5. Apply COS lifecycle retention for 7 daily, 4 weekly, and 6 monthly recovery points.
6. Record backup success or failure and notify an administrator on failure.

Recovery verification:

- Restore a scheduled sample backup into an isolated directory.
- Run SQLite integrity checks.
- Verify expected tables and media manifest.
- Record the restore-test result.

The deployment documentation includes full restore procedures for database, media, Caddy state, and application redeployment.

## 17. Performance and Accessibility Requirements

Targets on representative production hardware and network conditions:

- Largest Contentful Paint below 2.5 seconds.
- Cumulative Layout Shift below 0.1.
- Interaction to Next Paint below 200ms.
- WCAG 2.2 AA for public and administration interfaces.
- No horizontal scrolling at 375px width.
- All interactive targets at least 44 by 44 CSS pixels on touch devices.
- Keyboard navigation and visible focus for every interactive element.
- Meaningful alt text for informational images.
- Reduced-motion behavior tested across all animated areas.

Performance measures:

- Server rendering and caching for public content.
- Route-level code splitting.
- Dynamic import of Three.js and heavy GSAP scenes.
- Responsive images and strict asset budgets.
- Self-hosted subset fonts.
- Long-lived immutable cache headers for hashed assets.
- Lazy load media and below-fold interactive modules.
- Pause animation and carousel work when the tab is hidden.

## 18. Error Handling

- Public forms show field-specific localized errors and preserve valid input.
- Enquiry persistence failure shows a retry path and never claims success.
- Email failure does not discard a persisted enquiry.
- Admin errors include a cause, recovery action, and correlation identifier where useful.
- Media-processing failures keep the original upload quarantined and do not publish incomplete derivatives.
- Missing localized public content leads to the locale homepage or an explicit unavailable state, never a mixed-language page.
- Database migration, backup, COS, and SMTP failures are logged with actionable operational messages.

## 19. Verification Strategy

### 19.1 Unit Tests

- Locale and slug validation.
- Translation completeness.
- RBAC decisions.
- Enquiry status transitions.
- Settings validation.
- Media derivative selection.

### 19.2 Integration Tests

- Content create, edit, schedule, publish, unpublish, and archive.
- Locale-independent publishing.
- Session rotation and invalidation.
- Staff account and role changes.
- Enquiry persistence and SMTP retry.
- SQLite migrations.
- Backup and restore integrity.
- Local and COS media drivers.

### 19.3 Browser End-to-End Tests

- English, Chinese, and Russian navigation.
- Language switching while preserving page context.
- Homepage carousel controls and reduced motion.
- Enquiry validation, submission, success, and failure recovery.
- Admin login, content editing, translation completion, publishing, and permissions.
- Mobile navigation, forms, carousels, and readable layouts at 375px.

### 19.4 Visual and Runtime Verification

- Playwright screenshots at 375, 768, 1024, and 1440px.
- Pixel checks that the Three.js canvas is nonblank and correctly framed on supported desktop viewports.
- Mobile verification that the heavy route scene is not downloaded or mounted.
- Accessibility checks with axe plus keyboard and focus review.
- Lighthouse/Core Web Vitals checks using production builds and optimized media.
- Docker Compose cold-start, restart, certificate, migration, backup, and restore smoke tests.

## 20. Delivery Contents

The completed implementation delivers:

- Public AnShow website in English, Chinese, and Russian.
- Route Apex logo system and favicon exports.
- Approved generated logistics imagery and responsive derivatives.
- Homepage and supporting page animation system.
- Responsive desktop, tablet, and mobile layouts.
- Administration console and first-run company profile checklist.
- Staff users, custom roles, and server-enforced permissions.
- Multilingual content, SEO, forms, emails, errors, and alt text.
- Enquiry management and email notification workflow.
- SQLite schema, migrations, seed content, and backup tools.
- Local and Tencent COS/CDN media modes.
- Docker Compose and Caddy configuration.
- Tencent Cloud DNS, firewall, deployment, update, backup, and restore documentation.
- Automated test suite and performance/accessibility verification evidence.

## 21. Delivery Sequence

1. Foundation: repository, Next.js, design tokens, locale routing, database, authentication, and Docker baseline.
2. Public shell: logo, header, navigation, footer, locale switcher, responsive layout, and SEO foundation.
3. Content system: typed collections, translations, media library, publishing, and settings.
4. Public pages: homepage, services, corridors, special cargo, company, cases, insights, contact, and legal pages.
5. Visual assets and motion: generated assets, responsive derivatives, carousels, GSAP choreography, and Three.js desktop scene.
6. Lead operations: enquiry intake, notifications, administration workflow, export, and audit history.
7. Security and operations: hardening, rate limits, COS/CDN, backup, restore verification, and deployment documentation.
8. Quality gate: unit, integration, E2E, visual, accessibility, performance, and production smoke testing.

This sequence keeps the public experience, administration console, and operational deployment independently testable while preserving one deployable application.
