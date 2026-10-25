import { CONTACT_EMAIL } from "./meta.mjs";

export const LEGAL = {
  privacy: {
    title: "Privacy Policy",
    updated: "10 October 2026",
    sections: [
      { h: "Summary", p: ["By default we do not store your contracts, and we never use them to train models. We keep what we need to run your account: your email address, your plan, payment-verification records and, only if you opt in, the Contract Memory projects and invoices you create."] },
      { h: "What happens to your contract", p: [
        "When you scan a contract, the text you paste or upload is read in your browser, sent to our server and forwarded to a third-party AI provider (currently Groq) to produce the audit. We do not save contract text in our database and we do not use your contracts to train models.",
        "Audit results are returned to your browser and are not stored by us. Because contract text passes through our hosting and AI providers while it is processed, please do not submit agreements you are not allowed to share.",
      ] },
      { h: "Account data", p: ["If you create an account we store your email address, your plan and Pro end date. Sign-in is handled by Supabase Authentication, and we never see your password. If you choose Continue with Google, Google shares your email address and name with our authentication provider, and we store only your email address."] },
      { h: "Contract Memory (optional)", p: [
        "Contract Memory is off by default. If you choose Save to Contract Memory after a scan, we read your contract once to suggest structured terms (project and client name, payment days, revision cap, hourly rate, liability cap, scope deliverables) and up to four short clause excerpts of at most 400 characters each. You review and edit these before saving. Only what you approve is stored, and the full contract is never stored.",
        "Scope Guard sends the client message you paste, together with your saved terms, to our AI provider to produce a verdict. We do not store the client message; we keep only a usage record (the verdict and the date) to apply the Free plan monthly limit. Invoices you add to Payment Chaser are stored with their amounts and dates. You can delete any project or invoice at any time.",
      ] },
      { h: "Devices", p: ["To apply the device limit (1 device at a time on Free, up to 3 on Pro) we store a random device identifier, a short device label such as Chrome on Android, and the time it was last active. You can sign out any device from your Account page."] },
      { h: "Referral program (optional)", p: ["If you use the referral program we store your referral code, who referred you, the commissions you earn, and your payout requests including the UPI ID you provide. Referrers can see how many people they referred and what they earned, but not the personal details of the people they referred."] },
      { h: "Payments", p: ["Payments are made by UPI directly to the UPI ID shown at checkout. When you upload a payment screenshot, it is analysed by an AI service (Google Gemini) to check the amount, receiver and status. We keep the transaction ID, a fingerprint (hash) of the image, the amount, the plan, the time and your user ID, so the same payment cannot be used twice and for our accounting. We do not store the screenshot itself."] },
      { h: "Service providers", p: ["We use Vercel (hosting), Supabase (authentication and database), Groq (contract analysis) and Google (payment screenshot checks). Each processes data under its own terms. Fonts are loaded from Google Fonts."] },
      { h: "Cookies and tracking", p: ["We use your browser's local storage to keep you signed in. We do not run advertising trackers."] },
      { h: "Retention and deletion", p: ["We keep account, plan and Contract Memory data while your account is active. Payment records are kept as long as needed for accounting and fraud prevention. To delete your account or ask what we hold about you, email " + CONTACT_EMAIL + ". We will delete your account data, except records we must keep for accounting or fraud prevention."] },
      { h: "Changes", p: ["We may update this policy. The date above shows the latest version."] },
      { h: "Contact", p: ["Questions about privacy: " + CONTACT_EMAIL + "."] },
    ],
  },
  terms: {
    title: "Terms of Service",
    updated: "10 October 2026",
    sections: [
      { h: "Acceptance", p: ["By using ClauseRadar you agree to these terms. If you do not agree, please do not use the service."] },
      { h: "Not legal advice", p: [
        "ClauseRadar is an automated AI review tool, not a law firm. Nothing it produces is legal advice, and using it does not create an attorney-client relationship.",
        "Results can be incomplete or wrong. Always have a qualified lawyer review important or high-value contracts before you sign.",
      ] },
      { h: "Your account and acceptable use", p: ["You are responsible for your account. Do not upload content you are not allowed to share, do not abuse, scrape or resell the service, and do not submit fake or reused payment screenshots. We may suspend accounts that do."] },
      { h: "Pro plan and payments", p: [
        "ClauseRadar has a Free plan and a Pro plan (currently 499 rupees per month or 3,999 rupees per year). Payment is by UPI. Each verified payment adds 30 days (monthly) or 365 days (yearly) of Pro to your account. Automatic renewal is not enabled, so Pro ends when your paid time ends unless you pay again.",
        "Pro may be used on up to 3 devices at the same time and Free on 1; we may sign out devices above the limit.",
        "If something goes wrong with a payment or an unlock, contact " + CONTACT_EMAIL + " and we will review it.",
      ] },
      { h: "Referral program", p: [
        "You can earn a commission of 30% of each verified Pro payment made by a person who joined through your referral link. Commissions are added to your balance after the payment is verified. The minimum payout is 100 rupees, and payouts are reviewed and paid manually to the UPI ID you provide.",
        "Self-referrals, fake or duplicate accounts and fake or reversed payments are not eligible. We may withhold or reverse commissions and ban accounts for abuse. Commission rates and rules may change for future sales. You are responsible for any taxes on your earnings.",
      ] },
      { h: "Your content", p: ["You keep all rights in the contracts you submit. The suggested clauses and emails are provided for you to use and adapt."] },
      { h: "Disclaimers and limits of liability", p: ["The service is provided as is, without warranties of any kind. To the extent permitted by law, our total liability for any claim is limited to the amount you paid us in the 12 months before the claim."] },
      { h: "Governing law", p: ["These terms are governed by the laws of India."] },
      { h: "Changes and contact", p: ["We may update these terms and will change the date above when we do. Contact: " + CONTACT_EMAIL + "."] },
    ],
  },
};
