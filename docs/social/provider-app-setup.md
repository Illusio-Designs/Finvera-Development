# Create the Pinterest, YouTube and LinkedIn apps

Checked against provider documentation on 6 November 2026. These are separate developer applications, like the existing Meta application. Creating an app does not enable a Finvera connector or grant production publishing access.

## Prepare once

Use an organization-owned developer account, a monitored support email and real brand assets. Suggested app name: **Finvera Social**. Homepage: `https://www.finvera.solutions`. Privacy policy: `https://www.finvera.solutions/privacy`. Terms: `https://www.finvera.solutions/terms`. Review the policies so they accurately describe the new providers, data stored, retention, disconnection and deletion before submitting for review.

Reserve these exact HTTPS redirect URIs. They are **proposed routes, not implemented callback handlers** in the current release. You can register them now; OAuth testing must wait for each connector. Do not substitute the frontend dashboard URL or the Meta callback.

| Provider | Proposed server redirect URI |
| --- | --- |
| Pinterest | `https://api.finvera.solutions/api/social-connect/pinterest/callback` |
| Google / YouTube | `https://api.finvera.solutions/api/social-connect/youtube/callback` |
| LinkedIn | `https://api.finvera.solutions/api/social-connect/linkedin/callback` |

Store client secrets only in the backend deployment's secret configuration. Never put secrets in `NEXT_PUBLIC_*`, commits, screenshots or chat. The environment variable names for these connectors will be defined when implemented; merely adding a secret today will not turn a channel on.

## 1. Pinterest

