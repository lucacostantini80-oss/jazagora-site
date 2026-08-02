# Jazagora welcome emails

- `welcome-it.html`: Italian transactional welcome email.
- `welcome-en.html`: English transactional welcome email.
- `assets/jazagora-email-orbit.gif`: animated three-orbit decoration.
- `assets/jazagora-email-orbit-static.png`: first-frame fallback.

Upload the whole `email-templates` directory to the root of `jazagora-site` so the image URL used by both templates remains:

`https://jazagora.com/email-templates/assets/jazagora-email-orbit.gif`

The templates use table layout and inline styles for broad compatibility with Zoho Mail, Gmail, Yahoo and Outlook. The welcome message is transactional; promotional consent must remain separate.
