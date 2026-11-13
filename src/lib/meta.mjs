import { GUIDES } from "./guides.mjs";
export const SITE = "https://clauseradar.online";
export const BRAND = "ClauseRadar";
// Shown on the Privacy and Terms pages. Change it if this mailbox does not exist.
export const CONTACT_EMAIL = "support@clauseradar.online";
export const OG_IMAGE = SITE + "/og.png";

export const ROUTE_META = {
  "/": {
    title: "ClauseRadar – AI Contract Review for Freelancers, Creators & Job Seekers",
    description: "Scan freelance contracts, creator brand deals, job offer letters and agency agreements in 30 seconds. Spot payment traps, rights grabs, bonds and risky clauses before you sign.",
    index: true, priority: "1.0",
  },
  "/sample": {
    title: "Sample Contract Audit Report & Safer Rewrites – ClauseRadar",
    description: "Explore a sample audit with risky clauses by severity, plain-English notes, safer rewrites and counter-emails for freelance, creator, job and agency deals.",
    index: true, priority: "0.8",
  },
  "/dashboard": {
    title: "Contract Scanner for Freelance, Brand Deal, Job Offer & Agency Contracts – ClauseRadar",
    description: "Upload a PDF or DOCX, or paste text. Pick a mode: freelance client contract, creator brand deal sponsorship, job offer letter and bond, or agency sub-contract.",
    index: true, priority: "0.9",
  },
  "/pricing": {
    title: "ClauseRadar Pricing: Free Contract Scan, Pro from $5/month",
    description: "Scan any contract free. Go Pro from $5/month or $35/year with Asia pricing ($9 and $59 globally): every rewrite unlocked, Scope Guard, Payment Chaser, PDF reports.",
    index: true, priority: "0.8",
  },
  "/scope-guard": {
    title: "Scope Guard: Free or Billable? Check Client Requests – ClauseRadar",
    description: "Paste a client's quick tweak message and see if it is in scope, billable or a grey area, with the contract clause, a polite reply and a change-order quote.",
    index: true, priority: "0.8",
  },
  "/chaser": {
    title: "Payment Chaser: Late Payment Reminders & Notices – ClauseRadar",
    description: "Track invoices against your contract terms and send a friendly reminder, a firm late-fee notice and a formal demand notice, with MSMED Act references for India.",
    index: true, priority: "0.8",
  },
  "/refer": {
    title: "Earn 30% Commission: ClauseRadar Referral Program",
    description: "Refer freelancers, creators and agencies to ClauseRadar Pro and earn 30% recurring commission on every subscription, paid via UPI or USDT (TRC20).",
    index: true, priority: "0.5",
  },
  "/admin": {
    title: "Admin – ClauseRadar",
    description: "Admin area.",
    index: false, priority: "0.1",
  },
  "/guides": {
    title: "100 Contract Guides for Freelancers, Creators & Job Seekers",
    description: "Plain-English guides to job bonds, notice period buyouts, brand deal usage rights, late payment, scope creep and agency contracts, with safer clauses.",
    index: true, priority: "0.8",
  },
  "/radar": {
    title: "Contract Risk Calculator: Cost of Net-90 Payments & Liability",
    description: "Estimate what late payment, unlimited revisions, IP transfer and uncapped liability could cost you before you sign a freelance or agency contract.",
    index: true, priority: "0.6",
  },
  "/vault": {
    title: "Contract Clause Library: Freelance, Creator Deals, Job & IP – ClauseRadar",
    description: "Copy-paste safer clauses for payment security, IP retention, creator usage rights and exclusivity, employment side-project carve-outs, kill fees and capped liability.",
    index: true, priority: "0.6",
  },
  "/privacy": {
    title: "Privacy Policy: How ClauseRadar Handles Your Contracts & Data",
    description: "How ClauseRadar processes contracts, which Contract Memory, referral and payment records it keeps, which providers it uses and how to delete your data.",
    index: true, priority: "0.3",
  },
  "/terms": {
    title: "Terms of Service & Not-Legal-Advice Notice – ClauseRadar",
    description: "Terms for using ClauseRadar: Free and Pro plans, Whop subscriptions, referral program rules, acceptable use and the not-legal-advice disclaimer.",
    index: true, priority: "0.3",
  },
  "/account": {
    title: "Account – ClauseRadar",
    description: "Your ClauseRadar account, plan and devices.",
    index: false, priority: "0.1",
  },
};

// every guide becomes an indexable route with its own title and description
GUIDES.forEach(function (g) {
  ROUTE_META[g.slug] = { title: g.title, description: g.description, index: true, priority: "0.7" };
});
