# Oakit — Parent Role: Full Testing Guide

This document is for testers verifying the **Parent** role.  
It covers every screen, every section, every action, and what to expect — including what should be blocked.

---

## Login

- URL: `/login`
- After login, you are automatically redirected to `/parent`.
- If your account has a **force password reset** flag, you will be redirected to `/auth/change-password` before you can proceed. Change your password and log in again.
- If your token is invalid or expired, you are redirected back to `/login`.

---

## Layout Overview

The parent portal has two layouts depending on screen size:

**Desktop (large screen)**
- Left sidebar: navigation menu + child card at the bottom + sign out button.
- Centre: main content area for the active tab.
- Right column 1 (Class Feed): live photo feed from school — always visible.
- Right column 2: quick summary panel (attendance ring, progress bar, outstanding fees).

**Mobile**
- Sticky header at the top: greeting + child avatar + notification bell.
- Scrollable content area.
- Fixed bottom navigation bar with 6 tabs (Home, Calendar, Progress, Assignments, Messages, Updates). Fees, Reports, and Settings are accessible from the Home tab quick actions or by scrolling the bottom nav.

---

## Multiple Children

If you have more than one child enrolled:
- A child switcher appears in the sidebar (desktop) or in the header (mobile).
- Tap the ↕ button to cycle through children.
- All data (attendance, progress, homework, fees) reloads for the selected child.
- Messages and announcements are shared across all children (school-wide).

---

## Tab-by-Tab Guide

---

### 🏠 Home Tab

This is the landing screen after login. It gives a snapshot of everything important.

#### Stats Row (top of every tab)
Four summary cards always visible at the top:
| Card | What it shows |
|---|---|
| Attendance | Your child's attendance % this month. Shows "Excellent" if ≥ 90%. |
| Progress | Curriculum coverage % this term (e.g. 42.5%). |
| Messages | Count of unread messages from teachers. |
| Updates | Count of unread notifications. |

#### Today's Feed
- Shows what your child's class covered **today**.
- If the teacher submitted a lesson plan, you see the topic names as green pill tags (e.g. "Addition", "Place Value").
- If it was a special day (holiday, sports day, etc.), you see a yellow card with the event name.
- If no plan was submitted yet, you see "No feed data yet for today".

#### This Week
- A 7-day mini calendar (Mon–Sun) showing the current week.
- Today's date is highlighted in green.
- A "View Full Calendar" link takes you to the Calendar tab.

#### Homework
- Shows up to 3 recent homework assignments.
- Each entry shows the homework description or teacher note.
- A "View All Updates" link takes you to the Assignments tab.
- If no homework has been assigned, this section is hidden.

#### Curriculum Progress
- A circular donut chart showing the % of curriculum covered this term.
- A progress bar below the chart.
- Read-only — you cannot interact with this.

#### Quick Actions
Four shortcut buttons:
- **Report Card** → jumps to the Reports tab.
- **Gallery** → jumps to the Updates tab (class photos).
- **Messages** → jumps to the Messages tab.
- **Fee Details** → jumps to the Fees tab.

#### Announcements
- Shows the 2 most recent school announcements.
- Each shows: title, body (truncated), author name, and date.
- Read-only.

---

### 📅 Calendar Tab

- Displays school events, holidays, exam dates, and other calendar entries.
- Events are created by the school admin — you cannot add or edit anything.
- Use this to plan around school holidays and exam schedules.

**What to test:**
- Verify events appear correctly.
- Verify you cannot create, edit, or delete any event.

---

### 📈 Progress Tab

- Shows your child's curriculum coverage in detail.
- Coverage % is calculated as: topics covered ÷ total topics in the curriculum × 100.
- A circular progress chart and a progress bar are shown.
- If the school has not set up a curriculum for your child's class, you will see "No curriculum data available".

**What to test:**
- Verify the percentage matches what the teacher has been marking as complete.
- Verify you cannot edit or add any progress data.

---

### 📝 Assignments Tab

- Lists all homework assignments sent to your child.
- Each entry shows:
  - Date the homework was assigned.
  - Homework description or teacher note.
  - Status (e.g. assigned, completed).
- Sorted by most recent first.
- Read-only — you cannot mark homework as done or add comments.

**What to test:**
- Verify homework entries appear.
- Verify you cannot submit, edit, or delete homework.

---

### 💬 Messages Tab

