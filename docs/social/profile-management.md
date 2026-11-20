# Social profile management

Open Social media → Social workspace → Profiles, or choose Profile on a Studio channel. The profile editor stays in the workspace and shares the brand selector with Studio and Monthly report. The calendar’s Social profiles button still opens the shared editor in a drawer. The editor reuses the dashboard Select, field/button styles, avatar and discard-confirmation dialog. Deep links accept `?brand=...&platform=facebook` or `instagram`.

Administrators can update Facebook About, description, website, phone and email. Failed saves preserve the draft. Members can view permitted brands. Instagram bio and website are read-only in Finvera. Administrators can choose **Edit in Instagram** to open Instagram settings in a new tab. Use **Refresh details** to retrieve the latest profile after saving there. **Refresh photo** retrieves the current platform picture. To change a Facebook Page’s name or photo, use Facebook.

## Meta app visible only to the owner

Confirm where the app is missing:

- Developer dashboard: check app Roles/access assignments and accepted invitations.
- Another Business Portfolio's Apps list: check Business Settings → Accounts → Apps, app ownership and shared/requested access using the app ID. Connecting a client Page does not make that business an app owner.
- Other clients cannot connect through Finvera: check publishing status where applicable, App Review/Permissions and features or the relevant use case, approved access for external users, business verification requirements, and the connecting person's access to the selected Page and Instagram account. Reconnect after permissions change. Giving every client app administrator access is not a production onboarding solution.

Finvera requests `pages_manage_metadata` by default for Facebook Page detail editing. After Meta approves access for the applicable users, reconnect the brand with an account that can manage the Page. Open Readiness & actions to verify the connected Page received the grant. Meta also checks whether the requested field can be updated through the configured Graph API version.

App review, ownership, mode and verification cannot be confirmed from repository code. Check privately in https://developers.facebook.com/apps/ and https://business.facebook.com/settings/.

Pending external checks: permission approval, other-business onboarding, and authorized live-account profile updates. Local browser checks use mocked responses and do not change Meta profiles.
