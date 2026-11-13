# Social profile management

Open Social media → Social profiles, the calendar’s Social profiles button, or a Studio Profile button. Calendar and Studio open the shared editor in a drawer without changing the current route. The editor reuses the dashboard Select, field/button styles, avatar and discard-confirmation dialog. Deep links accept `?brand=...&platform=facebook` or `instagram`.

Administrators can update Facebook About, description, website, phone and email. Failed saves preserve the draft. Members can view permitted brands. Instagram details are read-only. Instagram edits and Facebook name/photo writes are unavailable in the connected editor; it does not redirect users to an external editing page. Refresh photo retrieves the current platform picture; it does not upload one.

## Meta app visible only to the owner

Confirm where the app is missing:

- Developer dashboard: check app Roles/access assignments and accepted invitations.
- Another Business Portfolio's Apps list: check Business Settings → Accounts → Apps, app ownership and shared/requested access using the app ID. Connecting a client Page does not make that business an app owner.
- Other clients cannot connect through Finvera: check publishing status where applicable, App Review/Permissions and features or the relevant use case, approved access for external users, business verification requirements, and the connecting person's access to the selected Page and Instagram account. Reconnect after permissions change. Giving every client app administrator access is not a production onboarding solution.

Facebook detail editing needs `pages_manage_metadata`, configured through backend `META_EXTRA_SCOPES` after appropriate approval, followed by reconnecting the brand. The Channels readiness check reports actual token/asset grants. Scope presence alone does not prove a field write will succeed.

App review, ownership, mode and verification cannot be confirmed from repository code. Check privately in https://developers.facebook.com/apps/ and https://business.facebook.com/settings/.

Pending external checks: permission approval, other-business onboarding, and authorized live-account profile updates. Local browser checks use mocked responses and do not change Meta profiles.