This tab has two sections side by side:

#### Teacher Message Threads (left)
- Lists all teachers you have an active message thread with.
- Each thread shows: teacher name, student name, last message preview, time, and unread count (red badge).
- Click a thread to open the full conversation.
- You can **send a new message** to the teacher from within the thread.
- Messages are scoped to your child — you only see threads for your own children's teachers.

#### Oakie AI Chat (right)
- A chat interface with Oakie, the AI assistant.
- Ask questions about your child's progress, attendance, or homework.
- Example questions:
  - *"How many days was my child absent this month?"*
  - *"What topics has my child covered in Maths?"*
  - *"Is there any homework due this week?"*
- Oakie only has access to your child's data — it cannot answer questions about other students.
- If Oakie is unavailable, you will see "Sorry, Oakie is unavailable right now."

**What to test:**
- Send a message to a teacher and verify it appears in the thread.
- Verify unread count decreases after reading a message.
- Ask Oakie a question and verify the response is relevant to your child.
- Verify Oakie does not reveal data about other students.

---

### 🔔 Updates Tab

Two sections:

#### Notifications
- Notifications are triggered when the teacher completes a lesson plan for your child's section.
- Each notification shows: section name, date, and how many topics were covered.
- Tap "Mark as read" (or the notification itself) to dismiss it — it disappears from the list.
- The red badge on the Updates nav item shows the count of unread notifications.

#### Announcements
- Full list of all school announcements (more than the 2 shown on Home).
- Each shows: title, full body text, author, and date.
- Read-only.

**What to test:**
- Verify notifications appear after a teacher submits a plan.
- Verify marking a notification as read removes it from the list and decrements the badge.
- Verify announcements are read-only.

---

### 💳 Fees Tab

This is the most detailed financial section for parents.

#### Fee Invoice
Shows a consolidated invoice for the selected child with:
- **Fee head name** (e.g. Tuition Fee, Transport Fee, Activity Fee).
- **Outstanding balance** per fee head.
- **Status** of each fee account (e.g. pending, partial, paid).
- **Due date** per fee head (if set).
- **Gross payable**: total of all outstanding balances.
- **Credit balance**: any advance payment or credit applied to the account.
- **Net payable**: gross payable minus credit balance (minimum ₹0).

#### Approved Concessions
- If any fee concessions have been approved for your child, they are shown here.
- Each concession shows: fee head name, concession amount/percentage, and status.
- Read-only — you cannot request or modify concessions from this screen.

#### Usage Charges
- If your school uses usage-based billing (e.g. transport by trips, meals by day), the current month's usage charges are shown here.
- Shows: fee head name, quantity used, rate, and total charge.

#### Payment History
- Full list of all payments made for this child.
- Each entry shows: date, amount, fee head, payment method, and receipt link.
- **Download Receipt**: click the receipt link to download/view the PDF receipt for any payment.

#### Online Payment (if enabled)
- If the school has enabled online payments, a **Pay Now** button appears.
- Before proceeding, you must tick a checkbox acknowledging: *"Fees once paid cannot be refunded under any circumstances."*
- If you do not acknowledge this, the payment cannot be initiated.
- Payment is processed via Razorpay or PhonePe (depending on school configuration).

#### Siblings Summary (if you have multiple children)
- A summary card showing outstanding balances for all your children.
- Shows net payable per child and a combined total.

**What to test:**
- Verify the invoice shows correct fee heads and balances.
- Verify credit balance is deducted from gross payable correctly.
- Verify payment history shows past payments with receipt links.
- Try to initiate a payment without ticking the acknowledgement — it should be blocked.
- Verify you cannot see fee data for students who are not your children (try a different student ID in the URL — you should get a 403 error).

---

### 📊 Reports Tab

A summary report for your child combining attendance and curriculum data.

#### Attendance Report
- Total school days in the period.
- Days present, days absent, days late.
- Attendance percentage.
- Punctuality percentage (on-time arrivals).
- A day-by-day record showing each date and status (P = Present, A = Absent, L = Late).

#### Curriculum Progress Report
- Coverage percentage this term.
- Total topics in the curriculum vs. topics covered.
- Read-only.

**What to test:**
- Verify attendance numbers add up (present + absent = total days).
- Verify the day-by-day record matches what you know about your child's attendance.
- Verify you cannot edit any data.

---

### ⚙️ Settings Tab

