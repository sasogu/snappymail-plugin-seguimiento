# Changelog

## 0.1.9 — 2026-10-16

- Add Catalan throughout the interface: launchers, editor, filters, states,
  placeholders, empty views, dates, notifications and validation errors.
- Follow SnappyMail's selected language, including changes without reloading.
  Recognize Catalan regional variants and preserve Spanish as the fallback.
- Preserve stored states, notes and existing follow-ups across language changes.
- Translate known server errors and use a generic message for unknown failures.
- Verify Spanish/Catalan behavior with synthetic and live browser tests.

## 0.1.8 — 2026-10-16

- Add **Quitar seguimiento** beside **Editar** for direct removal from the list,
  preserving the email and any unrelated follow-up being edited.
- First standalone public distribution of the existing Seguimiento plugin.
- Track need-to-reply, waiting and resolved messages, review dates and notes.
- Filter follow-ups for the active account and reopen messages by Message-ID.
- Isolate data by authenticated main user and account in private SQLite storage.
- Use SnappyMail private data storage by default, with `SEGUIMIENTO_DB` override.
- Allow `SEGUIMIENTO_TIMEZONE` override; retain Europe/Madrid as default.
- Respect the host's global logging configuration.
- Spanish interface; English and Spanish installation/use documentation.
