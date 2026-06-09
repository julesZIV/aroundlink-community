import type { CSSProperties } from 'react'

export default function PrivacyPage() {
  const updated = 'April 22, 2025'
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
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>Privacy Policy</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Last updated: {updated}</p>
        </div>

        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.75 }}>

          <p>
            {company} ("we", "us", or "our") operates the {appName} platform, a professional community for International
            Relations Officers (IROs) in higher education. This Privacy Policy explains how we collect, use, and protect
            your personal information when you use our service.
          </p>

          <h2 style={h2}>1. Information We Collect</h2>
          <p>We collect information you provide directly, including:</p>
          <ul style={ul}>
            <li><strong>Account information</strong>: name, professional email address, password (hashed)</li>
            <li><strong>Profile information</strong>: institution, role, LinkedIn profile URL</li>
            <li><strong>Content</strong>: posts, messages, comments, and files you share on the platform</li>
            <li><strong>Usage data</strong>: pages visited, features used, timestamps of activity</li>
          </ul>
          <p>When you sign in with LinkedIn, we receive from LinkedIn only the information you authorize: your name, email address, and public profile data.</p>

          <h2 style={h2}>2. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul style={ul}>
            <li>Create and manage your account</li>
            <li>Provide access to community features (feed, channels, network directory)</li>
            <li>Send transactional emails (email confirmation, password reset)</li>
            <li>Calculate engagement scores (Links) based on your activity</li>
            <li>Improve and maintain the platform</li>
          </ul>
          <p>We do not sell your personal data to third parties. We do not use your data for advertising purposes.</p>

          <h2 style={h2}>3. LinkedIn Sign-In</h2>
          <p>
            {appName} uses LinkedIn as an optional authentication provider via OpenID Connect (OIDC). When you choose
            to sign in with LinkedIn, we receive only the data you explicitly authorize (name, email, profile picture
            if shared). We do not post on your behalf, access your connections, or read your LinkedIn messages.
          </p>

          <h2 style={h2}>4. Data Storage and Security</h2>
          <p>
            Your data is stored securely on <strong>Supabase</strong> infrastructure (hosted on AWS in the EU region).
            Passwords are hashed and never stored in plain text. We use row-level security (RLS) to ensure each user
            can only access their own data and content from channels they have joined.
          </p>

          <h2 style={h2}>5. Data Sharing</h2>
          <p>We share data only with:</p>
          <ul style={ul}>
            <li><strong>Supabase</strong> — database and authentication infrastructure</li>
            <li><strong>LinkedIn</strong> — only when you initiate LinkedIn sign-in (OAuth flow)</li>
            <li><strong>Vercel</strong> — hosting provider for the web application</li>
          </ul>
          <p>All third-party providers are bound by their own privacy policies and applicable data protection regulations.</p>

          <h2 style={h2}>6. Your Rights</h2>
          <p>You have the right to:</p>
          <ul style={ul}>
            <li><strong>Access</strong> the personal data we hold about you</li>
            <li><strong>Correct</strong> inaccurate data via your profile settings</li>
            <li><strong>Delete</strong> your account and associated data by contacting us</li>
            <li><strong>Export</strong> your data upon request</li>
            <li><strong>Object</strong> to processing by contacting us</li>
          </ul>
          <p>
            If you are located in the European Economic Area (EEA), you have rights under the General Data Protection
            Regulation (GDPR). To exercise any of these rights, contact us at{' '}
            <a href={`mailto:${contact}`} style={{ color: '#1a3055' }}>{contact}</a>.
          </p>

          <h2 style={h2}>7. Cookies</h2>
          <p>
            We use only essential cookies necessary for authentication and session management. We do not use tracking
            or advertising cookies. No cookie consent banner is required beyond this notice.
          </p>

          <h2 style={h2}>8. Data Retention</h2>
          <p>
            We retain your personal data for as long as your account is active. If you delete your account, we will
            delete or anonymize your personal data within 30 days, except where retention is required by law.
          </p>

          <h2 style={h2}>9. Children's Privacy</h2>
          <p>
            {appName} is intended for professionals in higher education. We do not knowingly collect data from persons
            under the age of 18.
          </p>

          <h2 style={h2}>10. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. We will notify registered users of significant changes by
            email or via an in-app notice. The date at the top of this page indicates when the policy was last revised.
          </p>

          <h2 style={h2}>11. Contact</h2>
          <p>
            For any questions about this Privacy Policy or your personal data, contact us at:<br/>
            <a href={`mailto:${contact}`} style={{ color: '#1a3055', fontWeight: 600 }}>{contact}</a>
          </p>

        </div>

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
            {appName} · {new Date().getFullYear()} · <a href="/auth" style={{ color: '#1a3055' }}>Back to app</a>
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
