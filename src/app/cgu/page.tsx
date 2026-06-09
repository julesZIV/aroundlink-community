import type { CSSProperties } from 'react'

export default function CguPage() {
  const updated = 'April 24, 2025'
  const contact = 'simon@aroundlink.com'
  const appName = 'AroundLink'
  const company = 'AroundLink'

  return (
    <div style={{ background: '#f8f9fc', minHeight: '100vh', padding: '40px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: 'white', borderRadius: 20, border: '1px solid #e2e8f0', padding: '40px 48px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>

        {/* Header */}
        <div style={{ marginBottom: 32, borderBottom: '1px solid #f1f5f9', paddingBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>🌐</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#1a3055' }}>{appName}</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>Terms of Service</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Last updated: {updated}</p>
        </div>

        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.75 }}>

          <p>
            Welcome to {appName}. By creating an account or using our platform, you agree to be bound by these
            Terms of Service. Please read them carefully before using the service.
          </p>

          <h2 style={h2}>1. Acceptance of Terms</h2>
          <p>
            By accessing or using {appName} ("the Platform"), you confirm that you are at least 18 years old,
            are a professional in the field of higher education or international relations, and agree to these
            Terms of Service and our <a href="/privacy" style={{ color: '#1a3055' }}>Privacy Policy</a>.
            If you do not agree, you may not use the Platform.
          </p>

          <h2 style={h2}>2. Description of Service</h2>
          <p>
            {appName} is a private professional community platform for International Relations Officers (IROs)
            in higher education. The Platform provides features including a community feed, thematic channels,
            a university network directory, and a referral system.
          </p>
          <p>
            Access to {appName} is by invitation or referral only. {company} reserves the right to accept or
            reject any registration request.
          </p>

          <h2 style={h2}>3. Account Registration</h2>
          <ul style={ul}>
            <li>You must provide a valid professional email address to register.</li>
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>You may not share your account with others or create multiple accounts.</li>
            <li>You must notify us immediately of any unauthorized use of your account.</li>
          </ul>

          <h2 style={h2}>4. Acceptable Use</h2>
          <p>You agree to use {appName} only for lawful, professional purposes. You must not:</p>
          <ul style={ul}>
            <li>Post content that is false, misleading, defamatory, or discriminatory</li>
            <li>Harass, threaten, or harm other members</li>
            <li>Share confidential information belonging to your institution without authorization</li>
            <li>Use the Platform to advertise commercial services without prior permission</li>
            <li>Attempt to access, scrape, or copy data from the Platform by automated means</li>
            <li>Impersonate another person or institution</li>
          </ul>

          <h2 style={h2}>5. Content and Intellectual Property</h2>
          <p>
            You retain ownership of the content you post on {appName}. By posting content, you grant {company}
            a non-exclusive, royalty-free license to display and distribute your content within the Platform
            for the purpose of operating the service.
          </p>
          <p>
            The {appName} platform, including its design, code, and features, is the exclusive property of
            {' '}{company}. You may not reproduce, copy, or distribute any part of the Platform without
            written permission.
          </p>

          <h2 style={h2}>6. Links Score and Referral System</h2>
          <p>
            {appName} includes an engagement scoring system ("Links") and a referral program. Links are
            non-monetary, non-transferable, and have no cash value. {company} reserves the right to modify
            or discontinue the Links system or referral rewards at any time without notice.
          </p>

          <h2 style={h2}>7. Moderation and Account Termination</h2>
          <p>
            {company} reserves the right to remove any content or suspend any account that violates these
            Terms or that {company}, in its sole discretion, determines to be harmful to the community.
          </p>
          <p>
            You may delete your account at any time by contacting us. Upon deletion, your personal data
            will be removed within 30 days in accordance with our Privacy Policy.
          </p>

          <h2 style={h2}>8. Disclaimers and Limitation of Liability</h2>
          <p>
            {appName} is provided "as is" without warranties of any kind. {company} does not guarantee
            uninterrupted or error-free access to the Platform.
          </p>
          <p>
            To the fullest extent permitted by law, {company} shall not be liable for any indirect,
            incidental, or consequential damages arising from your use of the Platform or content posted
            by other members.
          </p>

          <h2 style={h2}>9. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. We will notify registered users of material changes
            by email or via an in-app notice at least 15 days before the changes take effect. Continued use
            of the Platform after the effective date constitutes acceptance of the updated Terms.
          </p>

          <h2 style={h2}>10. Governing Law</h2>
          <p>
            These Terms are governed by and construed in accordance with the laws of France. Any disputes
            arising from these Terms shall be subject to the exclusive jurisdiction of the courts of Paris,
            France.
          </p>

          <h2 style={h2}>11. Contact</h2>
          <p>
            For any questions about these Terms of Service, contact us at:<br/>
            <a href={`mailto:${contact}`} style={{ color: '#1a3055', fontWeight: 600 }}>{contact}</a>
          </p>

        </div>

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
            {appName} · {new Date().getFullYear()} ·{' '}
            <a href="/privacy" style={{ color: '#1a3055' }}>Privacy Policy</a>
            {' '}·{' '}
            <a href="/auth" style={{ color: '#1a3055' }}>Back to app</a>
          </p>
        </div>
      </div>
    </div>
  )
}

const h2: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: '#1a3055',
  marginTop: 28,
  marginBottom: 8,
}

const ul: CSSProperties = {
  paddingLeft: 20,
  marginTop: 6,
  marginBottom: 8,
}
