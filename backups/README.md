# Backups

Database dumps must **never** be committed. They can contain password hashes, emails, and other PII.

Store dumps outside the repository (or in encrypted private storage). Keep this directory for local operational use only; `*.sql` / `*.dump` are gitignored.
