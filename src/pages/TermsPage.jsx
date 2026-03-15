import React from 'react';

const sectionTitle = {
  fontSize: '0.92rem',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#f3e8ff',
  margin: '20px 0 8px',
};

const text = {
  margin: 0,
  color: '#ddd6fe',
  fontSize: '0.88rem',
  lineHeight: 1.65,
};

const TermsPage = () => {
  return (
    <div
      style={{
        minHeight: '100svh',
        background: 'linear-gradient(180deg, #2e1065 0%, #4c1d95 45%, #581c87 100%)',
        padding: '24px 14px',
      }}
    >
      <div
        style={{
          maxWidth: 860,
          margin: '0 auto',
          border: '2px solid #a78bfa',
          borderRadius: 12,
          background: 'rgba(30, 11, 64, 0.85)',
          boxShadow: '0 10px 40px rgba(32, 12, 76, 0.45)',
          overflow: 'hidden',
          fontFamily: 'Courier New, Consolas, monospace',
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid rgba(196, 181, 253, 0.35)',
            background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.45), rgba(168, 85, 247, 0.28))',
          }}
        >
          <h1 style={{ margin: 0, color: '#faf5ff', fontSize: '1.1rem', fontWeight: 900, letterSpacing: '0.05em' }}>
            PARIWARTAN TERMS AND SERVICES
          </h1>
          <p style={{ margin: '6px 0 0', color: '#e9d5ff', fontSize: '0.8rem' }}>
            Last updated: March 14, 2026
          </p>
        </div>

        <div style={{ padding: '18px' }}>
          <h2 style={sectionTitle}>Binding Clauses</h2>
          <p style={{ ...text, marginBottom: 10 }}>
            This Terms and Services Agreement is a legally binding contract between Pariwartan and each user who
            accesses, registers for, or otherwise uses the platform. By selecting acceptance and continuing to sign in
            or sign up, you represent that you have read, understood, and agreed to be bound by this Agreement in full.
            If you do not agree, you must discontinue use immediately.
          </p>

          <h2 style={sectionTitle}>1. Account Eligibility and Accuracy</h2>
          <p style={text}>
            You must provide accurate, complete, and current registration information, including valid identifying and
            contact details. You are solely responsible for all actions performed through your account and for
            maintaining the confidentiality of your credentials, tokens, and device access. Account sharing, transfer,
            sale, impersonation, or any attempt to misrepresent identity is strictly prohibited.
          </p>

          <h2 style={sectionTitle}>2. Acceptable Use and Conduct</h2>
          <p style={text}>
            You may not upload, transmit, or publish unlawful, abusive, threatening, hateful, exploitative, deceptive,
            or malicious content. You may not submit fabricated reports, stage evidence, distribute malware, scrape
            data, overload infrastructure, bypass technical controls, or seek unauthorized access to any system,
            endpoint, account, or moderator tool. You must comply with all applicable law and respect privacy,
            property, and personal rights of others at all times.
          </p>

          <h2 style={sectionTitle}>3. Moderation, Enforcement, and Safety Controls</h2>
          <p style={text}>
            Pariwartan may use automated and human review to evaluate content quality, abuse indicators, and security
            risks. We may remove, restrict, edit, suppress, or reclassify content, and we may suspend or permanently
            terminate access where violations, fraud, manipulation, harassment, or safety threats are identified.
            Moderation decisions are final unless a formal appeal is accepted with credible supporting evidence.
          </p>

          <h2 style={sectionTitle}>4. Reports, Points, Badges, and Ranking</h2>
          <p style={text}>
            Points, badges, levels, and rankings are non-cash service indicators with no monetary value and no promise
            of permanence. Rewards may be adjusted, frozen, or revoked where duplicates, abuse, invalid submissions, or
            policy violations are detected. Visibility and ranking outcomes may vary according to moderation state,
            quality controls, and integrity safeguards.
          </p>

          <h2 style={sectionTitle}>5. Content Rights and License</h2>
          <p style={text}>
            You retain ownership of lawful original content you submit. By submitting content, you grant Pariwartan a
            limited, non-exclusive license to host, process, display, and distribute that content solely for operating,
            securing, and improving the service. You represent and warrant that your submissions do not infringe
            third-party rights and that you hold all permissions required for publication.
          </p>

          <h2 style={sectionTitle}>6. Privacy, Data Processing, and Retention</h2>
          <p style={text}>
            You acknowledge that account, device, network, and behavior data may be processed for authentication,
            anti-fraud, abuse prevention, audit, legal compliance, and service reliability. We may retain necessary
            records where required by law, dispute handling, or security operations, including limited metadata after
            account deletion requests when legally justified.
          </p>

          <h2 style={sectionTitle}>7. Availability, Changes, and Service Scope</h2>
          <p style={text}>
            The service is provided on an as-available basis and may be modified, paused, restricted, or discontinued
            in whole or in part at any time without guaranteed continuity. Scheduled maintenance, emergency operations,
            or third-party failures may impact uptime and performance. We do not warrant uninterrupted access or error-
            free operation under all network and device conditions.
          </p>

          <h2 style={sectionTitle}>8. Limitation of Liability</h2>
          <p style={text}>
            To the maximum extent permitted by law, Pariwartan is not liable for indirect, incidental, consequential,
            exemplary, or special damages, including data loss, service interruption, reputational impact, or business
            disruption. Any maximum aggregate liability, if imposed by law, is limited to the minimum enforceable
            amount under applicable jurisdictional rules.
          </p>

          <h2 style={sectionTitle}>9. Jurisdiction, Severability, and Amendments</h2>
          <p style={text}>
            This Agreement shall be interpreted under applicable governing law in the relevant jurisdiction. If any
            provision is determined unenforceable, remaining provisions remain valid and enforceable to the fullest
            extent allowed. Pariwartan may amend these Terms from time to time, and your continued use after
            publication of updated terms constitutes acceptance of the revised Agreement.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