1. Open [Pinterest Developers](https://developers.pinterest.com/apps/). Sign in with the **business account** that will administer the application and verify its email.
2. Open **My apps**, accept the developer terms and choose **Connect app**. Complete the app request form, with the real website, purpose and required details. The app name needs at least three Latin letters/numbers and cannot contain the word “Pinterest”.
3. Submit the request for **Trial access**. Pinterest reviews even this initial application; wait for its email decision. Approval timing is controlled by Pinterest.
4. After approval, open **My apps → Manage → Configure**. Record the App ID and App secret in the secure backend configuration. Add the exact proposed Pinterest redirect URI above and save it. Pinterest requires an exact match and no secondary redirect from the callback.
5. For the first Finvera release, plan the endpoint-required grants for identity, board selection and image Pins. The current Create Pin specification lists `boards:read`, `boards:write`, `pins:read`, `pins:write`; account identity/eligible account analytics uses `user_accounts:read`. Check the app's approved access and the current endpoint scope requirements when implementing authorization.
6. Use the permitted trial account(s) and a clearly named test board. After OAuth and publishing are implemented, demonstrate: connect → select board → review image Pin → publish → receive Pin ID/link → disconnect. An app-approved product-limited test token can help initial API exploration; it expires after 24 hours and does not replace the production OAuth flow.
7. Apply for the appropriate production/Standard access tier before offering connections to client accounts beyond trial eligibility. Follow the portal's current access-tier requirements and provide the working use case, policies and demonstration it requests.

Start with image Pins. Add video uploads and eligible analytics as later capabilities; do not promise Instagram Story/Reel equivalents.

## 2. Google Cloud / YouTube

1. Open [Google Cloud Console](https://console.cloud.google.com/), create a project such as **Finvera Social**, and select it.
2. Go to **APIs & Services → Library**, find **YouTube Data API v3**, and enable it. Enable **YouTube Analytics API** later if adding channel/video analytics beyond Data API reads.
3. Open **Google Auth Platform** (or the OAuth consent settings exposed by the console). Complete **Branding** with the app name, support/contact emails, logo and real homepage/privacy/terms links. Add and verify the owned `finvera.solutions` domain where Google requires it.
4. In **Audience**, choose **External** when connecting clients outside your Google Workspace. Add the Google accounts used for development as test users while the app is in Testing. Those accounts need access to a real YouTube channel. Testing status and Google OAuth policy can impose refresh-token restrictions; implement reconnect handling and check the current policy before production.
5. In **Data Access**, add `https://www.googleapis.com/auth/youtube.upload` for uploads and `https://www.googleapis.com/auth/youtube.readonly` for identifying/reading the channel. Request `https://www.googleapis.com/auth/yt-analytics.readonly` only when implementing the Analytics API. Other operations, including some metadata/playlist changes, need their own endpoint-supported scopes; upload permission is not universal account-management permission.
6. In **Clients → Create client**, choose **Web application**. Add the exact proposed YouTube redirect URI above under **Authorized redirect URIs**. Save the Client ID and Client secret server-side. A browser JavaScript origin is only needed if the chosen implementation actually uses Google's browser SDK; this plan uses a server-side authorization-code exchange.
7. Once the Finvera adapter exists, test channel selection, OAuth state checking, offline access/refresh, resumable upload, processing status and custom thumbnails where the channel supports them. Confirm title, visibility, audience/made-for-kids and any required disclosures in review. There is no separate “upload Short” endpoint; YouTube applies its current Shorts rules.
8. Complete the console's required OAuth verification before public use with sensitive/restricted grants, and review YouTube API compliance/audit and quota requirements for the actual app. A consent-screen launch is not an unlimited upload quota. The current videos.insert reference says unverified projects' uploads are not inherently forced to private mode; do not rely on outdated blanket private-only guidance.

## 3. LinkedIn

1. Open [LinkedIn Developers → My apps](https://www.linkedin.com/developers/apps), select **Create app**, and associate it with your company's LinkedIn Page. Provide the requested logo, privacy policy and app details.
2. Have an authorized Page admin verify the application's association using the verification option provided by the portal.
3. Open the app's **Auth** tab, record the Client ID and Client secret securely, and add the exact proposed LinkedIn redirect URI above under authorized OAuth redirect URLs.
4. Under **Products**, request **Sign In with LinkedIn using OpenID Connect** for identity (`openid`, `profile`) and **Share on LinkedIn** for member publishing (`w_member_social`). Request email only if a real feature needs it. Check that approved scopes appear in the Auth tab before requesting them in OAuth.
5. For **company Page publishing**, separately request the appropriate **Community Management API** product/access through the portal. Organization writing uses `w_organization_social`; reading/reporting can require `r_organization_social` and additional endpoint-specific organization/administration access. Product approval and an eligible Page role are both required. Member sharing alone does not authorize company publishing or discovery of every Page.
6. After implementation and access approval, connect a test member, confirm identity and author, and review/publish a text or image post. Test the authorized company Page separately. Store the returned post URN and recover safely from uncertain results before retrying.
7. Submit the working integration and required review evidence for broader organization access/tier as the portal instructs. Do not promise universal member analytics: `r_member_social` is restricted. Pin a supported monthly LinkedIn API version in the adapter and track retirement dates.

## What is needed before clients can use Connect

For each provider, implement server OAuth callbacks with state validation, protected token storage, granted-scope checks, refresh/reconnect and revoke/disconnect behavior. Add an account selector/readiness card, provider-specific draft/review fields, media processing, one publish job per destination and safe retries that skip destinations already live. Complete controlled test-account publishes, then enable only the capabilities the app actually has. The existing Meta connection must remain functional throughout.

Recommended order: **Pinterest image Pins → YouTube videos/thumbnails → LinkedIn member posts → approved company Page publishing**. Provider review waiting time can run alongside development.

## Official setup references

- [Pinterest: Connect app, trial access and redirect configuration](https://developers.pinterest.com/docs/getting-started/set-up-app/)
- [Pinterest API scope specification](https://github.com/pinterest/api-description/blob/main/v5/openapi.yaml)
- [Google: server-side OAuth for YouTube](https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps)
- [YouTube: videos.insert and current restrictions](https://developers.google.com/youtube/v3/docs/videos/insert)
- [LinkedIn: API access and products](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access)
- [LinkedIn: Share on LinkedIn product and member scope](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin)
- [LinkedIn: Posts API and organization role requirements](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)
