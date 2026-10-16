import {
  POLICY_VERSION,
  policyLinks,
} from "../../../../packages/domain/src/policy";
export default function Terms() {
  return (
    <main className="login">
      <h1>Terms of use</h1>
      <p>
        Policy version {POLICY_VERSION}. Creator Intelligence is maintained by
        Steven Patrick Buglione as an individual. The software is MIT licensed;
        its dependencies and connected services have their own terms.
      </p>
      <p>
        By using this application, you agree to be bound by the{" "}
        <a href={policyLinks.youtube}>YouTube Terms of Service</a>. Your own
        Google credentials and channel authorization are required. No
        additional-metrics permission or YouTube endorsement is bundled with the
        software.
      </p>
      <p>
        Review the <a href="/privacy">privacy policy</a> before using features.
        Data may be incomplete or delayed. Creative suggestions and original
        drafts are independent from YouTube. Review facts, rights and the
        production plan before authorizing delivery.
      </p>
      <p>
        <a href={policyLinks.terms}>Full project terms and MIT license links</a>{" "}
        · <a href={policyLinks.google}>Google Privacy Policy</a>
      </p>
      <a href="/">Return to workspace</a>
    </main>
  );
}
