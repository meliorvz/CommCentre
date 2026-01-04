# Security Remediation Tickets

> **For the 100-person parallel team**: Pick any ticket from the current round, work on it, mark complete, move to next.

## Execution Rounds

| Round | Status | Tickets | Description |
|-------|--------|---------|-------------|
| **1** | 🟡 READY | 13 tickets | No dependencies - start immediately |
| **2** | 🔴 BLOCKED | 8 tickets | Waiting for Round 1 |
| **3** | 🔴 BLOCKED | 19 tickets | Waiting for Round 2 + Feature tickets |

---

## ROUND 1: No Dependencies (Start Now)

All 13 tickets can be worked in parallel:

| Ticket | Title | Effort | Assignee | Status |
|--------|-------|--------|----------|--------|
| [T-001](round-1/T-001.md) | Create Tenant-Scoped Database Tables | 4-6h | _____ | 🟡 |
| [T-002](round-1/T-002.md) | Create Row-Level Security Policies | 4-6h | _____ | 🟡 |
| [T-008](round-1/T-008.md) | Implement Twilio Signature Validation | 4-6h | _____ | 🟡 |
| [T-009](round-1/T-009.md) | Implement Email Webhook Validation | 2-3h | _____ | 🟡 |
| [T-010](round-1/T-010.md) | Implement Telegram Webhook Security | 2-3h | _____ | 🟡 |
| [T-013](round-1/T-013.md) | Implement Stripe Webhook Idempotency | 4-6h | _____ | 🟡 |
| [T-017](round-1/T-017.md) | Add Comms Events Logging | 4-6h | _____ | 🟡 |
| [T-018](round-1/T-018.md) | Implement Argon2id Password Hashing | 4-6h | _____ | 🟡 |
| [T-019](round-1/T-019.md) | Add CSRF Protection | 4-6h | _____ | 🟡 |
| [T-021](round-1/T-021.md) | Add Usage Events Ledger | 4-6h | _____ | 🟡 |
| [T-022](round-1/T-022.md) | Add Entitlements Table | 3-4h | _____ | 🟡 |
| [T-023](round-1/T-023.md) | Create Per-Tenant Integration Token Storage | 6-8h | _____ | 🟡 |
| [T-026](round-1/T-026.md) | Implement Audit Logging | 6-8h | _____ | 🟡 |

---

## ROUND 2: First-Level Dependencies

These tickets are blocked until their dependencies in Round 1 are complete:

| Ticket | Title | Blocked By | Effort | Status |
|--------|-------|------------|--------|--------|
| [T-003](round-2/T-003.md) | Make ConfigDO Per-Tenant | T-001 | 6-8h | 🔴 |
| [T-004](round-2/T-004.md) | Add Tenant Context to DB Connections | T-002 | 3-4h | 🔴 |
| [T-011](round-2/T-011.md) | Fix Inbound SMS Tenant Routing | T-008 | 6-8h | 🔴 |
| [T-012](round-2/T-012.md) | Fix Inbound Email Tenant Routing | T-009 | 6-8h | 🔴 |
| [T-014](round-2/T-014.md) | Fix SQL Injection in SMS Status Callback | T-008 | 1-2h | 🔴 |
| [T-015](round-2/T-015.md) | Remove Dangerous Twilio From Number Fallback | T-001 | 6-8h | 🔴 |
| [T-024](round-2/T-024.md) | Migrate Gmail to Per-Tenant Tokens | T-023 | 8-10h | 🔴 |
| [T-025](round-2/T-025.md) | Migrate Telegram to Per-Tenant Tokens | T-023 | 4-6h | 🔴 |

---

## ROUND 3: Deeper Dependencies + Features

| Ticket | Title | Blocked By | Effort | Status |
|--------|-------|------------|--------|--------|
| [T-005](round-3/T-005.md) | Migrate Settings Routes to DB | T-001, T-003, T-004 | 8-10h | 🔴 |
| [T-006](round-3/T-006.md) | Migrate Templates Routes to DB | T-001, T-004 | 4-6h | 🔴 |
| [T-007](round-3/T-007.md) | Migrate Prompt Routes to DB | T-001, T-004 | 4-6h | 🔴 |
| [T-016](round-3/T-016.md) | Update All SMS/Email Callers | T-015 | 4-6h | 🔴 |
| [T-020](round-3/T-020.md) | Implement Pre-Send Credit Checks | T-003 | 4-6h | 🔴 |
| [T-027](round-3/T-027.md) | Welcome & Value Proposition Step | All P0 | 1-2h | 🔴 |
| [T-028](round-3/T-028.md) | Business Profile Enhancement | All P0 | 2-3h | 🔴 |
| [T-029](round-3/T-029.md) | Gmail OAuth Frontend | T-024 | 3-4h | 🔴 |
| [T-030](round-3/T-030.md) | Gmail OAuth Backend | T-024 | 3-4h | 🔴 |
| [T-031](round-3/T-031.md) | Stripe Subscription Step | All P0 | 3-4h | 🔴 |
| [T-032](round-3/T-032.md) | Phone Provisioning Frontend | T-031 | 4-5h | 🔴 |
| [T-033](round-3/T-033.md) | Phone Provisioning Backend | T-015, T-016 | 4-5h | 🔴 |
| [T-034](round-3/T-034.md) | Telegram Setup Frontend | T-025 | 2-3h | 🔴 |
| [T-035](round-3/T-035.md) | Telegram Setup Backend | T-025 | 2-3h | 🔴 |
| [T-036](round-3/T-036.md) | Platform Escalation Number | T-015 | 2h | 🔴 |
| [T-037](round-3/T-037.md) | Onboarding State Frontend | All P0 | 3-4h | 🔴 |
| [T-038](round-3/T-038.md) | Onboarding State Backend | All P0 | 2-3h | 🔴 |
| [T-039](round-3/T-039.md) | Style Learning Feature | T-029, T-030 | 8-10h | 🔴 |
| [T-040](round-3/T-040.md) | Google Sign-In Auth | All P0 | 4-5h | 🔴 |

---

## Status Legend

- 🟡 **READY** - Can be started now
- 🟢 **IN PROGRESS** - Being worked on
- ✅ **DONE** - Complete and verified
- 🔴 **BLOCKED** - Waiting for dependencies

---

## Total Effort

| Category | Tickets | Hours |
|----------|---------|-------|
| Round 1 | 13 | ~55-75h |
| Round 2 | 8 | ~45-55h |
| Round 3 | 19 | ~55-75h |
| **Total** | **40** | **~155-205h** |

**With 100 people**: 4-7 days total
