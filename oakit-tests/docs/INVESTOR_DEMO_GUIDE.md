# Oakit Investor Demo Guide
## UKG Class — Silver Oak Juniors

---

## Step 0: Setup (do this before the demo)

### Run the seed data
1. Open **Supabase → SQL Editor**
2. Paste the full contents of `oakit/db/seed_demo_investor.sql`
3. Click **Run**
4. Verify the output shows 5 rows in the STAFF/PARENT table and 6 students

### Login credentials

| Role | Mobile | Password | Who |
|------|--------|----------|-----|
| Admin | `9800000001` | `9800000001` | Sunita Rao |
| Principal | `9800000002` | `9800000002` | Dr. Meera Pillai |
| Teacher | `9800000003` | `9800000003` | Ms. Kavitha Nair |
| Parent 1 | `9800000004` | `9800000004` | Rajesh Kapoor (Aarav's dad) |
| Parent 2 | `9800000005` | `9800000005` | Suresh Nair (Priya + Rohan — 2 kids) |

> School code: **sojs** (or whatever your school subdomain is)

---

## Demo Flow — 25 minutes total

---

## 1. ADMIN PORTAL (5 min)

**Login as Admin: 9800000001**

### What to show:

**Dashboard**
- School overview — classes, teachers, students at a glance
- "UKG-A has 6 students, 1 teacher assigned"

**Students**
- Go to Students → UKG → Section A
- Show the 6 students: Aarav, Priya, Rohan, Ananya, Dev, Sia
- Click a student — show parent contact, father/mother name

**Announcements**
- Show 3 announcements already created:
  - Sports Day (all school)
  - UKG Art Activity (class-specific)
  - Parent-Teacher Meeting (parents only)
- Point out: "We can target by class, all parents, or all staff"

**Settings**
- Show AI Plan Mode toggle — "We can enable Oakie's enhanced planning per class"

**Key talking point:**
> "The admin has full visibility — students, teachers, curriculum, and communications — all in one place. No WhatsApp groups, no spreadsheets."

---

## 2. TEACHER PORTAL (10 min)

**Login as Teacher: 9800000003**

### What to show:

**Auto-load on login**
- Oakie automatically loads today's plan the moment the teacher logs in
- Show the chat: "Oakie says" with today's full structured plan
- Point out: Circle Time is ALWAYS first — welcome, prayer, morning meet
- Then English Speaking → English → Math → GK

**Left panel — Today's Topics**
- Show the collapsible checklist: 5 topics for today
- Each topic has an "Ask" button
- Tap "Ask" next to Math → Oakie explains how to conduct the Math activity
- Show the 🔥 streak badge in the header: "7-day streak — gamification keeps teachers consistent"

**Mark completion**
- Tick 3 topics as done
- Show the "3 done, 2 carry forward" message
- Tap "Submit" — parents are notified instantly

**Homework & Notes page**
- Tap "Homework & Notes" button in the Plan tab
- Show today's homework already sent: "Practice writing A and B, count 10 objects, draw family"
- Go to Tracking tab — show yesterday's submissions:
  - Aarav ✓, Ananya ✓, Dev ✓ (completed)
  - Rohan ½, Sia ½ (partial)
  - Priya ✗ (not submitted — she was absent)
- Go to Notes tab — show the class note sent to parents

**Child Journey**
- Tap "Child Journey" button
- Show Aarav's highlight entry: "Recited alphabet song without help!"
- Show Priya's daily entry, Rohan's weekly summary
- Point out: "Teacher writes 2 sentences, Oakie turns it into a warm parent-friendly narrative"

**Key talking point:**
> "The teacher's entire day — plan, completion, homework, notes, child observations — is managed in one app. Oakie does the heavy lifting. The teacher just teaches."

---

## 3. PARENT PORTAL (7 min)

**Login as Parent 1: 9800000004 (Rajesh — Aarav's dad)**

### What to show:

**Home tab**
- Aarav's profile card at the top — attendance status: Present ✓
- Progress card: shows curriculum coverage %
- Homework card: today's homework visible — "Practice writing A and B..."
- Child Journey card: "View Aarav's Journey" button

**Aarav's Journey**
- Tap "View Aarav's Journey"
- Show the highlight entry: beautiful narrative written by Oakie
- Point out the "by Oakie" badge
- "Parents love this — it's like a daily diary of their child's school life"

**Attendance tab**
- Show 10 days of attendance — all present for Aarav
- Attendance % shown

**Oakie chat tab**
- Type: "What did Aarav study today?"
- Oakie responds with today's topics
- Type: "How is Aarav doing in Math?"
- Oakie gives a personalised response based on curriculum coverage

**Messages tab**
- Show the 3-message thread with Ms. Kavitha
- "Teacher sent a message about Aarav's alphabet milestone"
- Show parent's reply and teacher's follow-up

**Notifications tab**
- Show unread notification: "Ms. Kavitha submitted today's completion — 5 topics covered"

**Now switch to Parent 2: 9800000005 (Suresh — Priya + Rohan)**
- Show the child switcher at the top — two children
- Switch between Priya and Rohan
- Show Priya's attendance: 2 absences in the last 10 days
- Show Rohan's weekly journey entry

**Key talking point:**
> "Parents get real-time visibility into their child's day — what was taught, homework, attendance, and personal observations. No more 'what did you do in school today?' going unanswered."

---

## 4. PRINCIPAL PORTAL (3 min)

**Login as Principal: 9800000002**

### What to show:

**Dashboard**
- School-wide overview: all sections, completion rates
- "UKG-A: 4 of 5 days completed this week"

**Teachers view**
- Show Ms. Kavitha's streak: 7 days
- Coverage rate for UKG-A

**Coverage report**
- Show which topics have been covered vs pending
- "The principal can see in real time if any class is falling behind"

**Key talking point:**
> "The principal has a live dashboard — no more waiting for weekly reports. If a teacher hasn't submitted completion, the principal sees it immediately."

---

## Key Numbers to Mention

- **Setup time**: A new school is live in under 30 minutes
- **Teacher time saved**: ~45 minutes/day on planning and parent communication
- **Parent engagement**: Parents check the app 2-3x per day on average
- **Zero WhatsApp**: All communication is in-app, logged, and searchable

---

## Backup talking points if questions come up

**"How does the AI know what to teach?"**
> The admin uploads the school's curriculum PDF. Oakie reads it, chunks it by topic, and automatically distributes it across the academic year. The teacher never has to plan manually.

**"What if there's no internet?"**
> The Raw Plan button shows the full day's curriculum from the database — no AI needed. Teachers can work offline and sync later.

**"How is this different from a WhatsApp group?"**
> Everything is structured, searchable, and role-based. Parents only see their child's data. Teachers can't accidentally send to the wrong group. The principal has audit logs of everything.

**"What about data privacy?"**
> All data is school-scoped. Parents only see their own child. Teachers only see their section. The principal sees their school. Super admin sees nothing without explicit access.
