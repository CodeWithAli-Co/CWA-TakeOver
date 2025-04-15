import { Button } from "@/components/ui/button";
import { invoke } from "@tauri-apps/api/core";
import { SendHorizonal } from "lucide-react";
import { downloadDir } from "@tauri-apps/api/path";
import { remove, BaseDirectory } from "@tauri-apps/plugin-fs";
import { useNavigate } from "@tanstack/react-router";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { useInvoiceStore } from "@/stores/invoiceStore";
import { downloadInvoice } from "../invoice";

type Props = {
  email: string;
  invoiceID: number;
  subject?: string;
  className?: string;
  iconStyle?: string;
};
const HTML = `
<html dir="ltr" lang="en">
  <head>
    <link
      rel="preload"
      as="image"
      href="https://codewithali.com/codewithali.png" />
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="x-apple-disable-message-reformatting" />
  </head>
  <body
    style='background-color:rgb(255,255,255);font-family:ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";margin-top:0px;margin-bottom:0px'>
    <!--$-->
    <div
      style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">
      Invoice Received from CodeWithAli
      <div>
         ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿ ‌​‍‎‏﻿
      </div>
    </div>
    <table
      align="center"
      width="100%"
      border="0"
      cellpadding="0"
      cellspacing="0"
      role="presentation"
      style="max-width:600px;margin-left:auto;margin-right:auto">
      <tbody>
        <tr style="width:100%">
          <td>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="display:flex;justify-content:center;align-items:center;padding-top:1rem">
              <tbody>
                <tr>
                  <td>
                    <table
                      align="center"
                      width="100%"
                      border="0"
                      cellpadding="0"
                      cellspacing="0"
                      role="presentation">
                      <tbody style="width:100%">
                        <tr style="width:100%">
                          <img
                            alt="Logo"
                            height="75"
                            src="https://codewithali.com/codewithali.png"
                            style="border-radius:9999px;display:block;outline:none;border:none;text-decoration:none"
                            width="75" />
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
            <hr
              style="border-top-width:4px;border-color:rgb(220,38,38);margin-top:1rem;margin-bottom:1rem;width:100%;margin-left:0px;border:none;border-top:1px solid #eaeaea" />
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation">
              <tbody>
                <tr>
                  <td>
                    <h1
                      style="font-size:1.25rem;line-height:1.75rem;font-weight:700;margin-bottom:0px;letter-spacing:-0.025em;color:rgb(127,29,29)">
                      Dear Client,
                    </h1>
                    <p
                      style="color:rgb(55,65,81);font-size:0.875rem;line-height:1.25rem;margin-top:0.25rem;margin-bottom:1.5rem">
                      Attached you will find your Invoice.
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation"
              style="background-color:rgb(249,250,251);padding:1rem;border-left-width:4px;border-color:rgb(220,38,38)">
              <tbody>
                <tr>
                  <td>
                    <h3
                      style="font-size:0.875rem;line-height:1.25rem;font-weight:700;margin:0px;text-transform:uppercase;color:rgb(185,28,28)">
                      Contact Information
                    </h3>
                    <p
                      style="color:rgb(107,114,128);font-style:italic;font-size:14px;line-height:24px;margin-bottom:16px;margin-top:16px">
                      Below here you can find our contact information.
                    </p>
                    <table
                      style="width:100%;margin-top:0.5rem;border-collapse:collapse">
                      <tbody>
                        <tr>
                          <td
                            style="padding-top:0.25rem;padding-bottom:0.25rem;font-size:0.75rem;line-height:1rem;color:rgb(107,114,128);vertical-align:top;width:5rem">
                            Name
                          </td>
                          <td
                            style="padding-top:0.25rem;padding-bottom:0.25rem;font-size:0.875rem;line-height:1.25rem;font-weight:500">
                            CodeWithAli
                          </td>
                        </tr>
                        <tr>
                          <td
                            style="padding-top:0.25rem;padding-bottom:0.25rem;font-size:0.75rem;line-height:1rem;color:rgb(107,114,128);vertical-align:top">
                            Email
                          </td>
                          <td
                            style="padding-top:0.25rem;padding-bottom:0.25rem">
                            <a
                              href="mailto:unfold@codewithali.com"
                              style="font-size:0.875rem;line-height:1.25rem;color:rgb(185,28,28);text-decoration-line:none"
                              target="_blank"
                              >unfold@codewithali.com</a
                            >
                          </td>
                        </tr>
                        <tr>
                          <td
                            style="padding-top:0.25rem;padding-bottom:0.25rem;font-size:0.75rem;line-height:1rem;color:rgb(107,114,128);vertical-align:top">
                            Phone
                          </td>
                          <td
                            style="padding-top:0.25rem;padding-bottom:0.25rem">
                            <a
                              href="tel:+1 (408) 690 4009"
                              style="font-size:0.875rem;line-height:1.25rem;color:rgb(185,28,28);text-decoration-line:none"
                              target="_blank"
                              >+1 (408) 690 4009</a
                            >
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
            <hr
              style="border-color:rgb(254,226,226);margin-top:1.5rem;margin-bottom:1.5rem;width:100%;border:none;border-top:1px solid #eaeaea" />
            <table
              align="center"
              width="100%"
              border="0"
              cellpadding="0"
              cellspacing="0"
              role="presentation">
              <tbody>
                <tr>
                  <td>
                    <p
                      style="font-size:0.75rem;line-height:1rem;color:rgb(153,27,27);margin:0px;margin-bottom:0px;margin-top:0px;margin-left:0px;margin-right:0px">
                      ©CodeWithAli. All rights reserved.
                    </p>
                    <p
                      style="font-size:0.75rem;line-height:1rem;color:rgb(248,113,113);margin-top:0.25rem;margin-bottom:16px">
                      This email is auto-generated. Please do not reply
                      directly.
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
    <!--7--><!--/$-->
  </body>
</html>
`;

const EmailBtn = (props: Props) => {
  const navigate = useNavigate();
  const { setInvoiceID } = useInvoiceStore();

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const sendEmail = async (email: string, subject: string = "New Invoice") => {
    setInvoiceID(props.invoiceID);
    setTimeout(() => {
      navigate({ to: "/middle" });
    }, 500);
    // Need to wait more than 3s for this to work properly
    await sleep(4000);
    await downloadInvoice();
    const dirName = await downloadDir();
    // waiting an extra 1s to avoid rust errors
    await sleep(1000);
    await invoke("send_invoice", {
      clientEmail: email,
      subjectMsg: subject,
      filePath: `${dirName}\\\cwa-invoice2051316.pdf`,
      html: HTML,
    }).then(
      (res) => (
        sendNotification({
          title: "Invoice Sent",
          body: "Invoice was successfully sent to Client",
        }),
        console.log("Email ID:", res)
      )
    );
    await remove("cwa-invoice2051316.pdf", { baseDir: BaseDirectory.Download });
  };
  return (
    <Button
      className={props.className}
      onClick={() => sendEmail(props.email, props.subject)}
    >
      <SendHorizonal className={props.iconStyle} />
    </Button>
  );
};

export default EmailBtn;
