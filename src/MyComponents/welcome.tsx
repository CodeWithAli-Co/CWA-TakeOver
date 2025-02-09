import "./compAssets/welcome.css";
import cwa_logo_full from "/codewithali_logo_full.png";

export default function Welcome() {
  return (
    <>
      <div id="main-sec-div">
        <h1 id="wlc-title">
          Welcome to CodeWithAli Manager
          <img
            src={cwa_logo_full}
            alt="CodeWithAli Logo Full"
            id="wlc-logo-full"
            draggable={false}
          />
        </h1>

        <div id="sec-2">
          <h3 className="wlc-subtitle">About CodeWithAli Manager</h3>
          <p>
            The CodeWithAli Manager app is the main manager for the CodeWithAli Company.
          </p>
        </div>

        <div id="sec-3">
          <h3 className="wlc-subtitle">Roles</h3>
          <p>Member</p>
          <li>You are an Employee of CodeWithAli. You mostly only have view permissions.</li>
          <p>Admin</p>
          <li>You have the 2nd highest most powerfull role. You ( or your group ) are responsible for managing CodeWithAli.</li>
          <p>CEO</p>
          <li>You have the highest role in the Company. You <strong>own</strong> CodeWithAli.</li>
        </div>

        <div id="sec-4">
          <h3 className="wlc-subtitle">Tabs</h3>
          <ol>
            <li>
              <strong>Home</strong>
              <ul>
                <li>This is the page you're currently on. The Home tab can be navigated to by clicking on the CodeWithAli Logo.</li>
              </ul>
            </li>
            <li>
              <strong>Details</strong>
              <ul>
                <li>
                  The Details tab is where Admins can manage <p style={{ display: "inline-flex", width: 'max-content', fontStyle: 'italic'  }}>( view, insert, export and delete )</p> all of CodeWithAli's accounts.
                </li>
              </ul>
            </li>
            <li>
              <strong>Employees/Members</strong>
              <ul>
                <li>
                  The Employees/Members tab is where Admins can manage all of the employees of CodeWithAli.
                </li>
              </ul>
            </li>
            <li>
              <strong>Bot</strong>
              <ul>
                <li>The Bot tab is where Admins can manage the CodeWithAli discord bot.</li>
              </ul>
            </li>
            <li>
              <strong>Broadcast</strong>
              <ul>
                <li>The Broadcast tab is where Admins can broadcast emails to employees.</li>
              </ul>
            </li>
          </ol>
        </div>

        <div id="sec-5">
          <h3 className="wlc-subtitle">How to Get Involved</h3>
          <ol>
            <li>
              <strong>Explore Our Repositories:</strong> Check out our latest
              projects.
            </li>
            <li>
              <strong>Join Our Community:</strong> Reach out to collaborate or
              learn.
            </li>
          </ol>
        </div>

        <div id="sec-6">
          <h3 className="wlc-subtitle">Contact Us</h3>
          <ul>
            <li>
              <strong>Email:</strong>{' '}
              <a href="mailto:unfold@codewithali.com">unfold@codewithali.com</a>
            </li>
            <li>
              <strong>Website:</strong>{' '}
              <a href="http://www.codewithali.com">www.codewithali.com</a>
            </li>
            <li>
              <strong>Social Media:</strong> Follow us for updates.
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
