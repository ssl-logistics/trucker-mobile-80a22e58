Remove the "Ref: ..." line from cleared job cards on the Payment Summary page.

- Delete the Ref line under "เคลียร์ผ่าน" in cleared cards.
- The reference is still saved and sent to the main system; only the on-screen line goes away.

Technical: remove line 191 of `src/pages/CodClearPage.tsx` (`s.record.clear_reference` div).
