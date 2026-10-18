# SEEN media

`source/` contains the unchanged supplied files. All 25 relocated files were checked against their pre-move SHA-256 hashes; `source/relocation-inventory.json` records original names and new paths. Never edit an original to prepare a website image.

`manifest.json` maps photographs to provisional design IDs and factual visual captions. These groupings need the client's confirmation alongside official product details. Seven groups are photographed; the store is planned for eight. Multiple views of one garment are kept in the same group.

- design-01: Burgundy, four views
- design-02: Botanical detailing, two views
- design-03: Lace detailing, two views
- design-04: Soft charcoal, two views
- design-05: Textured charcoal, one view
- design-06: Polka dots, two views
- design-07: Soft neutral, two views

`source/duplicates/` preserves three byte-identical duplicate photos. `source/videos/unassigned/` preserves six MOV files; do not publish or assign them until the content and garment mapping are confirmed.

To add media, place uploads in `incoming/`, confirm which design and view they show, move originals into the matching source directory, and update the manifest. Run:

```text
npm run prepare:media
```

The script auto-orients images, resizes within 1800 × 2200 without enlargement, and encodes WebP copies without EXIF/XMP metadata. It writes prepared images to `public/images/`, browser-safe data to `src/data/media.generated.json`, and source hashes/output dimensions to `media-inventory.json`. It does not retouch garments, overwrite source files, guess stock, or create commercial product records. Source videos are not copied to the public directory.
