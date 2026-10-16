export default function Privacy() {
  return (
    <main className="login">
      <h1>Your workspace, your data</h1>
      <p>
        Creator Intelligence stores public YouTube records, authorized channel
        reports, and your original drafts locally in PostgreSQL. Public API
        metadata and statistics expire after 30 days. There is no invented
        earlier history.
      </p>
      <p>
        Google tokens are encrypted at rest. This app requests channel-read and
        Analytics-read access. Existing production publishing tools remain
        separate. Requests go only to official YouTube APIs and to a ContentOS
        receiver you configure and approve.
      </p>
      <p>
        Settings provides export, disconnect, and deletion. Disconnect removes
        this app’s owner reports. Delete removes its drafts and cached records
        as well. Local disconnect does not revoke the shared Google project:
        Google account revocation also invalidates other clients that share
        the same Google project. Only take that account-level action when you
        intend to disconnect all of them. Delete also removes this app’s managed
        daily draft backups. Any separately downloaded exports or manual backups
        remain the operator’s responsibility; restoring them can restore drafts
        that were previously deleted. Provider caches and Google tokens are
        excluded from draft backups.
      </p>
      <p>
        Google API data is used in accordance with the Google API Services User
        Data Policy, including Limited Use requirements. There is no
        advertising, sale of data, built-in model-training workflow, or mandatory
        hosted model provider. A connected AI client may process requested
        records under its provider terms and account settings; verify those
        settings before sharing private reports.
      </p>
      <p>
        This is an open-source application intended for private local use. Public Google verification and
        governed analytics approval have not been claimed.
      </p>
      <p>
        Google consent can be withdrawn using the separately confirmed
        project-wide revocation action in Settings or{" "}
        <a href="https://security.google.com/settings/security/permissions">
          Google Account permissions
        </a>
        . Both affect other clients if they share the same Google project.
        Removing only this app’s local connection does not withdraw the shared
        Google grant.
      </p>
      <p>
        This application uses YouTube API Services. Use is subject to the{" "}
        <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>{" "}
        and{" "}
        <a href="https://policies.google.com/privacy">Google Privacy Policy</a>.
        It uses a local session cookie for authentication. When you explicitly
        connect Claude, requested records are sent to that client; when you
        approve production delivery, the reviewed blueprint is sent to the
        configured ContentOS receiver.
      </p>
      <p><a href="https://stevenbuglione.github.io/creator-intelligence/privacy.html">Project privacy and self-hosting responsibilities</a></p>
      <a href="/">Return to workspace</a>
    </main>
  );
}
