# Oakit.ai — Complete User Guide

**Version:** 2.0 | **School Platform for Early Childhood Education**

---

## What is Oakit.ai?

Oakit.ai is an AI-powered school management platform for preschools and primary schools. It connects five groups — **Admins**, **Teachers**, **Principals**, **Parents**, and **Students** — through a single platform that manages curriculum, attendance, daily planning, homework tracking, quizzes, and communication.

---

## How to Log In

**Staff, Teachers, Principals, Parents:**
1. Go to your school's Oakit URL
2. Enter your **School Code** (e.g. `sojs`)
3. Enter your **10-digit mobile number**
4. Enter your **password** (first-time: password = your mobile number)
5. On first login you will be asked to change your password

**Students:**
1. Go to `/student/login` (or click "🎒 Student? Log in here" on the main login page)
2. Enter your **School Code**
3. Enter your **username** (e.g. `aarav-lkg-a`)
4. Enter your **password** (default: `123456`)
5. On first login you must set a new password

> **Forgot password?** Use the "Forgot?" link and answer your security question. If you haven't set one, ask your admin to reset your password.

---

---

# ADMIN PORTAL

The Admin is the school's system manager. They set up and manage everything.

---

## Dashboard

The first screen after login shows a live snapshot of the school:

- **Total Students** — active enrolled students
- **Present Today** — students marked present today
- **Attendance Submitted** — sections that have submitted attendance
- **Plans Completed** — sections that have completed today's plan

**Curriculum Coverage Chart** — click any section bar to see a full breakdown of covered vs pending topics.

**Attendance Trend** — 30-day graph showing present, absent, and late counts.

**Safety Alerts** — if any user sends inappropriate content to Oakie AI, a red alert banner appears here with the person's name, role, and exact query. Dismiss individually or all at once.

---

## Setup Wizard (New Schools)

A guided checklist for first-time setup:

1. School Profile — name, contact details, logo, brand color
2. Classes & Sections — create your class structure
3. Staff Accounts — add teachers and other staff
4. Curriculum Upload — upload curriculum PDFs
5. Calendar Setup — set academic year and holidays

The dashboard shows a progress bar until all steps are complete.

---

## Users & Roles

### Adding Staff Accounts

1. Go to **Users & Roles**
2. Click **+ Add User**
3. Enter name, mobile number, and role
4. The user's initial password is their mobile number — they must change it on first login

### Resetting a Password

- Click **Reset Password** next to any user
- Their password resets to their mobile number
- They must change it on next login

### Roles

| Role | Portal Access |
|---|---|
| admin | Admin Portal (full access) |
| teacher | Teacher Portal |
| principal | Principal Portal |
| parent | Parent Portal (auto-assigned) |

**Custom Roles** — create roles like "Coordinator", "Vice Principal", "Accountant":
1. Users & Roles → Roles tab → Create Role
2. Use a **Quick Preset** to auto-fill settings
3. Set **Portal Access** — which portal this role lands on
4. Set **Permissions** — what the role can see and do

---

## Classes

1. Go to **Classes**
2. Click **+ Add Class** — enter class name (e.g. Play Group, LKG, UKG)
3. Click **+ Add Section** within a class — enter section label (A, B, C)
4. Click **Assign Class Teacher** — assign a teacher as the primary teacher for a section
5. Click **Supporting Teachers** — add additional teachers to a section

> A teacher can be class teacher of only one section but can support multiple sections.

---

## Students

### How to Onboard Students

**Option 1 — Add individually:**
1. Go to **Students**
2. Click **+ Add**
3. Enter student name, class, section
4. Enter father name, father mobile, mother name, mother mobile (optional)
5. Click **Add Student**

**Option 2 — Bulk import from Excel:**
1. Go to **Students** → **Import**
2. Click **↓ Download template** to get the correct format
3. Fill in the template: student name, class, section, father name, mother name, parent contact, mother contact
4. Upload the completed file
5. Review the import summary — created count and any skipped rows with reasons

**Rules:**
- Father and mother cannot share the same mobile number
- Mobile numbers must be 10 digits
- Blank mobile is allowed

### Managing Students

- **Edit** — update parent/guardian contact details
- **Upload Photo** — click the camera icon on the student avatar (JPEG/PNG, max 5MB)
- **Terminate** — soft-deletes the student (data preserved, login disabled)
- **Reactivate** — restores a terminated student
- **Show Terminated** — checkbox to view terminated students

