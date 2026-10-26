import React from 'react'
import { Shield, Clock, EyeOff, Cookie, Server } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Page Title */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-recommended/10 border border-recommended/20 text-recommended text-xs font-mono mb-4">
          <Shield size={14} />
          <span>Privacy Commitment</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-heading font-bold text-text mb-4">
          Privacy Policy
        </h1>
        <p className="text-lg text-muted leading-relaxed">
          We believe in strict data minimization. LLM Bench is built for privacy-conscious developers and hobbyists.
        </p>
      </div>

      <div className="space-y-8">
        {/* Core summary callout */}
        <div className="p-6 rounded-xl bg-accent/5 border border-accent/20 flex items-start gap-4">
          <EyeOff className="text-accent flex-shrink-0 mt-1" size={24} />
          <div>
            <h3 className="text-base font-heading font-semibold text-text mb-1">
              Plain Language Summary
            </h3>
            <p className="text-sm text-muted leading-relaxed">
              We do not collect names, email addresses, IP logs, file systems, or browsing histories. Hardware scans read GPU, RAM, and CPU telemetry only, and scan tokens expire automatically after 60 minutes.
            </p>
          </div>
        </div>

        {/* 1. What Hardware Scanner Reads */}
        <section className="glass p-8 space-y-4">
          <h2 className="text-xl font-heading font-semibold text-text flex items-center gap-2">
            <Server className="text-accent" size={20} />
            <span>1. What the Hardware Scanner Reads</span>
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            When you run our optional scanner utility (or use the web-based instant checker), the system reads only:
          </p>
          <ul className="list-disc list-inside text-sm text-muted space-y-1.5 pl-2 font-mono">
            <li>GPU model name and total Video RAM (VRAM in GB)</li>
            <li>Total system Random Access Memory (RAM in GB)</li>
            <li>CPU processor name and physical core count</li>
            <li>Operating system name and free disk storage</li>
          </ul>
          <p className="text-sm text-muted leading-relaxed">
            The scanner never accesses personal files, documents, passwords, network traffic, or hardware serial numbers.
          </p>
        </section>

        {/* 2. 1-Hour Ephemeral Retention */}
        <section className="glass p-8 space-y-4">
          <h2 className="text-xl font-heading font-semibold text-text flex items-center gap-2">
            <Clock className="text-minimum" size={20} />
            <span>2. Temporary 1-Hour Storage</span>
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            Hardware scan submissions are assigned a random UUID token. Hardware data is stored temporarily for <strong>exactly 1 hour</strong> so that you can view your compatibility verdicts and model recommendations.
          </p>
          <p className="text-sm text-muted leading-relaxed">
            After one hour, the session token expires and is permanently purged from our database. You can also click &ldquo;Clear Scan&rdquo; at any time to immediately discard the local token.
          </p>
        </section>

        {/* 3. Cookies and Advertising */}
        <section className="glass p-8 space-y-4">
          <h2 className="text-xl font-heading font-semibold text-text flex items-center gap-2">
            <Cookie className="text-recommended" size={20} />
            <span>3. Cookies &amp; Third-Party Advertising</span>
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            To keep this benchmarking platform free and maintain our servers, LLM Bench may display third-party advertisements provided by Google AdSense and its advertising partners.
          </p>
          <p className="text-sm text-muted leading-relaxed">
            Third-party vendors, including Google, use cookies to serve ads based on a user&rsquo;s prior visits to this website or other websites. Google&rsquo;s use of advertising cookies enables it and its partners to serve ads based on your visit to our site and/or other sites on the Internet.
          </p>
          <p className="text-sm text-muted leading-relaxed">
            You may opt out of personalized advertising by visiting Google&rsquo;s Ads Settings (<a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="text-accent underline">adssettings.google.com</a>) or by visiting <a href="https://aboutads.info" target="_blank" rel="noopener noreferrer" className="text-accent underline">aboutads.info</a>.
          </p>
        </section>

        {/* 4. Contact */}
        <section className="glass p-8 space-y-2">
          <h2 className="text-xl font-heading font-semibold text-text">
            4. Questions &amp; Data Erasure
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            For questions regarding this policy or to request immediate manual purge of any active session token, contact us at our privacy desk.
          </p>
        </section>
      </div>
    </div>
  )
}
