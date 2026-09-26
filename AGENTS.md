# System Alert Manager: notes for contributors and AI assistants

## UI consistency (@nuvriqo/ui)

This app uses the shared Nuvriqo UI kit (`@nuvriqo/ui`). The style guide is in [rdersley/nuvriqo-ui](https://github.com/rdersley/nuvriqo-ui) (`docs/STYLE_GUIDE.md`), and also under `static/admin/node_modules/@nuvriqo/ui/docs/` after install.

- No hardcoded colours in app CSS. Use `var(--nq-*)` tokens. Each `static/*` build runs `nuvriqo-ui-check src` first, so CI fails on a hardcoded colour.
- New screens use the kit's classes/components: `nq-header`, `nq-tabs`, `nq-card`, `nq-notice`, `nq-empty`, `nq-loading`, `nq-table`, `nq-btn`, `nq-field`, `nq-actionbar`, `nq-footer`.
- Every Custom UI resource calls `enableTheme(view)` from `@nuvriqo/ui/theme` at start-up.
- If a pattern is missing, add it to the `nuvriqo-ui` repo and bump the version. Don't restyle it locally.

System Alert Manager specifics:

- Each Custom UI resource (`static/admin`, `static/alert`, `static/panel`) has `@nuvriqo/ui` as its own dependency. Bump the tag in all three together.
- The admin header is the standard `nq-header`. The setup wizard (`setup-wizard.js`) adds its "Setup guide" button to `.nq-header__meta`.
- Email HTML (template previews and defaults in `static/admin/src/main.js`, and email rendering in `src/`) keeps real hex colours. Email clients don't run inside Jira, so tokens can't be used there.