> When a student is terminated, their student portal login and any parent accounts linked only to that student are automatically deactivated.

### Activating Parent Accounts

Expand the **👨‍👩‍👧 Parents** panel on any student:

1. Click **Add Account** next to Father or Mother
2. Confirm the mobile number
3. The parent account is created with password = mobile number
4. Parent must change password on first login

**Replacing a parent:** If you activate a new father account, the old father account is automatically unlinked from this student.

**Reset parent password:** Click **↺ Reset password** next to any linked parent account.

**Add guardian / link sibling's parent:** Use the "Add Another Parent / Guardian" section to link a different mobile number. If the same mobile is used for two students, that parent sees both children in their portal.

---

## Curriculum

### How to Upload Curriculum

1. Go to **Curriculum**
2. Select the class
3. Click **Upload PDF**
4. Choose your curriculum PDF file
5. Set the **start page** (if the curriculum doesn't start on page 1)
6. Click **Preview** — the AI extracts Week 1 for you to verify
7. Review the preview — check that topics and subjects look correct
8. Click **Approve & Ingest** — the AI processes the full document
9. Wait for ingestion to complete (usually 1–3 minutes)

> The AI reads structured curriculum tables and day-by-day plans. Supported format: PDF.

---

## Textbook Planner

The Textbook Planner generates a complete day-by-day academic planner from your textbook PDFs. It uses AI to read the Table of Contents, then distributes topics across the academic year based on your school's calendar, working days, and subject time allocations.

### When to Use It

Use the Textbook Planner when your school has textbooks but no pre-made weekly curriculum planner. Once confirmed, the generated planner feeds directly into the curriculum pipeline — teachers see their daily plans exactly as if you had uploaded a curriculum PDF.

### Step 1 — Start a Session

1. Go to **Textbook Planner** in the admin menu
2. Select the **Class** you want to plan for
3. The **Academic Year** is auto-detected from your school calendar — if it shows "No academic year configured", set up your calendar first
4. Click **Start / Resume Session** — if a session already exists for this class and year, it resumes from where you left off

### Step 2 — Subject Setup

For each subject in the class:

1. Click **Add Subject** and enter the subject name (e.g. Mathematics, English)
2. Set the **TOC Start Page** — the page number in the PDF where the Table of Contents begins
3. If the TOC spans multiple pages, set the **End Page** as well
4. Click **Upload PDF** — the AI reads the TOC page(s) and extracts all chapters and topics automatically

**What the AI extracts:**
- Chapter/unit titles
- Sub-topics listed under each chapter (with their page numbers if shown)
- Page ranges for each chapter (used to calculate how much time to allocate)

**If extraction fails:**
- Try a different TOC page number and re-upload the same PDF
- Use **📊 Import Excel** to upload chapters from a spreadsheet instead (see template below)
- Or click **+ Add chapters manually** to enter them one by one

**Excel import template columns:**

| Chapter Title | Topics | Page Start | Page End |
|---|---|---|---|
| Alphabet tree | | 3 | 3 |
| Letters A – D | A, B, C, D | 4 | 11 |
| Activities | | 12 | 13 |

- Topics column: comma-separated, optional
- Page Start / Page End: optional but improves time allocation accuracy

**Editing extracted chapters:**
- Click **Edit** on any chapter to change the title, topics, or page numbers
- Click **✕** to delete a chapter
- Click **+ Add chapter manually** to add a missing chapter

**If the TOC has more pages:**
After a successful extraction, you can add more TOC pages using the **+ Add next TOC page** option that appears below the chapter list.

### Step 3 — School Parameters

Configure your school's daily schedule so the planner knows how much teaching time is available each day:

- **School Start / End Time** — the school day boundaries
- **Lunch Break** — start and end time
- **Snack Break** — optional
- **Sports (minutes/week)** — weekly PE/sports allocation
- **Daily Activities** — assembly, library, etc. with their daily duration in minutes

Click **Save Parameters** — the system calculates and shows the **available teaching minutes per day** after subtracting all non-teaching time.

> If non-teaching time equals or exceeds the school day, you'll see a validation error. Adjust your timings.

### Step 4 — Subject Allocation

Set how many hours per week each subject gets:

- Enter weekly hours for each subject
- The utilisation bar shows total hours vs available teaching time
- **Red bar** — over-allocated (reduce hours)
- **Amber bar** — under-allocated (less than 80% utilised)
- **Green bar** — well-balanced

Click **Save Allocations**.

### Step 5 — Test Configuration

Choose how tests are scheduled in the planner:

| Mode | What it does |
|---|---|
| End of Chapter | Inserts a test day after each chapter completes |
| Every N Weeks | Inserts a test every N weeks from the year start |
| Specific Dates | You pick the exact test dates |
| Manual | No automatic tests — you mark exam days during review |

- **Test Duration** — number of class periods (1–5)
- **Add revision day before each test** — automatically inserts a revision day before every exam day

Click **Save Test Config**.

### Step 6 — Generate & Preview

1. Click **🚀 Generate Planner** — the AI distributes all topics across teaching days for the full academic year
2. The preview shows a week-by-week calendar with each day's subject, chapter, topic, and duration
3. Use **← Prev** / **Next →** to navigate weeks
4. Click **Edit** on any entry to change the subject, chapter, topic, or duration for that day
5. Edited entries are marked with a blue "edited" badge

**Re-generate:** If you change school parameters or the calendar, click **🔄 Re-generate** to rebuild the planner. Manual edits on surviving teaching days are preserved.

**Revert:** Click **↩ Revert** to discard all manual edits and go back to the last generated version.

### Step 7 — Confirm & Push

When you're happy with the planner:

1. Click **✅ Confirm & Push**
2. The planner is converted into curriculum chunks and pushed to the curriculum pipeline
3. Teachers start seeing their daily plans immediately
4. A success summary shows how many chunks were created and how many sections were processed

> Once confirmed, the session is locked. To make changes, you would need to re-generate and confirm again.

### Coverage Summary

After confirmation, a **Coverage Summary** panel appears showing:
- Per-subject progress bars (chapters covered vs total)
- Elapsed year percentage vs curriculum coverage percentage
- **⚠ Pacing alert** — shown if curriculum coverage falls more than 15% behind the elapsed year

### Calendar Changes

If you add or remove holidays after generating the planner, a **⚠ Calendar changed** banner appears. Click **Re-generate** to update the planner to reflect the new calendar.

---

## Supplementary Activities

Create activity pools that get added to day plans:

1. Go to **Supplementary Activities**
2. Click **+ Create Pool** — name it (e.g. "Rhymes", "Art Activities", "Stories")
3. Add individual activities with title and description
4. Click **Assign to Class** — link the pool to a class

Activities from assigned pools appear in the teacher's daily plan.

---

## Calendar

### Setting Up the Academic Year

1. Go to **Calendar**
2. Set **Start Date** and **End Date**
3. Select **Working Days** (Mon–Fri is default)
4. Click **Save**

### Adding Holidays

- **Add Holiday** — enter date and event name
- **Import Holidays** — bulk import from Excel (columns: date, event name, type)

### Special Days

Mark days as:
- **Settling Day** — first days of school (AI generates settling activities)
- **Revision Day** — revision activities
- **Exam Day** — exam activities
- **Event** — custom school events

---

## Plans

### How to Generate Plans

1. Go to **Plans**
2. Select **Class** and **Section**
3. Select **Month** and **Year**
4. Click **Generate Plans**
5. The AI distributes curriculum topics across working days for that month

### Viewing and Editing Plans

- Click any day to see the topics assigned
- **Edit Label** — override a topic label for a specific day
- **Add Admin Note** — attach a note visible to the teacher for that day
- **Export PDF** — download the monthly plan as a PDF

---

## Student Portal Configuration

### How to Enable the Student Portal for a Class

1. Go to **Settings** → scroll to **🎓 Student Portal**
2. Toggle on the classes you want to enable
3. Students in enabled classes can now log in at `/student/login`

### How to Generate Student Logins

**Bulk (all students in a section):**
1. Go to **Settings** → **🔑 Bulk Generate Student Logins**
2. Select a section from the dropdown
3. The list shows students without accounts
4. Click **⚡ Generate** — usernames and passwords are created for all
5. Copy the credentials and share with students

**Individual (per student):**
1. Go to **Students**
2. Find the student (portal-enabled classes show a login button)
3. Click **🔑 Generate login** — username and default password appear inline
4. Click **↺ Reset password** to reset to `123456` at any time

**Username format:** `firstname-classname-section` (e.g. `aarav-lkg-a`)
**Default password:** `123456` (student must change on first login)

---

## Reports

Go to **Reports** to access three report types:

### Student Report
1. Select class → section → student
2. Click **Generate Report**
3. Shows: attendance %, curriculum coverage %, milestones achieved, shared observations

### School Summary Report
- Click **Generate School Report**
- Shows: overall attendance %, overall coverage %, per-section breakdown

### Quizzes & Tests
- Click the **📋 Quizzes & Tests** tab
- See all quizzes created by teachers and students across the school
- Each quiz shows: subject, class/section, creator, question count, attempt count, average score
- Click **View results** to see per-student scores for any quiz

---

## Announcements

1. Go to **Announcements**
2. Click **+ New Announcement**
3. Enter title and body
4. Select audience: **Teachers only**, **Parents only**, or **All**
5. Click **Post**

Announcements appear in the teacher's portal and parent's Updates tab.

---

## Audit Log

A complete record of all platform activity:

### AI Queries tab
- Every Oakie AI question logged with user name, role, and outcome
- Outcomes: Allowed, Off-topic (blocked), Inappropriate (blocked + alert), Limit reached
- Filter by outcome to find inappropriate queries
- Select and delete entries you no longer need

### Uploads tab
- Every file upload with uploader name, file name, and expiry date

### Messages tab
- All parent-teacher messages with content, read status, and timestamps

---

## Settings

### School Profile
- School name, contact email, phone, address

### Branding
- **Logo** — JPEG, PNG, SVG or WebP (max 2MB, recommended 200×200px)
- **Tagline** — appears on the login page and sidebar
- **Brand Color** — applies to all portal headers immediately

### App Settings
- **Teacher Notes Expiry** — days before notes auto-delete (default 14)

---

---

# TEACHER PORTAL

Teachers use Oakit daily to plan, teach, communicate, and track homework.

---

## Home Screen — Oakie Chat

The main screen opens with Oakie AI showing today's plan automatically.

**Tabs:** Plan | Chat | Help

---

## Today's Plan (Plan Tab)

Shows all activities for today with checkboxes:

- **Tick activities** as you complete them
- Unticked activities automatically carry forward to tomorrow
- **Ask** button next to each activity — asks Oakie how to conduct it
- **Export PDF** — download today's plan as a PDF

### Marking Completion

After teaching:
1. Tick the activities you completed
2. Unticked activities carry forward automatically
3. Click **Submit** — parents are notified

> You must mark yesterday's completion before today's plan is shown. This keeps the curriculum on track.

---

## Oakie AI Chat

Ask Oakie anything about your class:

- "What is my plan for today?"
- "How do I conduct English Speaking today?"
- "What did I cover from June 1 to June 15?" ← generates a parent-teacher meeting summary
- "A child is crying — what do I do?"
- "Give me a quick activity for fast finishers"
- "Am I on track with the curriculum?"
- "What was my plan for last Monday?" ← shows what was actually completed that day

**Question limit:** 5 activity questions per day. Resets when you mark completion. Progress and plan queries are unlimited.

### Date Range Summary (Parent-Teacher Meeting)

Ask: *"What did I cover from June 1 to June 15?"*

Oakie generates a formatted summary showing:
- Overview of the period
- All subjects covered with activities
- Subject frequency breakdown
- Ready to share at parent-teacher meetings

---

## Attendance

1. Go to **Attendance** tab
2. Mark each student: **Present**, **Absent**, or **Late**
3. Record arrival time for late students
4. Click **Submit**

Parents of absent students are notified automatically.

---

## Homework & Notes

Expand the **📝 Homework & Notes for Parents** panel in the Plan tab:

### Posting Homework
1. Type today's homework in plain text
2. Click **Send Homework to Parents**
3. Oakie AI formats it into a clean parent-friendly message
4. Parents see it in their Home tab immediately

### Tracking Homework Completion
After posting homework, a student list appears:
1. For each student, tap: **✓** (completed), **½** (partial), or **✗** (not submitted)
2. Click **Save Homework Status**
3. Parents can see their child's homework status in the Progress tab
4. Parents can ask Oakie: "What homework did my child miss?"

### Class Notes / Attachments
1. Type a note or attach a file (PDF, Word, text — max 10MB)
2. Click **Send Note to Parents**
3. Notes auto-delete after the school's configured expiry period
4. Parents are warned when notes are close to expiry

---

## Messages

- See all message threads with parents
- Unread messages are highlighted with a badge
- Reply to parent messages
- Parents can also initiate conversations

---

## Student Accounts (Portal-Enabled Classes)

If the student portal is enabled for your class:

1. Go to **Students** tab
2. Each student shows their portal username (if generated) or a **🔑 Generate login** button
3. Click **Generate login** to create credentials for a student
4. Click **↺ Reset password** to reset to `123456`

---

## Assign a Test to Students

1. Go to the **Quiz** section in the teacher portal
2. Click **Assign Test**
3. Select subject and date range → see the list of covered topics
4. Edit the topic list (add or remove topics)
5. Confirm the topic list
6. Select question types (fill-in-blank, 1-mark, 2-mark, descriptive)
7. Set time limit (15, 30, or 60 minutes) and due date
8. Click **Generate** — questions are created from the confirmed topics
9. Review the questions
10. Click **Activate** — students are notified and can take the test

> Students cannot use Oakie AI during an assigned test.

---

## View Test Results

1. Go to **Reports** → **Quizzes & Tests** (admin view)
2. Or ask Oakie: "How did my students do on the last test?"

The analytics show per-student scores, average, and weak areas.

---

## Resources

A shared library of teaching materials:

- **Upload** — share PDFs and images with other teachers
- **Tag** by subject and class level
- **Save** — bookmark resources you use frequently
- **Download** — access saved resources

---

## Observations

Record observations about individual students:

1. Select a student
2. Choose a category: Behaviour, Social Skills, Academic Progress, Motor Skills, Language
3. Write your observation
4. Toggle **Share with parent** to make it visible in the parent portal

---

## Milestones

Track developmental milestones:

1. Select a student
2. View the milestone checklist for your class level
3. Mark milestones as achieved with a date
4. Parents see achieved milestones in their portal

---

## Teaching Streak

The 🔥 badge in the header shows your teaching streak — consecutive days you've submitted completion.

- Tap the badge to see your current streak, best streak, and badge name
- Badges awarded at 5, 10, 20, 30 day milestones

---

---

# PRINCIPAL PORTAL

The Principal gets a school-wide view without managing individual settings.

---

## Dashboard

- **Summary cards** — total students, present today, absent today, attendance submitted
- **Section cards** — each class and section with teacher name, student count, attendance status
- **Safety Alerts** — inappropriate AI queries flagged here with person's name and query

---

## Oakie AI Chat

Ask school-wide questions:

- "Which sections are lagging behind in curriculum?"
- "Who hasn't submitted attendance today?"
- "What is the overall curriculum progress?"
- "Which sections have completed today's plan?"

---

## Attendance

View attendance across all sections for any date.

---

## Teachers

See teacher activity:
- Which teachers submitted completion today
- Streak information
- Engagement metrics

---

## Coverage

Curriculum coverage report across all sections — which are on track, which are behind.

---

---

# PARENT PORTAL

Parents get a daily update on their child's school day.

---

## Home Tab

A dashboard showing:

- **Child profile card** — photo, name, class, today's attendance badge
- **Attendance** — today's status (Present / Absent / Late with arrival time)
- **Progress** — curriculum coverage percentage
- **Homework** — today's homework from the teacher
- **Today's Learning** — topics covered in class today
- **Teacher Notes** — notes and attachments (with expiry warning)
- **Announcements** — school-wide announcements

### Updating Child Photo
- Tap the photo to preview full-screen
- Hover/tap the camera icon to upload a new photo (JPEG/PNG, max 5MB)

---

## Attendance Tab

Full attendance history for the last 60 days:
- Calendar view: green = present, red = absent, amber = late
- Attendance % and punctuality %
- Stats: total days, present, absent, late, on-time

---

## Progress Tab

- **Curriculum coverage** — percentage of topics covered
- **Milestones** — developmental milestones achieved
- **Homework History** — last 30 days of homework with completion status per assignment
  - ✓ Completed, ½ Partial, ✗ Not submitted
  - Shows the homework text and any teacher notes

---

## Oakie Tab (AI Chat)

Ask Oakie about your child:

- "How is Aarav's attendance this month?"
- "What did my child study today?"
- "Is there any homework today?"
- "What homework did my child miss?" ← shows all incomplete/partial homework
- "How is the curriculum progress?"

> Oakie only answers questions about your child's school activities.

---

## Messages Tab

Direct messaging with your child's teacher:
- See all message threads
- Start a new conversation
- Reply to teacher messages
- Unread messages are highlighted

---

## Notifications / Updates Tab

- Completion notifications — when the teacher marks today's plan as done
- Absence alerts — when your child is marked absent

---

## Multiple Children

If you have more than one child at the school:
- A child switcher appears at the top (mobile) or in the sidebar (desktop)
- Tap a child's name to switch between children

---

## Test Analytics (Student Portal)

If your child's class has the Student Portal enabled, the Progress tab also shows:
- Total quizzes taken
- Average score
- Subject breakdown with weak areas highlighted
- Full quiz history with scores

---

---

# STUDENT PORTAL

Students log in to review their learning, ask questions, and take quizzes.

---

## How to Log In

1. Go to `/student/login` (or click "🎒 Student? Log in here" on the main login page)
2. Enter **School Code** (e.g. `sojs`)
3. Enter your **username** (e.g. `aarav-lkg-a`) — given to you by your teacher or admin
4. Enter your **password** (default: `123456`)
5. On first login, you must set a new password (minimum 6 characters)

---

## Today Tab

Shows what was covered in class today:

- Topics grouped by subject
- Today's homework
- Teacher notes

### Navigating Dates

- Use the **← →** arrows to go to previous or future dates
- You can go back to any past date
- You can go up to **5 school days ahead** to see upcoming topics
- Dates beyond 5 days ahead show: "Topics for this date are not yet available"

---

## Homework Tab

Shows the last 30 days of homework with your completion status:

- ✓ **Completed** — you submitted the homework
- ½ **Partial** — you partially completed it
- ✗ **Not Submitted** — homework was not submitted

---

## Ask Oakie Tab

Ask questions about topics your class has covered:

- "What is a vowel sound?"
- "Can you explain what we did in Circle Time?"
- "Tell me more about the number 10"

> **Important:** Oakie can only answer questions about topics your class has already covered. If you ask about something not yet covered, Oakie will suggest relevant covered topics instead.

> Oakie is disabled during an assigned test.

---

## Quiz Tab

### Taking a Self-Practice Test

1. Click **Self Test**
2. Select a **subject** (e.g. Mathematics)
3. Set a **date range** — the topics covered in that period are shown
4. Review and edit the topic list (add or remove topics)
5. Confirm the topics
6. Select **question types**: Fill in the Blank, 1 Mark, 2 Mark, Descriptive
7. Click **Generate Quiz**
8. Answer all questions
9. Click **Submit**
10. See your results with correct answers and explanations

### Taking an Assigned Test

When your teacher assigns a test:
1. It appears in the **Assigned Tests** section
2. Click **Start** to begin
3. A countdown timer shows the remaining time
4. Answer all questions before time runs out
5. The test auto-submits when time expires

> You cannot use Oakie AI or navigate away during an assigned test.

### After a Quiz

- See your score (e.g. 8/10 — 80%)
- See correct answers and explanations for wrong answers
- If you scored below 50% in a subject, Oakie suggests: "You may want to revise [subject]. Tap to review covered topics."

---

## My Progress Tab

After completing at least one quiz:

- **Total quizzes taken**
- **Average score**
- **Subject breakdown** — score per subject with a progress bar
- **Needs Revision** — subjects where your average is below 50%
- **Recent quizzes** — history of all quizzes with scores

---

---

# SECURITY & SAFETY

## Password Policy
- First login: password = mobile number (staff/parents) or `123456` (students)
- Must change on first login
- New password cannot be the same as your mobile number
- Minimum 6 characters

## AI Safety
- Oakie only answers school-related questions
- Inappropriate content is automatically blocked
- Prompt injection attempts are detected and blocked
- All blocked queries are logged and reported to Principal and Admin immediately
- The person who asked is shown by name in the safety alert

## Data Privacy
- All data is scoped to your school — no data is shared between schools
- File attachments auto-delete after the configured expiry period
- Parents can only see their own children's data
- Students can only see their own class's covered topics

---

# HOW-TO QUICK REFERENCE

## Admin Quick Steps

| Task | Where |
|---|---|
| Add a student | Students → + Add |
| Bulk import students | Students → Import |
| Activate parent login | Students → expand student → Parents → Add Account |
| Upload curriculum | Curriculum → Upload PDF |
| Generate monthly plans | Plans → Generate Plans |
| **Generate textbook planner** | **Textbook Planner → Start Session** |
| Enable student portal | Settings → Student Portal → toggle class |
| Generate student logins (bulk) | Settings → Bulk Generate Student Logins |
| Generate student login (individual) | Students → find student → 🔑 Generate login |
| Add a holiday | Calendar → Add Holiday |
| Post announcement | Announcements → + New |
| View quiz results | Reports → Quizzes & Tests |
| Reset staff password | Users & Roles → Reset Password |
| View AI safety alerts | Dashboard → Safety Alerts or Audit Log |

## Teacher Quick Steps

| Task | Where |
|---|---|
| See today's plan | Plan tab (auto-loads on login) |
| Mark activities done | Plan tab → tick checkboxes → Submit |
| Ask Oakie for help | Chat tab |
| Mark attendance | Attendance tab |
| Post homework | Plan tab → Homework & Notes → type → Send |
| Track homework completion | Plan tab → Homework & Notes → tick per student |
| Send a note to parents | Plan tab → Homework & Notes → Notes section |
| Message a parent | Messages tab |
| Record observation | Observations tab |
| Mark milestone | Milestones tab |
| Assign a test | Quiz section → Assign Test |
| Generate student login | Students tab → 🔑 Generate login |
| Get date range summary | Chat → "What did I cover from [date] to [date]?" |

## Parent Quick Steps

| Task | Where |
|---|---|
| See today's topics | Home tab → Today's Learning |
| Check attendance | Attendance tab |
| See homework | Home tab → Homework card |
| Check missed homework | Progress tab → Homework History |
| Ask Oakie | Oakie tab |
| Message teacher | Messages tab |
| See quiz scores | Progress tab → Test Analytics |
| Update child photo | Home tab → tap photo → camera icon |

## Student Quick Steps

| Task | Where |
|---|---|
| See today's topics | Today tab |
| Check homework | Homework tab |
| Ask a question about a topic | Ask Oakie tab |
| Take a practice test | Quiz tab → Self Test |
| Take an assigned test | Quiz tab → Assigned Tests |
| See my scores | My Progress tab |

---

# FREQUENTLY ASKED QUESTIONS

**Q: I forgot my password. What do I do?**
A: Click "Forgot?" on the login page and answer your security question. If you haven't set one, ask your admin to reset your password.

**Q: My child's photo isn't showing.**
A: The photo may not have been uploaded yet. Parents can upload it from the Home tab. Admins can upload it from the Students page.

**Q: The teacher marked attendance but I didn't get a notification.**
A: Notifications appear in the Updates tab. Make sure you're checking the correct child if you have multiple children.

**Q: I can see "No plan generated" for today.**
A: The admin needs to generate plans for the current month. Ask your admin to go to Plans → Generate Plans for your class.

**Q: Oakie says "I can only help with school-related questions."**
A: Oakie is restricted to school topics only. Ask about attendance, homework, topics covered, or curriculum progress.

**Q: I asked something and got a warning that it was reported to management.**
A: Oakie detected your query as inappropriate or an attempt to bypass its restrictions. This is logged and visible to the school's admin and principal.

**Q: How do I link my child's sibling to my account?**
A: Ask your admin to activate a parent account for the sibling using the same mobile number. You'll then see both children in your portal.

**Q: The student portal login isn't working.**
A: Check that (1) the student portal is enabled for the student's class in Admin → Settings, (2) a login has been generated for the student, and (3) the student is using `/student/login` not the main login page.

**Q: A student forgot their portal password.**
A: Go to Students → find the student → click **↺ Reset password**. Their password resets to `123456`.

**Q: The quiz isn't showing topics.**
A: The teacher needs to mark completion for the days in the selected date range. Topics only appear after the teacher logs what was covered.

**Q: Can a student use Oakie during a test?**
A: No. Oakie is automatically disabled during assigned tests. Students can use it freely for self-practice tests.

---

*Oakit.ai — Built for schools that care about every child's journey.*
