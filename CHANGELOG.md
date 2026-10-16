# Changelog

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
