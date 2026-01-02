# Comprehensive Test Plan: UAT & Smoke Testing

**Document Version:** 2.0  
**Last Updated:** 2 January 2026  
**Application:** Paradise Comms Centre

---

## Table of Contents

1. [Introduction](#introduction)
2. [Test Environment Setup](#test-environment-setup)
3. [User Roles Overview](#user-roles-overview)
4. [Testing Best Practices](#testing-best-practices)
5. [Smoke Testing](#smoke-testing)
6. [Super Admin Testing](#super-admin-testing)
7. [Company Admin Testing](#company-admin-testing)
8. [Staff User Testing](#staff-user-testing)
9. [Issue Logging Template](#issue-logging-template)
10. [Test Completion Checklist](#test-completion-checklist)

---

## Introduction

This document provides exhaustive step-by-step testing procedures for the Paradise Comms Centre application. Each section is designed to be followed sequentially in logical order.

**Testing Objectives:**
- Verify all features function correctly for each user role
- Ensure proper access control and permission boundaries
- Validate data persistence and integrity
- Confirm integration functionality (SMS, Email, Telegram, Stripe)
- Document any defects or unexpected behaviour

---

## Test Environment Setup

### Environments

| Environment | UI URL | API URL |
|-------------|--------|---------|
| **Development** | `https://comms-85i.pages.dev` | `https://comms-centre.ancient-fire-eaa9.workers.dev` |
| **Production** | `https://comms.paradisestayz.com.au` | `https://comms-centre-prod.ancient-fire-eaa9.workers.dev` |

### Test Credentials

> ℹ️ **TESTING FLOW:** This test plan follows a logical flow where you start as Super Admin and **create** the other test accounts during the testing process. This validates the user creation functionality while setting up accounts for subsequent tests.

#### Starting Credential (Pre-existing)

| Role | Email | Password | Environment |
|------|-------|----------|-------------|
| **Super Admin** | `devops@melior.group` | *(obtain from system admin)* | Dev / Prod |

#### Credentials Created During Testing

These accounts will be created as part of the test flow:

| Role | Email | Password | Created in Test |
|------|-------|----------|-----------------|
| **Company Admin** | `uat-companyadmin@test.paradisestayz.com.au` | `TestAdmin2026!` | SA-003 |
| **Staff User** | `uat-staff@test.paradisestayz.com.au` | `TestStaff2026!` | CA-003 |

> ⚠️ **IMPORTANT:** After testing is complete, delete these test accounts to maintain a clean system (see Appendix A).

### Required Tools

- [ ] Modern web browser (Chrome recommended)
- [ ] Screenshot tool (e.g., Snagit, built-in screenshot)
- [ ] Personal mobile phone for SMS testing
- [ ] Personal email account for email testing
- [ ] Access to the Telegram test group
- [ ] Test Stripe card: `4242 4242 4242 4242` (for Dev only)

### Pre-Test Checklist

- [ ] Clear browser cache and cookies
- [ ] Note the date and time testing begins: `_____________`
- [ ] Confirm which environment you are testing: `☐ Dev` / `☐ Prod`
- [ ] Create a dedicated folder for screenshots named: `TestRun_YYYY-MM-DD`

---

## User Roles Overview

The application has four distinct user roles with escalating permissions:

| Role | Access Level | Key Permissions |
|------|--------------|-----------------|
| **Super Admin** | Platform-wide | Manage all companies, view platform costs, add credits to any company |
| **Company Admin** | Company-wide | Manage users, billing, integrations, all company settings |
| **Admin** | Company-wide | Same as Company Admin (legacy role name) |
| **Staff** | Limited | View/manage conversations, properties, stays, basic operations |

---

## Testing Best Practices

### Screenshot Requirements

Take a screenshot for each of the following:
1. ✅ **Pass states** - When a feature works as expected
2. ❌ **Fail states** - When something doesn't work
3. ⚠️ **Warnings/Errors** - Any error messages displayed
4. 📊 **Data states** - Before and after data changes

**Screenshot Naming Convention:**
```
[TestID]_[Role]_[Feature]_[Pass/Fail]_[Timestamp].png
Example: TC001_SuperAdmin_CreateCompany_Pass_143522.png
```

### Logging Issues

For EVERY issue found:
1. Stop and document immediately
2. Take a screenshot
3. Note the exact steps to reproduce
4. Record expected vs actual behaviour
5. Assign severity (Critical/High/Medium/Low)

---

## Smoke Testing

> **Purpose:** Quick verification that the system is operational after deployment.  
> **Duration:** 5-10 minutes  
> **Frequency:** After every deployment

### ST-001: API Health Check

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Open a new browser tab | Tab opens | |
| 2 | Navigate to Dev API health endpoint: `https://comms-centre.ancient-fire-eaa9.workers.dev/health` | | |
| 3 | Verify response | Response shows `{"status":"ok"}` | |
| 4 | 📷 **SCREENSHOT:** Capture the health response | | |
| 5 | Navigate to Prod API health endpoint: `https://comms-centre-prod.ancient-fire-eaa9.workers.dev/health` | | |
| 6 | Verify response | Response shows `{"status":"ok"}` | |
| 7 | 📷 **SCREENSHOT:** Capture the health response | | |

### ST-002: UI Load Check

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to Dev UI: `https://dev.paradisestayz.com.au` | | |
| 2 | Verify login page loads | Login form with email/password fields visible | |
| 3 | 📷 **SCREENSHOT:** Capture login page | | |
| 4 | Navigate to Prod UI: `https://comms.paradisestayz.com.au` | | |
| 5 | Verify login page loads | Login form with email/password fields visible | |
| 6 | 📷 **SCREENSHOT:** Capture login page | | |

### ST-003: Quick Authentication Test

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Enter valid credentials on login page | | |
| 2 | Click "Sign In" button | Login successful, redirected to Dashboard | |
| 3 | Verify Dashboard loads | Dashboard shows welcome message and navigation | |
| 4 | 📷 **SCREENSHOT:** Capture Dashboard | | |
| 5 | Click "Sign out" in sidebar | Redirected to login page | |

---

## Super Admin Testing

> **Prerequisites:**  
> - Logged in as Super Admin user  
> - Testing on the appropriate environment (Dev recommended for destructive tests)

### SA-001: Super Admin Login and Access Verification

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to the login page | Login form displayed | |
| 2 | Enter Super Admin email: `_____________` | | |
| 3 | Enter Super Admin password | | |
| 4 | Click "Sign In" button | Login successful | |
| 5 | Verify sidebar shows "Super Admin" badge near username | Badge visible with text "Super Admin" | |
| 6 | 📷 **SCREENSHOT:** Sidebar showing Super Admin badge | | |
| 7 | Verify "Platform Admin" link appears in sidebar under "Administration" | Link visible | |
| 8 | Verify "Billing" link appears in sidebar | Link visible | |

### SA-002: Platform Admin - View Companies

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Platform Admin" in sidebar | Platform Admin page loads | |
| 2 | Verify page title shows "Platform Administration" | Title visible | |
| 3 | Verify "Companies" table is displayed | Table with columns: Company, Slug, Status, Users, Credits, Actions | |
| 4 | Count number of companies listed: `_____` | | |
| 5 | 📷 **SCREENSHOT:** Companies table | | |
| 6 | Verify "Trial Burn Rate" card is displayed | Shows daily cost | |
| 7 | 📷 **SCREENSHOT:** Trial burn rate card | | |

### SA-003: Platform Admin - Create New Company (Test Company for UAT)

> ⚠️ **IMPORTANT:** This step creates the test Company Admin account that will be used for Company Admin Testing.

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | On Platform Admin page, click "+ New Company" button | Dialog/modal opens | |
| 2 | Verify dialog title shows "Create Company" | Title visible | |
| 3 | 📷 **SCREENSHOT:** Create company dialog | | |
| 4 | Enter Company Name: `UAT Test Company` | | |
| 5 | Verify Slug field auto-populates to `uat-test-company` | Slug generated from company name | |
| 6 | Enter Initial Admin Email: `uat-companyadmin@test.paradisestayz.com.au` | | |
| 7 | Enter Initial Admin Password: `TestAdmin2026!` | | |
| 8 | 📷 **SCREENSHOT:** Filled form before submission | | |
| 9 | Click "Create" button | Dialog closes, success message shown | |
| 10 | Verify new company appears in table | Company listed with "trial" status | |
| 11 | 📷 **SCREENSHOT:** Companies table showing new company | |
| 12 | **Note:** Record company was created successfully for CA testing | This account will be used in CA-001 | |

### SA-004: Platform Admin - Add Credits to Company

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | On Platform Admin page, locate a company in the table | | |
| 2 | Note current credits for the company: `_____` | | |
| 3 | Click the "$" (Add Credits) icon in the Actions column | Dialog/modal opens | |
| 4 | Verify dialog shows company name | Company name displayed | |
| 5 | 📷 **SCREENSHOT:** Add credits dialog | | |
| 6 | Enter credit amount: `500` | | |
| 7 | Enter reason: `Testing - Credit Addition` | | |
| 8 | Click "Add Credits" button | Dialog closes, success message shown | |
| 9 | Verify credits updated in table | New balance = Old balance + 500 | |
| 10 | 📷 **SCREENSHOT:** Updated credits in table | | |

### SA-005: Super Admin Access to Company Features

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Dashboard" in sidebar | Dashboard page loads | |
| 2 | Verify Dashboard shows system overview | Stats cards visible | |
| 3 | Click "Properties" in sidebar | Properties page loads | |
| 4 | Verify properties list is accessible | Page loads without error | |
| 5 | Click "Inbox" in sidebar | Inbox page loads | |
| 6 | Verify inbox is accessible | Threads list or empty state visible | |
| 7 | Click "Settings" in sidebar | Settings page loads | |
| 8 | Verify all settings sections are visible | Users, integrations, etc. | |
| 9 | 📷 **SCREENSHOT:** Settings page showing available sections | | |

---

## Company Admin Testing

> **Prerequisites:**  
> - Logged in as Company Admin user  
> - Testing on the appropriate environment

### CA-001: Company Admin Login and Access Verification

> ℹ️ **Note:** Log out of the Super Admin account before starting this section. Use the credentials created in SA-003.

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Sign out" to logout from Super Admin session | Redirected to login page | |
| 2 | Enter Company Admin email: `uat-companyadmin@test.paradisestayz.com.au` | | |
| 3 | Enter Company Admin password: `TestAdmin2026!` | | |
| 4 | Click "Sign In" button | Login successful | |
| 5 | Verify sidebar shows company name: "UAT Test Company" | Company name visible below user email | |
| 6 | 📷 **SCREENSHOT:** Sidebar showing company name | | |
| 7 | Verify "Credits" balance is shown in sidebar | Credit balance displayed | |
| 8 | Verify "Billing" link appears in sidebar | Link visible under Administration | |
| 9 | Verify "Platform Admin" link is NOT visible | Link should not appear (Super Admin only) | |

### CA-002: Settings - User Management - View Users

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Settings" in sidebar | Settings page loads | |
| 2 | Locate "User Management" section | Section visible on page | |
| 3 | Verify current users are listed | User list/table displayed | |
| 4 | Note number of users: `_____` | | |
| 5 | 📷 **SCREENSHOT:** User management section | | |

### CA-003: Settings - User Management - Create User (Staff for UAT)

> ⚠️ **IMPORTANT:** This step creates the Staff user account that will be used for Staff User Testing (SU-001 onwards).

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | In User Management section, click "+ Add User" button | Dialog/form opens | |
| 2 | 📷 **SCREENSHOT:** Add user dialog | | |
| 3 | Enter email: `uat-staff@test.paradisestayz.com.au` | | |
| 4 | Enter password: `TestStaff2026!` | | |
| 5 | Select role: `staff` | | |
| 6 | Click "Create User" button | Dialog closes, success message | |
| 7 | Verify new user appears in list | User shown with "staff" role | |
| 8 | 📷 **SCREENSHOT:** User list showing new user | | |
| 9 | **Note:** Record staff user was created for SU testing | This account will be used in SU-001 | |

### CA-004: Settings - User Management - Change User Role

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Locate a staff user in the list | | |
| 2 | Find the role dropdown/selector for that user | | |
| 3 | Change role from "staff" to "admin" | | |
| 4 | Verify role updates successfully | Role shows "admin" | |
| 5 | 📷 **SCREENSHOT:** User with updated role | | |
| 6 | Change role back to "staff" | Role reverts | |

### CA-005: Settings - User Management - Change Password

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Locate a user in the list | | |
| 2 | Click the key/password icon for that user | Dialog opens | |
| 3 | 📷 **SCREENSHOT:** Change password dialog | | |
| 4 | Enter new password: `NewPass123!` | | |
| 5 | Click "Change Password" button | Success message shown | |
| 6 | 📷 **SCREENSHOT:** Success confirmation | | |

### CA-006: Settings - User Management - Delete User

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Locate the test user created in CA-003 | | |
| 2 | Click the delete/trash icon for that user | Confirmation prompt appears | |
| 3 | 📷 **SCREENSHOT:** Delete confirmation | | |
| 4 | Confirm deletion | User removed from list | |
| 5 | Verify user no longer appears in list | User gone | |
| 6 | 📷 **SCREENSHOT:** User list without deleted user | | |

### CA-007: Settings - Global Settings

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | On Settings page, locate "Global Settings" section | Section visible | |
| 2 | Note current values of settings | | |
| 3 | 📷 **SCREENSHOT:** Global settings before changes | | |
| 4 | Modify one setting (toggle a switch or change a value) | | |
| 5 | Click "Save" button | Success message shown | |
| 6 | 📷 **SCREENSHOT:** Success confirmation | | |
| 7 | Refresh the page (F5) | Page reloads | |
| 8 | Verify setting retained the change | Value persisted | |
| 9 | 📷 **SCREENSHOT:** Settings after page refresh | | |
| 10 | Revert the setting to original value | | |
| 11 | Save changes | | |

### CA-008: Billing - View Subscription

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Billing" in sidebar | Billing page loads | |
| 2 | Verify current plan/subscription is displayed | Plan name and status visible | |
| 3 | Verify credit balance is shown | Balance displayed | |
| 4 | 📷 **SCREENSHOT:** Billing page overview | | |
| 5 | Verify "Credit History" or transactions table is visible | Transaction log displayed | |
| 6 | 📷 **SCREENSHOT:** Credit transaction history | | |

### CA-009: Billing - Stripe Customer Portal

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | On Billing page, locate "Manage Subscription" button | Button visible | |
| 2 | Click "Manage Subscription" | New tab/window opens with Stripe portal | |
| 3 | Verify Stripe Customer Portal loads | Stripe-branded page with subscription details | |
| 4 | 📷 **SCREENSHOT:** Stripe Customer Portal | | |
| 5 | Close the Stripe portal tab | Return to Comms Centre | |

### CA-010: Integrations Page

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Integrations" in sidebar | Integrations page loads | |
| 2 | Verify "API Documentation" section is visible | Documentation shown | |
| 3 | 📷 **SCREENSHOT:** Integrations page | | |
| 4 | Note number of existing integrations: `_____` | | |

### CA-011: Integrations - Create API Integration

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | On Integrations page, click "+ New Integration" button | Dialog opens | |
| 2 | 📷 **SCREENSHOT:** New integration dialog | | |
| 3 | Enter Name: `Test Integration [Date]` | | |
| 4 | Enable desired channels (SMS, Email, etc.) | | |
| 5 | Click "Create" button | Integration created, API key shown | |
| 6 | 📷 **SCREENSHOT:** API key displayed (CRITICAL - MASK KEY IN REPORT) | | |
| 7 | Copy the API key using copy button | Key copied to clipboard | |
| 8 | Click "Done" or close dialog | Integration appears in list | |
| 9 | 📷 **SCREENSHOT:** Integration list with new entry | | |

### CA-012: Integrations - View Logs

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Locate an integration in the list | | |
| 2 | Click the "View Logs" button/icon | Logs dialog/section opens | |
| 3 | Verify logs are displayed (may be empty for new integration) | Log entries or empty state shown | |
| 4 | 📷 **SCREENSHOT:** Integration logs | | |

### CA-013: Integrations - Delete Integration

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Locate the test integration created in CA-011 | | |
| 2 | Click the delete/trash icon | Confirmation prompt | |
| 3 | 📷 **SCREENSHOT:** Delete confirmation | | |
| 4 | Confirm deletion | Integration removed | |
| 5 | Verify integration no longer in list | | |
| 6 | 📷 **SCREENSHOT:** Updated integration list | | |

### CA-014: Properties - View Properties

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Properties" in sidebar | Properties page loads | |
| 2 | Verify property list/cards are displayed | Properties shown or empty state | |
| 3 | Note number of properties: `_____` | | |
| 4 | 📷 **SCREENSHOT:** Properties page | | |

### CA-015: Properties - Create Property

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | On Properties page, click "+ Add Property" button | Form/dialog opens | |
| 2 | 📷 **SCREENSHOT:** Create property form | | |
| 3 | Enter Name: `Test Property [Date]` | | |
| 4 | Enter Address: `123 Test Street, Sydney NSW 2000` | | |
| 5 | Select a Twilio phone number (if available) | | |
| 6 | Click "Save" button | Property created | |
| 7 | Verify property appears in list | New property visible | |
| 8 | 📷 **SCREENSHOT:** Property list with new property | | |

### CA-016: Properties - Edit Property

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Locate the test property from CA-015 | | |
| 2 | Click edit/pencil icon | Edit form opens | |
| 3 | Change the address to: `456 Updated Avenue, Melbourne VIC 3000` | | |
| 4 | Click "Save" | Changes saved | |
| 5 | Verify updated address is displayed | New address shown | |
| 6 | 📷 **SCREENSHOT:** Updated property details | | |

### CA-017: Properties - Delete Property

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Locate the test property | | |
| 2 | Click delete/trash icon | Confirmation prompt | |
| 3 | 📷 **SCREENSHOT:** Delete confirmation | | |
| 4 | Confirm deletion | Property removed | |
| 5 | Verify property no longer in list | | |
| 6 | 📷 **SCREENSHOT:** Updated property list | | |

### CA-018: Stays - View Stays

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Stays" in sidebar | Stays page loads | |
| 2 | Verify stays list is displayed | Stays shown or empty state | |
| 3 | Note number of stays: `_____` | | |
| 4 | 📷 **SCREENSHOT:** Stays page | | |

### CA-019: Stays - Create Stay

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | On Stays page, click "+ Add Stay" button | Form opens | |
| 2 | 📷 **SCREENSHOT:** Create stay form | | |
| 3 | Select a Property from dropdown | | |
| 4 | Enter Guest Name: `Test Guest [Date]` | | |
| 5 | Enter Guest Email: `testguest@example.com` | | |
| 6 | Enter Guest Phone: `+61400111222` | | |
| 7 | Set Check-in Date: Tomorrow's date | | |
| 8 | Set Check-out Date: Day after tomorrow | | |
| 9 | Click "Save" button | Stay created | |
| 10 | Verify stay appears in list | New stay visible | |
| 11 | 📷 **SCREENSHOT:** Stay list with new stay | | |

### CA-020: Stays - Cancel Stay

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Locate the test stay from CA-019 | | |
| 2 | Click cancel/X icon | Confirmation appears | |
| 3 | 📷 **SCREENSHOT:** Cancel confirmation | | |
| 4 | Confirm cancellation | Stay marked as cancelled | |
| 5 | Verify stay shows "cancelled" status | Status updated | |
| 6 | 📷 **SCREENSHOT:** Stay with cancelled status | | |

### CA-021: Stays - CSV Import

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | On Stays page, locate "Import CSV" button | Button visible | |
| 2 | Click the button | File picker opens | |
| 3 | 📷 **SCREENSHOT:** File picker dialog | | |
| 4 | Select a valid CSV file with stay data (if available) | | |
| 5 | Verify import processes | Stays imported or error shown | |
| 6 | 📷 **SCREENSHOT:** Import result | | |

### CA-022: AI Configuration - Business Profile

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "AI Configuration" in sidebar | AI Config page loads | |
| 2 | Locate "Business Profile" section | Section visible | |
| 3 | 📷 **SCREENSHOT:** Business profile section | | |
| 4 | Note current business name: `_____________` | | |
| 5 | Expand the section by clicking on it | Form fields visible | |
| 6 | Modify business name by appending " - TEST" | | |
| 7 | Click "Save" button | Changes saved | |
| 8 | 📷 **SCREENSHOT:** Success confirmation | | |
| 9 | Refresh page | | |
| 10 | Verify changes persisted | Modified name showing | |
| 11 | Revert name to original | | |
| 12 | Save changes | | |

### CA-023: AI Configuration - Property Defaults

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | On AI Config page, locate "Property Defaults" section | Section visible | |
| 2 | 📷 **SCREENSHOT:** Property defaults section | | |
| 3 | Expand the section | Form fields visible | |
| 4 | Modify one field (e.g., default check-in time) | | |
| 5 | Save changes | Success confirmation | |
| 6 | 📷 **SCREENSHOT:** After saving | | |
| 7 | Revert change | | |
| 8 | Save | | |

### CA-024: AI Configuration - System Prompt

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | On AI Config page, locate "System Prompt" section | Section visible | |
| 2 | 📷 **SCREENSHOT:** System prompt section | | |
| 3 | Expand the section | Text editor visible | |
| 4 | View current prompt content | Prompt displayed | |
| 5 | Make a small addition at the end: `[TEST ADDITION - DELETE]` | | |
| 6 | Click "Save Draft" | Draft saved | |
| 7 | 📷 **SCREENSHOT:** Draft saved confirmation | | |
| 8 | Locate "Prompt History" section | History visible | |
| 9 | 📷 **SCREENSHOT:** Prompt history | | |
| 10 | Revert the change by removing the test addition | | |
| 11 | Save draft again | | |

### CA-025: Knowledge Base - View Categories

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Knowledge Base" in sidebar | Knowledge Base page loads | |
| 2 | Verify categories are displayed | Category list shown | |
| 3 | Note number of categories: `_____` | | |
| 4 | 📷 **SCREENSHOT:** Knowledge base overview | | |

### CA-026: Knowledge Base - Create Category

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "+ Add Category" button | Form appears | |
| 2 | Enter category name: `Test Category [Date]` | | |
| 3 | Click Save | Category created | |
| 4 | Verify new category appears | Category in list | |
| 5 | 📷 **SCREENSHOT:** New category in list | | |

### CA-027: Knowledge Base - Add Item to Category

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Expand the test category from CA-026 | Items list shown | |
| 2 | Click "+ Add Item" | Form appears | |
| 3 | 📷 **SCREENSHOT:** Add item form | | |
| 4 | Enter Question: `What is this test item?` | | |
| 5 | Enter Answer: `This is a test knowledge base item for UAT.` | | |
| 6 | Click Save | Item created | |
| 7 | Verify item appears under category | Item listed | |
| 8 | 📷 **SCREENSHOT:** Item under category | | |

### CA-028: Knowledge Base - Edit Item

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Locate the test item from CA-027 | | |
| 2 | Click edit icon | Edit form opens | |
| 3 | Modify the answer text | | |
| 4 | Save changes | Success | |
| 5 | Verify answer updated | | |
| 6 | 📷 **SCREENSHOT:** Updated item | | |

### CA-029: Knowledge Base - Delete Item and Category

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Locate the test item | | |
| 2 | Click delete icon on item | Confirmation | |
| 3 | Confirm deletion | Item removed | |
| 4 | 📷 **SCREENSHOT:** Category without item | | |
| 5 | Click delete icon on the test category | Confirmation | |
| 6 | Confirm deletion | Category removed | |
| 7 | 📷 **SCREENSHOT:** Category list without test category | | |

### CA-030: Automations - View Settings

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Automations" in sidebar | Automations page loads | |
| 2 | Verify Global Automation settings section visible | Section displayed | |
| 3 | 📷 **SCREENSHOT:** Automations page | | |
| 4 | Verify Per-Property settings section visible (if properties exist) | Section displayed | |

### CA-031: Automations - Modify Settings

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Note current global settings values | | |
| 2 | 📷 **SCREENSHOT:** Current automation settings | | |
| 3 | Modify response delay value | | |
| 4 | Save changes | Success | |
| 5 | 📷 **SCREENSHOT:** Saved confirmation | | |
| 6 | Refresh page | | |
| 7 | Verify setting persisted | Value retained | |
| 8 | Revert to original value | | |
| 9 | Save | | |

### CA-032: Templates - View Templates

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Templates" in sidebar | Templates page loads | |
| 2 | Verify template list displayed | Templates shown | |
| 3 | Note number of templates: `_____` | | |
| 4 | 📷 **SCREENSHOT:** Templates page | | |

### CA-033: Inbox - View Threads

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Inbox" in sidebar | Inbox page loads | |
| 2 | Verify thread list displayed | Threads shown or empty state | |
| 3 | Note number of threads: `_____` | | |
| 4 | 📷 **SCREENSHOT:** Inbox overview | | |

### CA-034: Inbox - View Thread Detail

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click on any thread in the list | Thread detail page loads | |
| 2 | Verify message history displayed | Messages visible | |
| 3 | Verify reply input area visible | Text input present | |
| 4 | 📷 **SCREENSHOT:** Thread detail view | | |

### CA-035: Messaging - Inbound SMS Test

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | On YOUR PERSONAL PHONE: Open SMS app | | |
| 2 | Compose a new message to the Comms Number: `_____________` | | |
| 3 | Send message: `UAT Test [Date] [Time]` | Message sent | |
| 4 | Wait 30 seconds | | |
| 5 | In Comms Centre, check Inbox | | |
| 6 | Verify new thread or message appears | Message visible | |
| 7 | 📷 **SCREENSHOT:** Inbound message in Inbox | | |
| 8 | Note if AI auto-replied: ☐ Yes / ☐ No | | |

### CA-036: Messaging - Outbound SMS Test

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Open the thread from CA-035 | Thread detail visible | |
| 2 | In reply input, type: `UAT Reply Test [Time]` | | |
| 3 | Click Send button | Message sent | |
| 4 | 📷 **SCREENSHOT:** Reply in thread | | |
| 5 | Check YOUR PERSONAL PHONE for SMS | | |
| 6 | Verify SMS received | Message arrived | |
| 7 | 📷 **SCREENSHOT (phone):** Received SMS | | |

### CA-037: Email - Inbound Email Test

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | From YOUR PERSONAL EMAIL account, compose new email | | |
| 2 | Send to: `hello@paradisestayz.com.au` (or dev address) | | |
| 3 | Subject: `UAT Test [Date] [Time]` | | |
| 4 | Body: `This is a UAT test email.` | | |
| 5 | Send the email | Email sent | |
| 6 | Wait 60 seconds | | |
| 7 | In Comms Centre, check Inbox | | |
| 8 | Verify new thread or message appears | Email visible | |
| 9 | 📷 **SCREENSHOT:** Inbound email in Inbox | | |

### CA-038: Email - Outbound Email Test

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Open the email thread from CA-037 | Thread detail visible | |
| 2 | In reply input, type: `UAT Email Reply Test [Time]` | | |
| 3 | Click Send button | Email sent | |
| 4 | 📷 **SCREENSHOT:** Reply in thread | | |
| 5 | Check YOUR PERSONAL EMAIL inbox | | |
| 6 | Verify reply email received | Email arrived | |
| 7 | Verify email is threaded correctly with original | Same thread | |
| 8 | 📷 **SCREENSHOT (email):** Received reply | | |

### CA-039: Telegram Notifications

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Verify access to Telegram test group | Have access | |
| 2 | In Comms Centre, trigger a "Needs Human" event | | |
| 3 | (Option A: Send angry message from phone) | | |
| 4 | (Option B: Manually escalate a thread) | | |
| 5 | Wait 30 seconds | | |
| 6 | Check Telegram group | | |
| 7 | Verify notification appeared | Message in group | |
| 8 | 📷 **SCREENSHOT (Telegram):** Notification received | | |

### CA-040: Dashboard Verification

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Dashboard" in sidebar | Dashboard loads | |
| 2 | Verify stats cards displayed | Cards visible | |
| 3 | Verify recent conversations section | Section visible | |
| 4 | Click on a recent conversation | Navigates to thread | |
| 5 | 📷 **SCREENSHOT:** Dashboard with stats | | |

### CA-041: Help Page

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Help" in sidebar | Help page loads | |
| 2 | Verify help content displayed | Content visible | |
| 3 | Navigate through help sections | Sections expand/navigate | |
| 4 | 📷 **SCREENSHOT:** Help page | | |

### CA-042: Session Persistence

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | While logged in, open a new browser tab | | |
| 2 | Navigate to the application URL | | |
| 3 | Verify you are still logged in | Dashboard loads, not login | |
| 4 | 📷 **SCREENSHOT:** Logged in state in new tab | | |

### CA-043: Logout

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Sign out" in sidebar | | |
| 2 | Verify redirected to login page | Login page displayed | |
| 3 | 📷 **SCREENSHOT:** Login page after logout | | |
| 4 | Try navigating directly to `/inbox` | | |
| 5 | Verify redirected to login | Protected route works | |

---

## Staff User Testing

> **Prerequisites:**  
> - Complete Company Admin Testing section first (CA-003 creates the staff account)  
> - Log out of Company Admin account before starting

### SU-001: Staff Login and Access Verification

> ℹ️ **Note:** Use the Staff credentials created in CA-003.

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Sign out" to logout from Company Admin session | Redirected to login page | |
| 2 | Enter Staff user email: `uat-staff@test.paradisestayz.com.au` | | |
| 3 | Enter Staff user password: `TestStaff2026!` | | |
| 4 | Click "Sign In" button | Login successful | |
| 5 | 📷 **SCREENSHOT:** Logged in as staff | | |
| 6 | Verify "Billing" link is NOT visible in sidebar | Link hidden | |
| 7 | Verify "Platform Admin" link is NOT visible | Link hidden | |
| 8 | Verify "Integrations" link is NOT visible | Link hidden (admin only) | |
| 9 | 📷 **SCREENSHOT:** Sidebar showing staff-level navigation | | |

### SU-002: Staff - Dashboard Access

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Dashboard" in sidebar | Dashboard loads | |
| 2 | Verify dashboard displays relevant data | Stats visible | |
| 3 | 📷 **SCREENSHOT:** Staff dashboard view | | |

### SU-003: Staff - Properties Access

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Properties" in sidebar | Page loads | |
| 2 | Verify can view properties | List displayed | |
| 3 | 📷 **SCREENSHOT:** Staff properties view | | |

### SU-004: Staff - Stays Access

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Stays" in sidebar | Page loads | |
| 2 | Verify can view stays | List displayed | |
| 3 | (If allowed) Try creating a stay | Check if permitted | |
| 4 | 📷 **SCREENSHOT:** Staff stays view | | |

### SU-005: Staff - Inbox Access

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Inbox" in sidebar | Page loads | |
| 2 | Verify can view threads | List displayed | |
| 3 | Click on a thread | Thread detail loads | |
| 4 | Verify can send replies | Reply function works | |
| 5 | 📷 **SCREENSHOT:** Staff inbox access | | |

### SU-006: Staff - Settings Access

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Settings" in sidebar | Page loads | |
| 2 | Verify user management section is hidden or disabled | Cannot manage users | |
| 3 | 📷 **SCREENSHOT:** Staff settings view (limited) | | |

### SU-007: Staff - Direct URL Access Test

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Try navigating directly to `/billing` | | |
| 2 | Verify access denied or redirected | Cannot access | |
| 3 | Try navigating directly to `/admin` | | |
| 4 | Verify access denied or redirected | Cannot access | |
| 5 | Try navigating directly to `/integrations` | | |
| 6 | Verify access denied or redirected | Cannot access | |
| 7 | 📷 **SCREENSHOT:** Access denied message (if shown) | | |

### SU-008: Staff - Logout

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Sign out" in sidebar | Logged out | |
| 2 | Verify redirected to login | Login page shown | |
| 3 | 📷 **SCREENSHOT:** Logout successful | | |

---

## Issue Logging Template

Use the following template for EVERY issue discovered:

```
===========================================================
ISSUE ID: [BUG-XXX]
===========================================================

Date/Time Discovered: __________________
Tester Name: __________________
Environment: ☐ Dev / ☐ Prod
User Role: ☐ Super Admin / ☐ Company Admin / ☐ Staff

Test Case ID: __________________

SEVERITY:
☐ Critical (System unusable, data loss)
☐ High (Major feature broken)
☐ Medium (Feature works with workaround)
☐ Low (Minor UI/cosmetic issue)

SUMMARY:
______________________________________________

STEPS TO REPRODUCE:
1. 
2. 
3. 
4. 

EXPECTED RESULT:
______________________________________________

ACTUAL RESULT:
______________________________________________

SCREENSHOT REFERENCE:
______________________________________________

ADDITIONAL NOTES:
______________________________________________

===========================================================
```

---

## Test Completion Checklist

### Summary

| Section | Total Tests | Passed | Failed | Blocked | Notes |
|---------|-------------|--------|--------|---------|-------|
| Smoke Testing | 3 | | | | |
| Super Admin Testing | 5 | | | | |
| Company Admin Testing | 43 | | | | |
| Staff User Testing | 8 | | | | |
| **TOTAL** | **59** | | | | |

### Sign-Off

```
Test Execution Summary
======================

Environment Tested: ☐ Dev / ☐ Prod

Testing Period:
  Start Date: __________________
  End Date: __________________

Total Test Cases: 59
  Passed: _____
  Failed: _____
  Blocked: _____
  Not Executed: _____

Total Issues Found: _____
  Critical: _____
  High: _____
  Medium: _____
  Low: _____

Tester Name: __________________
Tester Signature: __________________
Date: __________________

Reviewer Name: __________________
Reviewer Signature: __________________
Date: __________________
```

### Screenshot Archive Checklist

Confirm all required screenshots have been captured and saved:

- [ ] All screenshots saved to `TestRun_YYYY-MM-DD` folder
- [ ] Screenshots named according to convention
- [ ] Sensitive data (API keys, passwords) masked in screenshots
- [ ] Screenshots organised by test section
- [ ] Issue-related screenshots linked to issue reports

### Handover Notes

_Space for tester to document any observations, concerns, or recommendations:_

```
__________________________________________________________________
__________________________________________________________________
__________________________________________________________________
__________________________________________________________________
__________________________________________________________________
```

---

## Appendix A: Test Data Cleanup

After testing, clean up test data created during UAT:

- [ ] Delete test companies (Super Admin only)
- [ ] Delete test users
- [ ] Delete test properties
- [ ] Cancel/delete test stays
- [ ] Delete test integrations
- [ ] Delete test knowledge base categories and items
- [ ] Revert any modified settings to original values

---

## Appendix B: Automated Smoke Test Script

```bash
# Run automated health check (script to be created)
npm run test:smoke-manual
```

**Note:** This script provides automated health checking. Manual UAT should always be performed for full coverage.

---

*End of Test Plan Document*
