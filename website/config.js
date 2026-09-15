// Public identifiers only (no secrets). SPA app registration in the Septagon Consulting tenant.
window.PM_CONFIG = {
  clientId: "e14e65e9-38ff-47d0-8692-86c6cca7c6b2",
  tenantId: "28f3df7e-b260-48f9-9c0b-6e5bc1c9b7b4",
  scopes: ["User.Read", "Files.Read.All"],
  // SharePoint site that holds the media (Documents library › Audio, Video)
  siteHost: "septagonconsulting.sharepoint.com",
  sitePath: "/sites/PapasMemories",
  // Cloudflare Turnstile site key (public). Leave "" to turn the human check off.
  turnstileSiteKey: "0x4AAAAAAE1QDDTRPqXysEAo",
  ownerUpn: "s.subiah@septagon.com.au",
  folders: ["Audio", "Video", "Mama"]
};
