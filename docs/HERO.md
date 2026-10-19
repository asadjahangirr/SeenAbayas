# Homepage film

The supplied campaign film is the permanent homepage design. `/` always renders `FilmHero`; there is no feature flag, filesystem check or photographic hero alternative. Old `hero` query parameters no longer change the design, and the homepage declares `/` as its canonical URL. Search indexing still follows the existing site-wide setting.

The required public assets are included with the project rather than ignored local test files:

- `public/videos/home/hero.mp4`
- `public/images/home/hero-poster.webp`
- `public/images/brand/seen-signature.svg`

`assets/home-hero.json` records the original filename, SHA-256, bytes, dimensions, duration and public paths. The video was promoted byte-for-byte from the supplied source. It is approximately ten seconds, 1280 x 720 and 3.5 MB. No artificial upscaling or extra video compression is applied. The poster is prepared as WebP. Original product photographs remain available to the collection, product pages and curated homepage edit.

To deliberately replace the campaign media, run:

```powershell
npm.cmd run prepare:hero -- 'C:/path/to/approved-campaign.mp4'
```

The preparation utility uses Playwright with system Edge on Windows (Chromium elsewhere) to inspect the source and extract frames. It updates the public video/poster and manifest. Commit those updated assets with the site. Ordinary development/builds use the included files and need no media preparation or video environment variable.

The supplied transparent brand artwork is preserved at `assets/source/brand/seen-transparent.png`. `npm run prepare:brand` creates an SVG viewport excluding the small tagline and retaining the original Arabic emblem and SEEN lettering. The hero, navbar and footer share that signature.

The film fills the viewport below the black delivery announcement. Navigation begins as a transparent overlay with white text/icons and becomes white with dark text/icons as the logo docks, reversing on upward scroll. The slogan and collection link sit at the lower left. Responsive positioning keeps the copy and logo separate on small portrait and landscape screens. Other pages use the ordinary white sticky header.

Playback is muted, inline and looped, and pauses offscreen/in hidden tabs. It resumes on page restoration or reconnection while the hero is visible. Ordinary playback has no Pause button or native controls. Reduced motion and data saving start with the poster without downloading the film; a discreet Play campaign film button lets the visitor explicitly choose playback. The same recovery button appears after an autoplay rejection or load error, retaining mobile user activation by calling play directly inside the tap handler. Reduced motion also docks the logo and white navbar immediately. The absence of a manual pause control means automated accessibility scans must not be described as complete WCAG conformance.

Run `npm.cmd run build`, `npm.cmd run test:film-ui`, `npm.cmd run test:mobile-ui` and the relevant foundation checks. The media suite no longer skips missing local files: the hero assets are now required project files. The mobile suite uses Android/Chrome touch emulation and isolated Supabase fixtures. Physical Android and iPhone/Safari playback remain separate device checks.
