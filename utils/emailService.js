const nodemailer = require("nodemailer");


// =====================================================
// GMAIL TRANSPORTER
// =====================================================

const transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


// =====================================================
// SEND USER LOGIN CREDENTIALS
// =====================================================

const sendUserCredentials = async ({
  name,
  email,
  password,
  employeeId,
  companyName,
}) => {

  const loginUrl =
    "http://192.168.0.117:5173/";


  await transporter.sendMail({

    from:
      `"Multitenant Management Platform" <${process.env.SMTP_USER}>`,

    to: email,

    subject:
      "Your Multitenant Platform Login Credentials",


    // Plain text email
    text: `
Hello ${name},

Your account has been successfully created.

Organization:
${companyName || "Your Organization"}

Employee ID:
${employeeId}

Email:
${email}

Password:
${password}

Login:
${loginUrl}

Please change your password after your first login.

Regards,
Multitenant Management Platform
    `,


    // HTML email
    html: `
      <div
        style="
          font-family: Arial, sans-serif;
          padding: 30px;
        "
      >

        <h2>
          Welcome to Multitenant Management Platform
        </h2>

        <p>
          Hello <strong>${name}</strong>,
        </p>

        <p>
          Your user account has been successfully created.
        </p>

        <p>
          <strong>Organization:</strong>
          ${companyName || "Your Organization"}
        </p>

        <p>
          <strong>Employee ID:</strong>
          ${employeeId}
        </p>

        <p>
          <strong>Email:</strong>
          ${email}
        </p>

        <p>
          <strong>Password:</strong>
          ${password}
        </p>

        <p>
          <a
            href="${loginUrl}"
            style="
              display: inline-block;
              padding: 12px 20px;
              background: #2563eb;
              color: white;
              text-decoration: none;
              border-radius: 6px;
            "
          >
            Login to Your Account
          </a>
        </p>

        <p>
          Please change your password after your first login.
        </p>

      </div>
    `,
  });


  console.log(
    `✅ Login credentials email sent to ${email}`
  );
};


// =====================================================
// SEND PASSWORD RESET EMAIL
// =====================================================

const sendPasswordResetEmail = async ({
  name,
  email,
  resetToken,
}) => {

 const resetUrl =
  `http://172.20.10.6:5173/reset-password?token=${resetToken}`;


  await transporter.sendMail({

    from:
      `"Multitenant Management Platform" <${process.env.SMTP_USER}>`,

    to: email,

    subject:
      "Password Reset Request",


    // Plain text email
    text: `
Hello ${name},

We received a request to reset your password.

Click the link below to reset your password:

${resetUrl}

This password reset link will expire in 15 minutes.

If you did not request this password reset, you can safely ignore this email.

Regards,
Multitenant Management Platform
    `,


    // HTML email
    html: `
      <div
        style="
          font-family: Arial, sans-serif;
          background: #f4f7fb;
          padding: 30px;
        "
      >

        <div
          style="
            max-width: 600px;
            margin: auto;
            background: white;
            border-radius: 12px;
            padding: 30px;
          "
        >

          <h2
            style="
              color: #2563eb;
            "
          >
            Password Reset
          </h2>


          <p>
            Hello <strong>${name}</strong>,
          </p>


          <p>
            We received a request to reset your password.
          </p>


          <p>
            Click the button below to create a new password.
          </p>


          <p>

            <a
              href="${resetUrl}"
              style="
                display: inline-block;
                background: #2563eb;
                color: white;
                text-decoration: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: bold;
              "
            >
              Reset Password
            </a>

          </p>


          <p
            style="
              margin-top: 25px;
              color: #64748b;
              font-size: 13px;
            "
          >
            This link will expire in 15 minutes.
          </p>


          <p
            style="
              color: #64748b;
              font-size: 13px;
            "
          >
            If you did not request this password reset,
            you can safely ignore this email.
          </p>


        </div>

      </div>
    `,
  });


  console.log(
    `✅ Password reset email sent to ${email}`
  );
};


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  sendUserCredentials,
  sendPasswordResetEmail,
};