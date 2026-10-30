Make the required-photo asterisk red on the extra-point check-in page.

- In `src/pages/ExtraPointCheckinPage.tsx` line 137, wrap the `*` after the "ถ่าย/เลือกรูป" label in a `<span className="text-destructive">*</span>` so only the asterisk turns red; label text stays gray.
