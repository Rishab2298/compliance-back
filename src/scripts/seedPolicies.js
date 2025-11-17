import prisma from "../../prisma/client.js";
import crypto from "crypto";

/**
 * Seed Initial Policies Script
 * Run this script to create the initial 6 required policies
 *
 * Usage: node src/scripts/seedPolicies.js
 */

const policies = [
  {
    type: "TERMS_OF_SERVICE",
    content: `# Terms of Service

**Last Updated:** ${new Date().toLocaleDateString()}

## 1. Acceptance of Terms

By accessing and using Complyo's services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.

## 2. Description of Service

Complyo provides document management, compliance tracking, and driver management solutions for delivery service partners and logistics companies.

## 3. User Accounts

### 3.1 Account Creation
- You must provide accurate and complete information when creating an account
- You are responsible for maintaining the security of your account credentials
- You must notify us immediately of any unauthorized access

### 3.2 Account Responsibilities
- You are responsible for all activities under your account
- You must not share your account credentials with others
- You must comply with all applicable laws and regulations

## 4. Use of Services

### 4.1 Permitted Use
You may use our services for lawful business purposes only, including:
- Managing driver documentation
- Tracking compliance requirements
- Monitoring document expiration dates
- Generating compliance reports

### 4.2 Prohibited Use
You may not:
- Use the service for any illegal purposes
- Attempt to gain unauthorized access to our systems
- Upload malicious software or harmful content
- Violate the intellectual property rights of others
- Share your account with unauthorized users

## 5. Data and Privacy

Your use of Complyo is also governed by our Privacy Policy. We collect, use, and protect your data as described in our Privacy Policy.

## 6. Payment and Billing

### 6.1 Subscription Plans
- Services are offered under various subscription plans
- Pricing is available on our website and subject to change
- Charges are billed in advance on a monthly or annual basis

### 6.2 Cancellation
- You may cancel your subscription at any time
- No refunds for partial months
- Access continues until the end of the billing period

## 7. Intellectual Property

All content, features, and functionality of Complyo are owned by us and protected by copyright, trademark, and other intellectual property laws.

## 8. Limitation of Liability

Complyo is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service.

## 9. Termination

We reserve the right to suspend or terminate your account if you violate these terms or engage in fraudulent activity.

## 10. Changes to Terms

We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the new terms.

## 11. Contact Information

For questions about these Terms of Service, please contact us at:
- Email: support@complyo.com
- Website: https://complyo.com/contact

---

*By using Complyo, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.*`,
  },
  {
    type: "PRIVACY_POLICY",
    content: `# Privacy Policy

**Effective Date:** ${new Date().toLocaleDateString()}

## Introduction

Complyo ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our services.

## 1. Information We Collect

### 1.1 Information You Provide
- **Account Information:** Name, email address, phone number, company details
- **Driver Information:** Driver names, contact details, document uploads
- **Payment Information:** Billing address, payment method details (processed by secure third-party providers)
- **Communications:** Messages, support requests, feedback

### 1.2 Automatically Collected Information
- **Usage Data:** Pages visited, features used, time spent on platform
- **Device Information:** IP address, browser type, operating system
- **Cookies and Tracking:** We use cookies to enhance user experience

## 2. How We Use Your Information

We use collected information to:
- Provide and maintain our services
- Process transactions and send notifications
- Track document compliance and expiration dates
- Send reminders via email and SMS
- Improve our services and user experience
- Respond to support requests
- Comply with legal obligations
- Prevent fraud and ensure security

## 3. Data Sharing and Disclosure

### 3.1 We Do Not Sell Your Data
We do not sell, rent, or trade your personal information to third parties.

### 3.2 Service Providers
We may share data with trusted service providers who assist us in:
- Cloud hosting (AWS)
- Payment processing (Stripe)
- Email delivery
- SMS notifications
- Analytics and monitoring

### 3.3 Legal Requirements
We may disclose information if required by law, court order, or government request.

### 3.4 Business Transfers
In the event of a merger, acquisition, or sale of assets, your information may be transferred to the new owner.

## 4. Data Security

We implement industry-standard security measures including:
- Encryption in transit (HTTPS/TLS)
- Encrypted data storage
- Multi-factor authentication
- Regular security audits
- Access controls and monitoring

## 5. Data Retention

We retain your data for as long as:
- Your account is active
- Required to provide services
- Necessary for legal or regulatory compliance (typically 24-36 months for audit logs)

## 6. Your Rights

You have the right to:
- Access your personal data
- Correct inaccurate data
- Request deletion of your data
- Export your data
- Opt-out of marketing communications
- Revoke consent where applicable

To exercise these rights, contact us at privacy@complyo.com

## 7. Children's Privacy

Our services are not intended for individuals under 18 years of age. We do not knowingly collect data from children.

## 8. International Data Transfers

Your data may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place.

## 9. Cookie Policy

We use cookies for:
- Session management
- Security and authentication
- Analytics and performance monitoring
- User preferences

You can control cookies through your browser settings.

## 10. Changes to Privacy Policy

We may update this policy periodically. We will notify you of material changes via email or platform notification.

## 11. Contact Us

For privacy-related questions or concerns:
- Email: privacy@complyo.com
- Address: Complyo Privacy Team
- Website: https://complyo.com/privacy

---

*Last reviewed and updated: ${new Date().toLocaleDateString()}*`,
  },
  {
    type: "DATA_PROCESSING_AGREEMENT",
    content: `# Data Processing Agreement (DPA)

**Effective Date:** ${new Date().toLocaleDateString()}

This Data Processing Agreement ("DPA") forms part of the agreement between you ("Customer") and Complyo ("Processor") for the provision of document management and compliance tracking services.

## 1. Definitions

- **Personal Data:** Information relating to identified or identifiable individuals
- **Processing:** Any operation performed on Personal Data
- **Controller:** The entity that determines purposes and means of Processing
- **Processor:** The entity that Processes Personal Data on behalf of the Controller
- **Sub-processor:** Third-party processor engaged by the Processor

## 2. Scope and Roles

### 2.1 Scope
This DPA applies to all Personal Data processed by Complyo in connection with providing services to Customer.

### 2.2 Roles
- Customer acts as the Controller
- Complyo acts as the Processor
- Complyo may engage Sub-processors as described herein

## 3. Data Processing Terms

### 3.1 Processing Instructions
Complyo will process Personal Data only:
- As instructed by Customer through use of the services
- As necessary to provide the services
- As required by applicable law

### 3.2 Types of Data Processed
- Driver personal information (names, contact details, identification documents)
- Company employee information
- Document metadata and compliance records
- Usage and activity logs

### 3.3 Processing Purpose
Personal Data is processed to:
- Manage driver documentation and compliance
- Track document expiration dates
- Send compliance reminders
- Generate reports and analytics
- Maintain audit trails

## 4. Security Measures

Complyo implements appropriate technical and organizational measures including:

### 4.1 Technical Measures
- Encryption at rest and in transit
- Access controls and authentication
- Network security and firewalls
- Regular security testing and monitoring
- Secure data centers with redundancy

### 4.2 Organizational Measures
- Employee confidentiality agreements
- Security awareness training
- Incident response procedures
- Regular security assessments
- Data minimization practices

## 5. Sub-processors

### 5.1 Authorized Sub-processors
Customer authorizes Complyo to engage the following Sub-processors:
- **Amazon Web Services (AWS):** Cloud hosting and storage
- **Stripe:** Payment processing
- **SendGrid/Twilio:** Email and SMS delivery
- **Analytics providers:** Usage analytics

### 5.2 Sub-processor Changes
Complyo will notify Customer of any changes to Sub-processors. Customer may object within 30 days.

## 6. Data Subject Rights

### 6.1 Assistance
Complyo will assist Customer in responding to data subject requests including:
- Access requests
- Rectification requests
- Erasure requests
- Data portability requests
- Objection to processing

### 6.2 Response Time
Complyo will respond to assistance requests within 15 business days.

## 7. Data Breach Notification

### 7.1 Notification Obligation
Complyo will notify Customer of any Personal Data breach within 72 hours of becoming aware.

### 7.2 Notification Contents
Notifications will include:
- Nature of the breach
- Categories and approximate number of data subjects affected
- Likely consequences
- Measures taken or proposed to address the breach

## 8. Data Transfers

### 8.1 International Transfers
Personal Data may be transferred to and processed in the United States and other countries where our Sub-processors operate.

### 8.2 Transfer Mechanisms
We rely on appropriate transfer mechanisms including:
- Standard Contractual Clauses
- Adequacy decisions
- Customer consent where applicable

## 9. Audit Rights

### 9.1 Customer Audit Rights
Customer may audit Complyo's compliance with this DPA once per year upon 30 days' notice.

### 9.2 Third-Party Certifications
Complyo maintains SOC 2 Type II certification and provides annual compliance reports.

## 10. Data Return and Deletion

### 10.1 Upon Termination
Upon termination of services, Complyo will:
- Provide Customer with option to export data (30 days)
- Delete or anonymize all Personal Data (within 90 days)
- Provide written confirmation of deletion

### 10.2 Retention Exceptions
Complyo may retain data as required by law or regulation.

## 11. Liability and Indemnification

### 11.1 Processor Liability
Complyo is liable for damages caused by failure to comply with this DPA, except where caused by Customer's instructions.

### 11.2 Limitations
Liability is subject to limitations in the main services agreement.

## 12. Duration and Termination

This DPA remains in effect for the duration of the services agreement and survives termination for data deletion obligations.

## 13. Governing Law

This DPA is governed by the laws applicable to the main services agreement.

## 14. Contact Information

For DPA-related inquiries:
- Email: dpo@complyo.com
- Data Protection Officer: Complyo DPO Team

---

**AGREED AND ACCEPTED:**

By using Complyo's services, Customer agrees to the terms of this Data Processing Agreement.

*Last Updated: ${new Date().toLocaleDateString()}*`,
  },
  {
    type: "SMS_CONSENT",
    content: `# SMS Consent Agreement

**Effective Date:** ${new Date().toLocaleDateString()}

## Agreement to Receive SMS Messages

By providing your mobile phone number and checking the SMS consent box, you expressly consent to receive automated text messages from Complyo at the number provided.

## 1. Types of Messages

You may receive the following types of SMS messages:

### 1.1 Compliance Reminders
- Document expiration notifications
- Compliance deadline alerts
- Required action reminders

### 1.2 Account Notifications
- Login alerts and security notifications
- MFA verification codes
- Account activity updates

### 1.3 Service Updates
- System maintenance notices
- Feature announcements
- Important service changes

## 2. Message Frequency

Message frequency varies based on:
- Your notification settings
- Document expiration schedules
- Account activity
- Service updates

**Estimated frequency:** 2-10 messages per month, depending on your compliance requirements.

## 3. Message and Data Rates

- **Standard messaging rates apply** as charged by your mobile carrier
- **Data charges may apply** for receiving SMS messages
- Complyo does not charge for SMS messages, but your carrier may
- Check with your mobile carrier for details on your plan

## 4. Supported Carriers

Our SMS service is available on major US carriers including:
- AT&T
- T-Mobile
- Verizon
- Sprint
- And most other major carriers

Contact us if you experience issues with your specific carrier.

## 5. Opt-Out Instructions

### 5.1 How to Stop Messages
You can stop receiving SMS messages at any time by:

**Option 1: Text STOP**
- Reply **STOP** to any SMS message from Complyo
- You will receive one final confirmation message
- No further messages will be sent unless you opt back in

**Option 2: Account Settings**
- Log into your Complyo account
- Go to Settings > Notifications
- Disable SMS notifications

**Option 3: Contact Support**
- Email: support@complyo.com
- Phone: [Support Number]

### 5.2 Confirmation
You will receive a confirmation message when you successfully opt out.

### 5.3 Re-Subscribing
To start receiving messages again after opting out:
- Reply **START** to any previous Complyo message, or
- Re-enable SMS in your account settings

## 6. Help and Support

### 6.1 Get Help
For assistance with SMS messages:
- Reply **HELP** to any Complyo message
- Email: support@complyo.com
- Visit: https://complyo.com/support

### 6.2 Support Response
You will receive help information including:
- Contact details
- Opt-out instructions
- Terms and conditions link

## 7. Terms and Conditions

### 7.1 Consent Not Required for Purchase
**IMPORTANT:** Consent to receive SMS messages is NOT a condition of purchasing or using Complyo's services. You can use our services without SMS notifications by:
- Disabling SMS in your notification settings
- Using email notifications instead
- Checking the platform manually for updates

### 7.2 Number Changes
You must notify us immediately if you:
- Change your mobile phone number
- No longer own the number you provided
- Wish to update your contact information

### 7.3 Delivery
We cannot guarantee message delivery due to:
- Carrier limitations
- Network issues
- Device compatibility
- Geographic restrictions

## 8. Privacy and Security

### 8.1 Information Collection
When you consent to SMS:
- We collect your mobile phone number
- We track delivery and response metrics
- We log consent timestamp and IP address

### 8.2 Data Protection
- Your phone number is encrypted and securely stored
- We do not share your number with third parties for marketing
- Our SMS provider (Twilio) processes messages on our behalf
- Refer to our Privacy Policy for full details

### 8.3 Third-Party Service
SMS messages are delivered via Twilio, a third-party service provider. Their privacy policy applies to message delivery.

## 9. International Messages

- SMS service is currently available for US and Canadian phone numbers only
- International messaging rates may apply for international numbers
- Service availability may vary by country

## 10. Limitations and Disclaimers

### 10.1 No Emergency Use
**DO NOT** use SMS for emergency communications. This is not monitored 24/7 and is not appropriate for urgent matters.

### 10.2 Accuracy
We strive for accuracy but cannot guarantee:
- Timely delivery of all messages
- That messages will be received
- Freedom from technical errors

### 10.3 Updates
We may update this SMS Consent at any time. Continued receipt of messages after updates constitutes acceptance of changes.

## 11. Withdrawal of Consent

You may withdraw your consent at any time without affecting:
- Your ability to use Complyo services
- Your account status
- Any other features or services

Simply follow the opt-out instructions in Section 5.

## 12. Questions and Contact

For questions about SMS consent:
- **Email:** sms-consent@complyo.com
- **Phone:** [Support Number]
- **Mail:** Complyo SMS Team, [Address]

---

## Summary

**By checking the SMS Consent box:**
 You agree to receive automated SMS messages from Complyo
 You understand message and data rates may apply
 You can opt out at any time by texting STOP
 Consent is not required to use Complyo services

**For help:** Text HELP or email support@complyo.com
**To stop:** Text STOP or disable in account settings

*Last Updated: ${new Date().toLocaleDateString()}*`,
  },
  {
    type: "COOKIE_PREFERENCES",
    content: `# Cookie Policy

**Last Updated:** ${new Date().toLocaleDateString()}

## Introduction

This Cookie Policy explains how Complyo ("we," "us," or "our") uses cookies and similar technologies on our website and platform. By using our services, you consent to the use of cookies as described in this policy.

## 1. What Are Cookies?

Cookies are small text files stored on your device (computer, smartphone, tablet) when you visit websites. They help websites remember your preferences and improve your experience.

### 1.1 Types of Cookies We Use

**Essential Cookies (Required)**
- Authentication and session management
- Security and fraud prevention
- Load balancing and performance

**Functional Cookies (Optional)**
- Remember your preferences
- Personalization settings
- Language and region preferences

**Analytics Cookies (Optional)**
- Usage statistics and metrics
- Performance monitoring
- Feature effectiveness tracking

**Marketing Cookies (Optional)**
- Advertising campaign tracking
- Conversion measurement
- User journey analysis

## 2. Cookies We Use

### 2.1 Essential Cookies

| Cookie Name | Purpose | Duration |
|------------|---------|----------|
| session_id | Maintains your login session | Session |
| csrf_token | Prevents cross-site request forgery | Session |
| mfa_verified | Tracks MFA verification status | 24 hours |
| auth_token | Authenticates API requests | 7 days |

### 2.2 Functional Cookies

| Cookie Name | Purpose | Duration |
|------------|---------|----------|
| theme_preference | Remembers dark/light mode setting | 1 year |
| language | Stores language preference | 1 year |
| sidebar_collapsed | Remembers sidebar state | 6 months |

### 2.3 Analytics Cookies

| Cookie Name | Purpose | Duration |
|------------|---------|----------|
| _ga | Google Analytics visitor tracking | 2 years |
| _gid | Google Analytics session tracking | 24 hours |
| analytics_consent | Tracks analytics consent | 1 year |

### 2.4 Marketing Cookies

| Cookie Name | Purpose | Duration |
|------------|---------|----------|
| campaign_source | Tracks marketing campaign | 30 days |
| referral_id | Tracks referral sources | 30 days |

## 3. Third-Party Cookies

We use services from trusted third parties that may set cookies:

### 3.1 Analytics Providers
- **Google Analytics:** Website usage and performance
- **Mixpanel:** Product analytics and user behavior

### 3.2 Service Providers
- **Stripe:** Payment processing
- **AWS CloudFront:** Content delivery
- **Clerk:** Authentication services

### 3.3 Communication Tools
- **Intercom:** Customer support chat
- **SendGrid:** Email delivery tracking

## 4. Cookie Consent

### 4.1 Managing Your Preferences

You can control cookies through:

**Cookie Consent Banner**
- Appears on first visit
- Allows granular control by category
- Can be re-accessed in Settings

**Account Settings**
- Navigate to Settings > Privacy > Cookie Preferences
- Toggle cookie categories on/off
- Save preferences at any time

**Browser Settings**
- Block all cookies
- Delete existing cookies
- Set cookie preferences per site

### 4.2 Essential Cookies
Essential cookies cannot be disabled as they are necessary for the platform to function. These include authentication, security, and session management cookies.

### 4.3 Withdrawing Consent
You can withdraw consent at any time by:
- Updating preferences in your account settings
- Clearing your browser cookies
- Using the cookie preference center

## 5. How to Control Cookies

### 5.1 Browser Controls

**Chrome**
1. Settings > Privacy and Security > Cookies
2. Choose cookie settings
3. Manage site-specific permissions

**Firefox**
1. Settings > Privacy & Security
2. Cookies and Site Data section
3. Manage permissions

**Safari**
1. Preferences > Privacy
2. Cookie and website data options
3. Manage website data

**Edge**
1. Settings > Cookies and site permissions
2. Manage and delete cookies
3. Set cookie permissions

### 5.2 Mobile Devices

**iOS Safari**
- Settings > Safari > Block All Cookies

**Android Chrome**
- Chrome > Settings > Site Settings > Cookies

### 5.3 Opt-Out Tools

**Google Analytics Opt-Out**
- Install browser add-on: https://tools.google.com/dlpage/gaoptout

**Do Not Track (DNT)**
- Enable in browser settings
- We honor DNT signals where possible

## 6. Impact of Blocking Cookies

### 6.1 Essential Cookies
Blocking essential cookies will:
- Prevent you from logging in
- Disable core platform features
- Compromise security measures

### 6.2 Functional Cookies
Blocking functional cookies may:
- Reset your preferences on each visit
- Require manual language selection
- Not remember your settings

### 6.3 Analytics Cookies
Blocking analytics cookies:
- Does not affect functionality
- Helps us improve the platform less effectively
- Reduces personalization

### 6.4 Marketing Cookies
Blocking marketing cookies:
- Does not affect core services
- May show less relevant advertisements
- Reduces campaign tracking

## 7. Other Tracking Technologies

In addition to cookies, we use:

### 7.1 Local Storage
- Stores larger amounts of data
- Persists until manually cleared
- Used for offline functionality

### 7.2 Session Storage
- Temporary storage during session
- Cleared when tab/browser closes
- Used for temporary state

### 7.3 Web Beacons
- Tiny invisible images
- Track email opens
- Measure campaign effectiveness

### 7.4 Fingerprinting
We do NOT use browser fingerprinting techniques.

## 8. Cookie Retention

| Cookie Type | Retention Period |
|-------------|------------------|
| Session cookies | Until browser closes |
| Authentication | 7-30 days |
| Preferences | 6-12 months |
| Analytics | Up to 2 years |
| Marketing | 30-90 days |

## 9. Children's Privacy

We do not knowingly collect data from children under 18. Our cookies are not targeted at children.

## 10. Updates to Cookie Policy

We may update this Cookie Policy to reflect:
- New cookie technologies
- Changes in legal requirements
- Service improvements
- Third-party integrations

We will notify you of material changes via:
- Email notification
- Platform banner
- Updated "Last Modified" date

## 11. Your Rights

Under privacy laws (GDPR, CCPA, etc.), you have the right to:
- Know what cookies are set
- Access cookie data
- Delete your data
- Opt-out of non-essential cookies
- Withdraw consent

## 12. Contact Us

For questions about our use of cookies:

**Email:** cookies@complyo.com
**Privacy Team:** privacy@complyo.com
**Website:** https://complyo.com/cookies
**Mail:** Complyo Privacy Team, [Address]

---

## Quick Summary

 **Essential cookies** are required for the platform to work
 **Optional cookies** improve your experience but can be disabled
 **Third-party cookies** help us analyze and improve services
 **You control** your cookie preferences at any time
 **No impact** on core services if you block optional cookies

**Manage Your Preferences:**
Settings > Privacy > Cookie Preferences

*Last reviewed and updated: ${new Date().toLocaleDateString()}*`,
  },
  {
    type: "SUPPORT_ACCESS",
    content: `# Support Access Agreement

**Effective Date:** ${new Date().toLocaleDateString()}

## Overview

This Support Access Agreement explains Complyo's policy for support team access to customer accounts when providing technical assistance and resolving support tickets.

## 1. What is Support Access?

Support Access allows authorized Complyo support personnel to access your account temporarily to:
- Diagnose technical issues
- Resolve support tickets
- Investigate reported problems
- Provide hands-on assistance
- Perform account recovery

## 2. When Support Access is Used

### 2.1 Active Support Tickets
Support access is only granted when:
- You have an active support ticket
- Direct account access is necessary to resolve the issue
- Other troubleshooting methods have been exhausted
- You have explicitly granted permission

### 2.2 Support Access is NEVER Used For:
- Routine account monitoring
- Unauthorized browsing of your data
- Marketing or sales purposes
- Data collection unrelated to your issue
- Any purpose without your explicit consent

## 3. Granting Support Access

### 3.1 How to Grant Access

**Option 1: During Onboarding**
- Check the "Support Access" box during account creation
- This grants standing permission for active tickets

**Option 2: Per-Ticket Basis**
- Consent when submitting a support ticket
- Email support with explicit permission
- Verbally authorize during phone support

**Option 3: Account Settings**
- Navigate to Settings > Privacy > Support Access
- Toggle "Allow Support Access" on/off
- Changes take effect immediately

### 3.2 Explicit Consent Required
Unless you have granted standing permission during onboarding or in account settings, we will:
- Request permission before accessing your account
- Wait for your explicit written or verbal consent
- Confirm the scope of access needed
- Document your authorization

## 4. Scope of Access

### 4.1 What Support Can Access

When granted permission, support staff may access:
- Account settings and configurations
- Driver and document records relevant to the issue
- System logs and error messages
- Notification and reminder settings
- Billing and subscription details (if relevant)
- Team member settings (if relevant)

### 4.2 What Support Cannot Access

Support staff will NEVER access:
- Your password or authentication credentials
- Payment card details (handled by Stripe)
- Data unrelated to your support issue
- Other companies' data
- Deleted or archived data (unless specifically needed)

## 5. Access Duration and Expiration

### 5.1 Automatic Expiration
Support access automatically expires:
- **72 hours after being granted**
- When the support ticket is closed
- When you revoke permission
- When the issue is resolved

### 5.2 Re-Authorization Required
After expiration, support must:
- Request permission again for a new ticket
- Explain why access is needed
- Wait for your authorization
- Document the new consent

### 5.3 Extended Access
If resolution requires longer than 72 hours:
- Support will notify you before expiration
- Request extension with explanation
- Obtain your renewed consent
- Document the extension

## 6. Security and Privacy

### 6.1 Security Measures

All support access is protected by:
- **Multi-factor authentication** for support staff
- **Audit logging** of all actions taken
- **Role-based access controls** limiting scope
- **Encrypted connections** (HTTPS/TLS)
- **Session timeout** after inactivity

### 6.2 Activity Logging

When support accesses your account, we log:
- Support agent name and ID
- Date and time of access
- Actions performed
- Data viewed or modified
- Duration of access
- Ticket number and purpose

### 6.3 Audit Trail

You can review support access history:
- Settings > Privacy > Access Log
- Shows all support sessions
- Displays actions taken
- Available for 90 days

## 7. Support Staff Training

### 7.1 Authorization Requirements

All Complyo support staff must:
- Complete privacy and security training
- Sign confidentiality agreements
- Undergo background checks
- Follow strict data handling procedures
- Adhere to principle of least privilege

### 7.2 Access Restrictions

Support personnel can only access:
- Accounts with active tickets
- Data necessary to resolve the issue
- Systems within their authorization level
- During approved access windows

## 8. Revoking Access

### 8.1 How to Revoke

You can revoke support access at any time:

**Immediate Revocation:**
- Settings > Privacy > Support Access > Revoke Now
- Email: support@complyo.com with "Revoke Access"
- Reply "REVOKE" to any support communication

**Permanent Opt-Out:**
- Settings > Privacy > Support Access > Disable
- Remove checkbox during account setup
- Contact support to disable standing permission

### 8.2 Effect of Revocation
Upon revocation:
- All active support sessions immediately terminate
- Support can no longer access your account
- May impact ability to resolve technical issues
- You can re-grant access at any time

## 9. Exceptions and Emergency Access

### 9.1 Emergency Situations

In rare emergency situations, support may access accounts without prior consent to:
- Prevent imminent data loss
- Respond to security incidents
- Comply with legal obligations
- Protect platform integrity

### 9.2 Post-Emergency Notification

If emergency access occurs:
- You will be notified within 24 hours
- We will explain the reason and actions taken
- Access will be logged and auditable
- You can dispute the access if inappropriate

## 10. Third-Party Support

### 10.1 No Third-Party Access

Complyo does NOT:
- Share account access with third parties
- Allow external vendors to access your data
- Permit partner companies to view your account
- Grant access to non-Complyo personnel

### 10.2 Exception for Sub-processors

Our sub-processors (AWS, Stripe, etc.) may have technical access to infrastructure but:
- Are bound by strict data processing agreements
- Do not access customer accounts directly
- Provide infrastructure services only
- Are listed in our Data Processing Agreement

## 11. Data Handling During Support

### 11.1 Viewing Data

Support staff may view your data only when:
- Necessary to diagnose the issue
- Specifically related to your ticket
- Authorized by you or by standing permission
- Logged for audit purposes

### 11.2 Modifying Data

Support may modify data only:
- With your explicit instruction
- To fix bugs or errors
- To restore accidentally deleted data
- After explaining what will be changed
- With full documentation and logging

### 11.3 Data Download/Export

Support will NEVER:
- Download your data to personal devices
- Export data without your explicit request
- Share data outside Complyo systems
- Retain copies after ticket resolution

## 12. Your Rights

You have the right to:
- **Grant or deny** support access
- **Revoke access** at any time
- **View access logs** of support sessions
- **Request details** about what was accessed
- **Complain** if access was inappropriate
- **Disable** support access permanently

## 13. Complaints and Concerns

If you have concerns about support access:

### 13.1 Report Inappropriate Access

Contact us immediately if you believe:
- Access was unauthorized
- Data was misused
- Privacy was violated
- Actions exceeded scope

### 13.2 How to Report

**Email:** privacy@complyo.com
**Subject:** "Support Access Concern"
**Escalation:** dpo@complyo.com (Data Protection Officer)

We will investigate within 5 business days and respond with findings and actions taken.

## 14. Compliance

This policy complies with:
- GDPR (General Data Protection Regulation)
- CCPA (California Consumer Privacy Act)
- SOC 2 Type II requirements
- Industry best practices

## 15. Updates to Policy

We may update this Support Access Agreement to:
- Reflect new features or services
- Comply with legal requirements
- Improve security measures
- Clarify existing practices

Changes will be communicated via:
- Email notification (for material changes)
- Updated "Last Modified" date
- Platform notification banner

## 16. Contact Information

For questions about support access:

**General Support:** support@complyo.com
**Privacy Questions:** privacy@complyo.com
**Data Protection Officer:** dpo@complyo.com
**Phone:** [Support Number]
**Website:** https://complyo.com/support-access

---

## Quick Summary

 **Optional** - Support access is not required to use Complyo
 **Time-Limited** - Access expires after 72 hours automatically
 **Revocable** - You can revoke permission at any time
 **Audited** - All access is logged and reviewable
 **Secure** - Protected by MFA, encryption, and strict controls
 **Controlled** - Only used for active support tickets

**Manage Support Access:**
Settings > Privacy > Support Access

*Last reviewed and updated: ${new Date().toLocaleDateString()}*`,
  },
];