Personal preferences for your account.

#### Notification Preferences
- Toggle which types of notifications you want to receive (e.g. lesson plan updates, announcements, homework).
- Changes are saved immediately.

#### Calendar Sync
- Toggle to enable/disable syncing school calendar events to your device calendar.

#### Assistant Reminders
- Toggle to enable/disable reminder messages from Oakie.

#### Translation Settings
- Configure language preferences for content translation (if supported by your school).

**What to test:**
- Toggle a notification preference, reload the page, and verify the setting persisted.
- Verify settings are per-parent (changing your settings does not affect other parents).

---

### 📸 Class Feed (Desktop only — right column)

- Always visible on desktop as a right-side column.
- Shows photos and updates posted by the class teacher.
- Shows up to 8 recent posts.
- Each post shows: photo/image, caption (if any), and date.
- **Read-only** — you cannot post, comment, or delete anything.
- The "Live" badge indicates the feed is real-time.

**What to test:**
- Verify photos from the teacher appear here.
- Verify you cannot post or interact with the feed.

---

### 👤 Child Profile & Photo

- Your child's name, class, and section are shown in the sidebar (desktop) or header (mobile).
- A green "Active" badge confirms the child is enrolled.
- **Upload a photo**: tap the child's avatar to upload a profile photo (JPEG or PNG).
  - The photo is uploaded immediately and replaces the initial letter avatar.
  - This is the only write action available on the child's profile.

**What to test:**
- Upload a photo and verify it appears immediately.
- Verify the photo persists after refreshing the page.
- Verify you cannot edit the child's name, class, or section.

---

## Observations (accessible via API, not a dedicated tab)

- Teacher observations that have been marked **"share with parent"** are visible to you.
- These appear in the child's journey/profile area.
- Observations that the teacher has kept private are **not visible** — you will never see them.
- You cannot add, edit, or delete observations.

---

## Student Analytics (Quiz Results)

- If the school has enabled the **Student Portal** for your child's class, you can view quiz performance.
- Shows: total quizzes attempted, average score %, subject-by-subject breakdown.
- Subjects where your child scored below 50% are flagged as "Needs Revision".
- If the student portal is not enabled for your child's class, this section returns a 403 and is hidden.

---

## What a Parent **Cannot** Do

This is important for security testing. All of the following should be **blocked** (403 or redirect to login):

| Action | Expected result |
|---|---|
| Access `/admin` | Redirected to `/login` or 403 |
| Access `/principal` | Redirected to `/login` or 403 |
| Access `/teacher` | Redirected to `/login` or 403 |
| Access `/super-admin` | Redirected to `/login` or 403 |
| Access `/franchise-admin` | Redirected to `/login` or 403 |
| View another student's fees (different student ID in URL) | 403 Access denied |
| View another student's attendance | 403 Access denied |
| View another student's observations | 403 Access denied |
| Mark attendance | 403 / route does not exist for parent |
| Create a lesson plan | 403 / route does not exist for parent |
| Post to the class feed | 403 / no UI available |
| Create or edit announcements | 403 / no UI available |
| Create or edit calendar events | 403 / no UI available |
| Collect a fee payment | 403 / no UI available |
| View salary data | 403 / no UI available |
| View expense records | 403 / no UI available |
| View reconciliation | 403 / no UI available |
| View other parents' data | 403 / school-scoped and parent-scoped |
| Access financial management screens | 403 / no UI available |
| Create or approve concessions | 403 / no UI available |
| Access admin audit logs | 403 / no UI available |

---

## Security Notes for Testers

1. **Cross-student access**: Every parent API endpoint verifies that the requested student belongs to the authenticated parent via the `student_parents` table. Attempting to pass a different student's ID in the URL will always return 403.

2. **School scope**: A parent from School A cannot access data from School B, even if they somehow obtain a valid token. The `school_id` in the JWT is enforced on every request.

3. **Observations privacy**: Only observations explicitly marked `share_with_parent = true` by the teacher are returned. Private observations are never exposed.

4. **Fee non-refundable acknowledgement**: The online payment endpoint requires `acknowledged_non_refundable: true` in the request body. Without it, the payment is rejected with error code `NON_REFUNDABLE_NOTICE_REQUIRED`.

5. **Token expiry**: If your session token expires mid-session, you will be redirected to `/login`. You cannot continue without re-authenticating.
