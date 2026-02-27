import { Box, Typography, Divider } from '@mui/material';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.7 }}>
      {children}
    </Typography>
  );
}

export default function TermsContent() {
  const effectiveDate = 'March 1, 2026';

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        <strong>Effective Date:</strong> {effectiveDate}
      </Typography>

      <P>
        These Terms of Service ("Terms") constitute a legally binding agreement between you
        ("User") and Paragon Shell ("Paragon", "we", "us", or "our"),
        governing your access to and use of the Nifty by Paragon platform ("Platform").
        By accessing or using the Platform, you confirm that you have read, understood, and
        agree to be bound by these Terms. If you do not agree, you must not use the Platform.
      </P>
      <P>
        If you are registering or accepting these Terms on behalf of an organization (such as
        a school), you represent that you have authority to bind that organization to these Terms,
        and "you" refers to both you individually and the organization.
      </P>

      <Divider sx={{ my: 2 }} />

      <Section title="1. Description of Services">
        <P>
          Nifty by Paragon is an educational content delivery and classroom management platform
          designed for schools and educational institutions. The Platform enables organizations
          to manage users, create and distribute educational content, and facilitate classroom
          activities.
        </P>
        <P>
          We reserve the right to modify, suspend, or discontinue any aspect of the Platform
          at any time, with or without notice. We will make reasonable efforts to notify
          affected users in advance of material changes.
        </P>
      </Section>

      <Section title="2. Account Registration &amp; Eligibility">
        <P>
          To use the Platform, you must register for an account and provide accurate, complete,
          and current information. You agree to keep your account information up to date.
        </P>
        <P>
          You are responsible for maintaining the confidentiality of your account credentials
          and for all activity that occurs under your account. You must not share your login
          credentials with any other person. You agree to notify us immediately of any
          unauthorized access to your account.
        </P>
        <P>
          The Platform is intended for use by educational institutions and their staff and
          students. Users must be at least 13 years old, or have appropriate parental or
          institutional consent where required by applicable law.
        </P>
      </Section>

      <Section title="3. Billing &amp; Payment (Organizations)">
        <P>
          By registering an organization on the Platform, the organization administrator
          ("Org Admin") agrees, on behalf of the organization, to pay all applicable
          subscription fees and charges associated with the organization's use of the Platform.
        </P>
        <P>
          Fees are billed in accordance with the pricing plan selected at the time of
          registration or as subsequently agreed in writing. Subscription fees are
          non-refundable except as required by applicable law or as expressly stated in a
          separate written agreement.
        </P>
        <P>
          We reserve the right to modify our pricing at any time. We will provide at least
          30 days' advance written notice of any price changes. Continued use of the Platform
          after a price change takes effect constitutes acceptance of the new pricing.
        </P>
        <P>
          Failure to pay fees when due may result in suspension or termination of the
          organization's access to the Platform. Paragon Shell is not liable for any loss or
          disruption caused by such suspension.
        </P>
      </Section>

      <Section title="4. Acceptable Use">
        <P>
          You agree to use the Platform only for lawful purposes and in accordance with these
          Terms. You must not:
        </P>
        <Box component="ul" sx={{ pl: 3, mb: 1 }}>
          {[
            'Attempt to gain unauthorized access to the Platform, its servers, databases, or any connected systems ("hacking").',
            'Reverse engineer, decompile, disassemble, or attempt to derive the source code of the Platform.',
            'Use automated scripts, bots, scrapers, or crawlers to access, collect, or extract data from the Platform.',
            'Introduce malware, viruses, or any malicious code into the Platform.',
            'Impersonate any person or entity, or misrepresent your affiliation with any person or entity.',
            'Upload, post, or transmit content that is illegal, harmful, defamatory, obscene, or otherwise objectionable.',
            'Use the Platform in any manner that could overload, disable, or impair our infrastructure.',
            'Share, sell, or sublicense your account access to any third party.',
          ].map((item) => (
            <Typography key={item} component="li" variant="body2" color="text.secondary" sx={{ mb: 0.5, lineHeight: 1.7 }}>
              {item}
            </Typography>
          ))}
        </Box>
        <P>
          We reserve the right to investigate suspected violations and may suspend or terminate
          accounts involved in prohibited activity without prior notice.
        </P>
      </Section>

      <Section title="5. Intellectual Property &amp; Content Rights">
        <P>
          <strong>Platform Ownership.</strong> The Platform, including all software, design,
          text, graphics, and other content provided by Paragon Shell, is owned by or licensed to
          Paragon Shell and is protected by applicable intellectual property laws. You may not copy,
          modify, distribute, or create derivative works of the Platform or its components
          without our prior written consent.
        </P>
        <P>
          <strong>Your Content.</strong> You retain ownership of any content you create and
          upload to the Platform ("User Content"), provided that you owned or had the right to
          upload such content prior to submission. By uploading User Content, you grant Paragon Shell
          a limited, non-exclusive, royalty-free, worldwide license to host, store, reproduce,
          and display the User Content solely for the purpose of operating and delivering the
          Platform to authorized users.
        </P>
        <P>
          <strong>Content Restrictions.</strong> Platform-hosted content — including content
          uploaded by your organization or made available through the Platform — may not be
          downloaded, reproduced, distributed, or shared outside the Platform without the
          express written permission of the content owner. This restriction applies regardless
          of whether the content is marked as confidential. Unauthorized redistribution of
          protected content may constitute copyright infringement and is grounds for immediate
          account termination.
        </P>
        <P>
          You represent and warrant that you have all rights necessary to upload any User Content
          and that such content does not infringe the intellectual property or other rights of
          any third party.
        </P>
      </Section>

      <Section title="6. Privacy &amp; Student Data">
        <P>
          We are committed to protecting the privacy of all users, including students. Our
          collection, use, and handling of personal data is governed by our Privacy Policy,
          which is incorporated into these Terms by reference.
        </P>
        <P>
          Where the Platform is used with students, Org Admins and schools acknowledge their
          responsibilities under applicable student privacy laws, including the Family
          Educational Rights and Privacy Act (FERPA) and the Children's Online Privacy
          Protection Act (COPPA) where applicable. Org Admins are responsible for obtaining
          any required parental or guardian consents before enrolling students on the Platform.
        </P>
        <P>
          We will not sell, rent, or share student personal data with third parties for
          advertising or marketing purposes.
        </P>
      </Section>

      <Section title="7. Disclaimer of Warranties">
        <P>
          THE PLATFORM IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES
          OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY. TO THE FULLEST EXTENT PERMITTED
          BY APPLICABLE LAW, PARAGON SHELL EXPRESSLY DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT
          LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
          AND NON-INFRINGEMENT.
        </P>
        <P>
          We make no representations or warranties regarding: (a) the accuracy, completeness,
          or reliability of any content on the Platform; (b) the Platform meeting your specific
          requirements; (c) the Platform being uninterrupted, error-free, or secure; or
          (d) any particular educational outcomes, results, or achievements arising from use
          of the Platform. You use the Platform entirely at your own risk.
        </P>
      </Section>

      <Section title="8. Limitation of Liability">
        <P>
          TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL PARAGON SHELL, ITS
          OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, OR LICENSORS BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES ARISING OUT OF
          OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE PLATFORM, EVEN IF WE HAVE
          BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
        </P>
        <P>
          OUR TOTAL AGGREGATE LIABILITY TO YOU FOR ANY CLAIMS ARISING OUT OF OR RELATING TO
          THESE TERMS OR YOUR USE OF THE PLATFORM SHALL NOT EXCEED THE TOTAL FEES PAID BY YOU
          OR YOUR ORGANIZATION TO PARAGON SHELL IN THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING
          THE CLAIM, OR TEN THOUSAND KENYA SHILLINGS(KES 10,000), WHICHEVER IS GREATER.
        </P>
        <P>
          SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES.
          IN SUCH JURISDICTIONS, OUR LIABILITY IS LIMITED TO THE MAXIMUM EXTENT PERMITTED
          BY LAW.
        </P>
      </Section>

      <Section title="9. Indemnification">
        <P>
          You agree to defend, indemnify, and hold harmless Paragon Shell and its officers, directors,
          employees, agents, and licensors from and against any claims, liabilities, damages,
          losses, and expenses (including reasonable legal fees) arising out of or in any way
          connected with: (a) your access to or use of the Platform; (b) your User Content;
          (c) your violation of these Terms; (d) your violation of any applicable law or
          regulation; or (e) the acts or omissions of any student or other person to whom
          you have granted access through your account.
        </P>
      </Section>

      <Section title="10. Termination">
        <P>
          Either party may terminate these Terms and your access to the Platform at any time.
          You may terminate by ceasing all use of the Platform and requesting account deletion.
          We may terminate or suspend your access immediately, without prior notice or liability,
          for any reason, including if we believe you have violated these Terms.
        </P>
        <P>
          Upon termination, your right to access the Platform ceases immediately. We may retain
          your data for a period after termination to comply with legal obligations or allow
          for dispute resolution, after which it may be permanently deleted. Sections 5, 7, 8,
          9, and 12 of these Terms survive termination.
        </P>
      </Section>

      <Section title="11. Changes to These Terms">
        <P>
          We may update these Terms from time to time. When we make material changes, we will
          notify you via email or by displaying a prominent notice within the Platform, and
          you may be required to re-accept the updated Terms before continuing to use the
          Platform. Your continued use of the Platform after changes take effect constitutes
          acceptance of the revised Terms.
        </P>
        <P>
          We encourage you to review these Terms periodically. The "Effective Date" at the
          top of this page indicates when these Terms were last updated.
        </P>
      </Section>

      <Section title="12. Governing Law &amp; Dispute Resolution">
        <P>
          These Terms are governed by and construed in accordance with the laws of the
          jurisdiction in which Paragon Shell is incorporated, without regard to its conflict of
          law provisions. Any dispute arising out of or relating to these Terms or the
          Platform that cannot be resolved informally shall be submitted to binding arbitration
          or, where arbitration is not permitted by law, to the courts of competent jurisdiction
          in Paragon Shell's principal place of business.
        </P>
        <P>
          You waive any right to participate in a class-action lawsuit or class-wide arbitration
          against Paragon Shell to the fullest extent permitted by applicable law.
        </P>
      </Section>

      <Section title="13. General Provisions">
        <P>
          <strong>Entire Agreement.</strong> These Terms, together with our Privacy Policy and
          any applicable order forms or addenda, constitute the entire agreement between you
          and Paragon Shell with respect to the Platform and supersede all prior agreements.
        </P>
        <P>
          <strong>Severability.</strong> If any provision of these Terms is found to be
          unenforceable, the remaining provisions will remain in full force and effect.
        </P>
        <P>
          <strong>No Waiver.</strong> Our failure to enforce any right or provision of these
          Terms will not be considered a waiver of those rights.
        </P>
        <P>
          <strong>Assignment.</strong> You may not assign your rights or obligations under
          these Terms without our prior written consent. We may assign our rights and
          obligations without restriction.
        </P>
      </Section>

      <Section title="14. Contact">
        <P>
          If you have questions about these Terms, please contact us at:{' '}
          <strong>support@paragoneschool.com</strong>
        </P>
      </Section>
    </Box>
  );
}