async function seedPolicies() {
  console.log("<1 Starting policy seeding...\n");

  try {
    // Find a super admin user to assign as creator
    const superAdmin = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN" },
    });

    if (!superAdmin) {
      console.error("L Error: No SUPER_ADMIN user found.");
      console.log("Please create a SUPER_ADMIN user first before seeding policies.");
      process.exit(1);
    }

    console.log(` Found SUPER_ADMIN user: ${superAdmin.email}\n`);

    // Create or update each policy
    for (const policyData of policies) {
      console.log(`Processing ${policyData.type}...`);

      // Calculate content hash
      const contentHash = crypto
        .createHash("sha256")
        .update(policyData.content)
        .digest("hex");

      // Check if policy already exists
      const existing = await prisma.policy.findFirst({
        where: { type: policyData.type },
      });

      if (existing) {
        console.log(`  � Policy already exists (${existing.version}), skipping...`);
        continue;
      }

      // Create new policy
      const policy = await prisma.policy.create({
        data: {
          type: policyData.type,
          version: "1.0.0",
          content: policyData.content,
          contentHash,
          isPublished: true,
          publishedAt: new Date(),
          createdById: superAdmin.id,
        },
      });

      console.log(`   Created and published ${policyData.type} (v${policy.version})`);
    }

    console.log("\n Policy seeding completed successfully!");
    console.log(`\nCreated ${policies.length} policies:`);
    policies.forEach((p) => console.log(`  - ${p.type}`));
  } catch (error) {
    console.error("\nL Error seeding policies:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeder
seedPolicies();
