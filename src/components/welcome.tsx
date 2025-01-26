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
          <h3 className="wlc-subtitle">About CodeWithAli</h3>
          <p>
            At CodeWithAli, we empower individuals and businesses with the
            tools, knowledge, and applications needed to thrive in the digital
            age.
          </p>
        </div>

        <div id="sec-3">
          <h3 className="wlc-subtitle">Who We Are</h3>
          <p>We are dedicated to:</p>
          <ol>
            <li>
              <strong>Teaching Real-World Coding:</strong> Educating students on
              applying coding concepts to create impactful applications.
            </li>
            <li>
              <strong>Web and App Development:</strong> Designing websites for
              individuals to advertise goods and building apps for corporations.
            </li>
            <li>
              <strong>Innovative Applications:</strong> Creating apps like
              expense trackers to serve the broader public.
            </li>
          </ol>
        </div>

        <div id="sec-4">
          <h3 className="wlc-subtitle">What We Offer</h3>
          <ol>
            <li>
              <strong>Education</strong>
              <ul>
                <li>Coding lessons covering:</li>
                <ul className="ul-2">
                  <li>Front-End and Back-End Development.</li>
                  <li>Full-Stack Application Integration.</li>
                </ul>
                <li>
                  Hands-on projects to build real-world skills and portfolios.
                </li>
              </ul>
            </li>
            <li>
              <strong>Development Services</strong>
              <ul>
                <li>
                  <strong>For Individuals:</strong> Custom websites for
                  showcasing goods.
                </li>
                <li>
                  <strong>For Corporations:</strong> Scalable, enterprise-level
                  apps.
                </li>
              </ul>
            </li>
            <li>
              <strong>Open-Source Projects</strong>
              <ul>
                <li>
                  Public tools like expense trackers and other collaborative
                  projects.
                </li>
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
