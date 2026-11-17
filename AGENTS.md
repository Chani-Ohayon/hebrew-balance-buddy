<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Persist payment status per settlement and financial calculation snapshot; changes to expenses or group membership must not reuse obsolete paid flags.
- Gmail reminders use client-side compose links with BCC recipients, never automatic email sends or account connectors.
- Group data uses owner-scoped RLS across every related table; existing unowned groups stay inaccessible until their owners are verified.
- Private routes live under the client-only authenticated layout; query caches are identity-scoped and cleared before sign-out to prevent cross-account disclosure.
