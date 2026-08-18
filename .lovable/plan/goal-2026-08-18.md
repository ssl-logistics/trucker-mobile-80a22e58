Disable mandatory expense enforcement for international container return

## Goal
Temporarily disable the hardcoded expense requirement for international (BL and Booking) container-return jobs, so drivers can complete the return without being forced to add specific expenses first. Manual expense entry remains available.

## Changes

1. In `src/pages/ContainerSOPPage.tsx`, comment out the `checkMissingExpensesForReturn()` calls that currently block the workflow:
   - The check in `openPhotoDrawer` when the EIR slot is opened during container return (around line 700-703).
   - The check in the container-return confirmation path (around line 1044-1048).

2. Leave the `checkMissingExpensesForReturn` function and the `MissingExpenseDialog` component untouched so they can be re-enabled quickly.

## Outcome
- Drivers can open the EIR photo drawer and confirm container return on BL and Booking jobs without the missing-expense dialog.
- The "Add Expense" page remains accessible and unchanged, so drivers can still add expenses voluntarily.
- Other validations (EIR photo required, container number match, etc.) are not affected.

## Verify
After applying, trigger a container return on a BL or Booking job and confirm that the workflow completes without asking for `return_container`, `pickup_container`, or `port_fee` expenses.
