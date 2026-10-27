Add an eye icon on each delivery stop in the Payment Summary job cards to view payment proof.

- Eye icon next to the stop amount, in both dropdowns (QR and cash).
- Tap opens a centered popup with the stop name, amount, and proof photos (slip / cash photo) taken at that stop's payment check-in. Tap a photo to enlarge.
- No photos: popup shows "ไม่ได้แนบหลักฐาน" (not attached).
- All texts in 4 languages (th / en / zh / ko), following the app language.
- View only; amounts and clearing are unchanged.

Technical:
- `src/lib/codClear.ts`: add `proofUrls?: string[]` to `CodSummaryPoint`, filled in `summarizeCod` from the matching payment check-in's `cod_proof_urls` (+ photo fields if present).
- `src/pages/CodClearPage.tsx`: `Eye` icon button per stop (stopPropagation), `Dialog` with `ProofImg` (presigned) thumbnails; new `SUM_TXT` labels `proofTitle`, `noProof`.
