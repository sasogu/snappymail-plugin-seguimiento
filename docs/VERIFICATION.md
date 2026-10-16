# Verification — 0.1.10, 2026-10-16

## Launcher text regression

- Both sidebar and message button expressions are evaluated with SnappyMail's
  actual Knockout text binding in the synthetic browser fixture. Their labels
  must read Seguimiento → Seguiment → Seguimiento across language changes.
- Live integration verifies the sidebar label before testing Catalan validation
  and direct removal using temporary synthetic follow-ups. No email is opened
  or modified.
- The previous tests checked the label helper and popup text but did not bind
  the launcher text expressions; this regression check covers that gap.

## Catalan interface

- JavaScript tests cover regional variants, Spanish fallback, translated states,
  notices and validation errors, and changes of language without page reload.
  Unknown upstream error text is not displayed.
- Synthetic Chromium tests switch the open editor from Spanish to Catalan and
  back, retaining the selected state and note. Both languages can save and remove
  follow-ups. Desktop/mobile captures contain synthetic metadata only.
- Live integration against the existing installation verifies the actual Catalan
  panel and a translated server-side invalid-date error, plus removal on desktop
  and mobile while preserving the unrelated editor. Temporary synthetic records
  are cleaned up; no mail is opened or modified and no saved language preference
  is changed.
- Existing PHP store/backend and JavaScript behavior tests pass.

## Initial standalone distribution

The plugin originated in an existing SnappyMail 2.38.2 installation where
saving, updating, deleting and locating follow-ups were verified through the
authenticated API and browser. This public distribution changes the default
storage path to SnappyMail private data, allows a timezone override and leaves
global logging configuration to the installation administrator.

Standalone distribution checks:

- Store tests: isolation by user/account, persistence, status/date validation,
  due items, removal and preservation of unrelated follow-ups.
- Backend tests: authenticated session identity, rejection of anonymous sessions,
  ignored browser-supplied owner/account identifiers, cross-account denial,
  input validation and persistence across plugin instances.
- UI tests: filters, save/edit/remove behavior and failure recovery.
- Synthetic browser tests: sidebar launcher, actual editor controls, saving,
  filters and removal at desktop and mobile sizes. No login or real mail access.
- Live integration against the existing installation: row removal on desktop
  preserves an unrelated editor; row removal on mobile closes the matching editor.
  Both synthetic follow-ups are removed from the server. No emails are opened
  or modified, and no real-mail screenshots are saved.
- PHP and JavaScript syntax checks. Synthetic screenshots only.

Compatibility with SnappyMail versions other than 2.38.2 is unverified.
The UI supports Spanish and Catalan. Review dates use the browser local date in the interface;
the stored overdue flag defaults to Europe/Madrid. Reply detection and external
notifications are not implemented.
