# Verification — 0.1.8, 2026-10-16

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
The UI is Spanish. Review dates use the browser local date in the interface;
the stored overdue flag defaults to Europe/Madrid. Reply detection and external
notifications are not implemented.
