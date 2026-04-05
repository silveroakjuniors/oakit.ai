# Oakit.ai — Complete User Guide

**Version:** 1.0 | **School Platform for Early Childhood Education**

---

## What is Oakit.ai?

Oakit.ai is an AI-powered school management platform designed for preschools and primary schools. It connects four groups of people — **Admins**, **Teachers**, **Principals**, and **Parents** — through a single platform that manages curriculum, attendance, communication, and daily planning.

---

## How to Log In

1. Open your browser and go to your school's Oakit URL
2. Enter your **School Code** (e.g. `sojs`)
3. Enter your **10-digit mobile number**
4. Enter your **password** (first-time users: password = your mobile number)
5. On first login you will be asked to change your password

> **Forgot password?** Use the "Forgot?" link on the login page and answer your security question.

---

---

# ADMIN PORTAL

The Admin is the school's system manager. They set up and manage everything.

---

## Dashboard

The first screen after login shows a live snapshot of the school:

- **Total Students** — how many active students are enrolled
- **Present Today** — students marked present today
- **Attendance Submitted** — how many sections have submitted attendance
- **Plans Completed** — how many sections have completed today's plan

**Curriculum Coverage Chart** — click any section bar to see a full breakdown of which topics have been covered and which are pending, grouped by curriculum document.

**Attendance Trend** — a 30-day graph showing present, absent, and late counts.

**Safety Alerts** — if any user asks inappropriate content to Oakie AI, a red alert banner appears here with the person's name, role, and exact query. You can dismiss individual alerts or all at once.

---

## Users & Roles

### Managing Staff Accounts

- **Add User** — create a staff account with name, mobile, and role. Initial password = mobile number. User must change it on first login.
- **Change Role** — click the role badge next to any user to reassign their role
- **Reset Password** — resets the user's password back to their mobile number
- **Deactivate** — disables the account (user cannot log in)

### Roles

Roles control which portal a user can access and what they can do.

**Built-in roles:**
- `admin` → Admin Portal (full access)
- `teacher` → Teacher Portal
- `principal` → Principal Portal
- `parent` → Parent Portal (auto-assigned)

**Custom roles** — you can create roles like "Accountant", "Coordinator", "Vice Principal":
1. Go to Users & Roles → Roles tab → Create Role
2. Use a **Quick Preset** (Accountant, Center Head, Coordinator, Vice Principal) to auto-fill settings
3. Set **Portal Access** — which portal this role lands on after login
4. Set **Permissions** — what the role can see and do

**Permission groups:**
- Full Access: `read:all`, `write:all`
- Manage: users, classes, curriculum, calendar, students, plans, activities, settings, announcements
- Reports: dashboard, reports, students
- Teacher: own plan, coverage log, attendance, AI, notes, observations, milestones, messages
- Principal/Management: all sections, coverage, teacher activity, audit log

---

## Classes

- **Create Class** — add a class (e.g. Play Group, Nursery, LKG, UKG)
- **Add Section** — add sections A, B, C within a class
- **Assign Class Teacher** — assign a teacher as the class teacher for a section
- **Assign Supporting Teachers** — add additional teachers to a section

> A teacher can only be class teacher of one section but can support multiple sections.

---

## Students

### Adding Students

- **+ Add** — add a single student with name, class, section, father name, mother name, father mobile, mother mobile
- **Import** — bulk import from Excel (.xlsx). Download the template first.
  - Required columns: student name, class, section
  - Optional: father name, mother name, parent contact, mother contact

### Student Rules
- Father and mother cannot have the same mobile number
- Mobile numbers must be 10 digits
- Blank mobile is allowed (single parent or number not available)

### Managing Students

- **Edit** — update parent/guardian details
- **Upload Photo** — click the camera icon on the student avatar. Supports JPEG and PNG up to 5MB.
- **Terminate** — soft-deletes the student (they disappear from active lists but data is preserved)
- **Reactivate** — restores a terminated student
- **Show Terminated** — checkbox to view terminated students

### Parent Accounts

Expand the **Parents** panel on any student to:

- See linked parent accounts with their status (Active / Must change password)
- **Activate** — create a parent login using the father or mother's mobile number
- **Reset** — reset a parent's password back to their mobile number
- **Add Account** — create a separate parent login for a different guardian

> If a parent account already exists with a different mobile than what's on file, the system shows a warning explaining the mismatch and gives you options.

> **Sibling linking:** If two students have a parent with the same mobile number, that parent automatically sees both children in their parent portal.

---

## Curriculum

- **Upload PDF** — upload the school's curriculum document for a class
- **Preview** — before full processing, preview Week 1 to verify the AI extracted it correctly
- **Approve & Ingest** — confirm the preview and let the AI process the full document
- The AI extracts topics, activities, and subject breakdowns from the PDF automatically

> Supported formats: PDF. The AI reads structured curriculum tables and day-by-day plans.

---

## Supplementary Activities

Create activity pools that get added to day plans:

- **Create Pool** — name a pool (e.g. "Rhymes", "Stories", "Art Activities")
- **Add Activities** — add individual activities with title and description
- **Assign to Class** — link a pool to a class so it appears in that class's plans

---

## Calendar

Set up the school's academic year:

- **Academic Year** — set start date, end date, and working days (Mon–Fri)
- **Holidays** — add individual holidays or import from Excel
- **Special Days** — mark days as Settling Day, Revision Day, Exam Day, or Event with a custom label
- **Import Holidays** — bulk import from Excel with date, event name, and type columns

---

## Plans

Generate and manage day-by-day teaching plans:

- **Generate Plans** — select a class, section, and month, then generate plans. The AI distributes curriculum chunks across working days.
- **View Plans** — see the full month calendar with topics for each day
- **Edit Plan** — override topic labels for specific days
- **Add Admin Note** — attach a note to a specific day (visible to the teacher)
- **Export PDF** — download the monthly plan as a PDF

---

## Reports

- **School Report** — overall coverage and attendance summary
- **Section Report** — coverage and attendance for a specific section
- **Student Report** — individual student report with attendance %, curriculum coverage %, milestones achieved, and shared observations

---

## Announcements

Post school-wide announcements visible to teachers, parents, or both:

- Set **audience**: Teachers only, Parents only, or All
- Announcements appear in the teacher's portal and parent's notifications tab

---

## Setup Wizard

A guided checklist for new schools:

1. School Profile — name, contact details
2. Classes & Sections — create your class structure
3. Staff Accounts — add teachers and other staff
4. Curriculum Upload — upload curriculum PDFs
5. Calendar Setup — set academic year and holidays

The dashboard shows a progress bar until all steps are complete.

---

## Settings

### School Profile
- School name (appears on reports and communications)
- School code (cannot be changed after setup)

### Contact Details
- Contact email, phone, address (used in reports and parent communications)

### Branding
- **School Logo** — upload JPEG, PNG, SVG or WebP (max 2MB, recommended 200×200px)
- **School Tagline** — appears under the logo on the login page and sidebar
- **Brand Color** — pick a color for headers and accents across all portals. Changes apply immediately.

### App Settings
- **Teacher Notes Expiry** — how many days teacher notes and file attachments are kept before auto-deletion (1–365 days, default 14)

---

## Audit Log

A complete record of all activity on the platform:

### AI Queries tab
- Every question asked to Oakie AI is logged with the user's name, role, and outcome
- **Outcomes:** Allowed, Off-topic (blocked), Inappropriate (blocked + alert sent), Limit reached
- **Filter** by outcome to quickly find inappropriate queries
- **Select and delete** log entries you no longer need
- Inappropriate queries are highlighted in red

### Uploads tab
- Every file upload (notes, photos, logos, resources) with uploader name, file name, and expiry date

### Messages tab
- All parent-teacher messages with full content, read status, and timestamps

---

---

# TEACHER PORTAL

Teachers use Oakit daily to plan, teach, and communicate.

---

## Home Screen — Oakie Chat

The main screen opens with Oakie AI showing today's plan automatically.

**Tabs:**
- **Plan** — today's activities with checkboxes
- **Chat** — ask Oakie anything about teaching
- **Help** — quick subject-specific help buttons

### Today's Plan

The Plan tab shows all activities for today:

- **Tick activities** as you complete them
- Unticked activities automatically carry forward to tomorrow
- **Ask** button next to each activity — asks Oakie how to conduct that specific activity
- **Export PDF** — download today's plan as a PDF

### Oakie AI Chat

Ask Oakie anything related to your class:

- "How do I conduct English Speaking today?"
- "What is my plan for tomorrow?"
- "A child is crying and not settling — what do I do?"
- "Give me a quick activity for fast finishers"
- "What topics have I covered this week?"

**Question limit:** 5 activity questions per day. Resets when you mark completion. Progress and plan queries are unlimited.

> Oakie only answers school-related questions. Off-topic and inappropriate queries are blocked and reported to management.

### Marking Completion

After teaching, mark what you covered:

1. Tick the activities you completed in the Plan tab
2. Unticked activities carry forward automatically
3. Parents are notified when you submit

---

## Attendance

- Mark each student as **Present**, **Absent**, or **Late**
- Record arrival time for late students
- Submit attendance — parents are notified of absent students

---

## Students

View all students in your assigned sections:

- See student photos, names, and class details
- Upload or update student photos (tap the camera icon)
- View student profiles

---

## Homework & Notes

Post homework and notes for parents:

### Homework
- Type today's homework in plain text
- Oakie AI formats it into a clean, parent-friendly message automatically
- Parents see it in their Home tab

### Notes / Attachments
- Post text notes for parents
- Attach files (PDF, Word, text — max 10MB)
- Files auto-delete after the school's configured expiry period (default 14 days)
- Parents are warned when notes are close to expiry

---

## Messages

Direct messaging with parents:

- See all message threads with parents
- Unread messages are highlighted
- Reply to parent messages
- Parents can also initiate conversations

---

## Resources

A shared library of teaching materials:

- **Upload** — share PDFs and images with other teachers
- **Tag by subject and class level** — makes resources easy to find
- **Save** — bookmark resources you use frequently
- **Download** — access saved resources

---

## Observations

Record observations about individual students:

- Select a student and category (Behaviour, Social Skills, Academic Progress, Motor Skills, Language)
- Write your observation
- **Share with parent** — toggle to make it visible in the parent portal

---

## Milestones

Track developmental milestones for each student:

- View the milestone checklist for your class level
- Mark milestones as achieved with a date
- Parents can see achieved milestones in their portal

---

## Streaks

Your teaching streak — consecutive days you've submitted completion:

- Current streak and best streak displayed
- Badges awarded at 5, 10, 20, 30 day milestones

---

## Worksheet Generator

Generate printable activity worksheets:

- Select subject and topic
- Oakie AI generates a differentiated worksheet with Simple, Standard, and Extended activities
- Print or download as PDF

---

---

# PRINCIPAL PORTAL

The Principal gets a school-wide view without managing individual settings.

---

## Dashboard

- **Summary cards** — total students, present today, absent today, attendance submitted/total sections
- **Section cards** — each class and section with teacher name, student count, attendance status, and attendance bar
- **Quick links** — Attendance, Teachers, Coverage

**Safety Alerts** — same red alert banner as admin. Inappropriate AI queries are flagged here too.

---

## Oakie AI Chat

Ask school-wide questions:

- "Which sections are lagging behind?"
- "Who hasn't submitted attendance today?"
- "What is the overall curriculum progress?"
- "Which sections are flagged?"

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

Curriculum coverage report across all sections — which sections are on track, which are behind.

---

---

# PARENT PORTAL

Parents get a daily update on their child's school day.

---

## Home Tab

A bento-grid dashboard showing:

- **Child profile card** — photo, name, class, today's attendance badge
- **Attendance** — today's status (Present / Absent / Late with arrival time)
- **Progress** — curriculum coverage percentage with a progress bar
- **Homework** — today's homework from the teacher
- **Today's Learning** — topics covered in class today
- **Teacher Notes** — notes and attachments from the teacher (with expiry warning)
- **Announcements** — school-wide announcements

### Child Photo
- Tap the photo to see a full-screen preview
- Tap and hold (or hover) to upload a new photo
- Supports JPEG and PNG up to 5MB

---

## Attendance Tab

Full attendance history for the last 60 days:

- Calendar view with colour-coded days (green = present, red = absent, amber = late)
- Attendance % and punctuality %
- Stats: total days, present, absent, late, on-time

---

## Progress Tab

Curriculum coverage for your child's class:

- Overall coverage percentage
- Whether curriculum has been uploaded for the class

---

## Oakie Tab (AI Chat)

Ask Oakie about your child:

- "How is Aarav's attendance this month?"
- "What did my child study today?"
- "Is there any homework today?"
- "How is the curriculum progress?"

> Oakie only answers questions about your child's school activities. Off-topic and inappropriate queries are blocked and reported to school management.

---

## Messages Tab

Direct messaging with your child's teacher:

- See all message threads
- Start a new conversation with the teacher
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
- Tap a child's name/photo to switch between children
- Each child's data is loaded separately

---

## Sibling Accounts

If two children share the same parent mobile number, that parent automatically sees both children in their portal — no separate login needed.

---

---

# SECURITY & SAFETY

## Password Policy
- First login: password = your mobile number
- You must change it on first login
- New password cannot be the same as your mobile number
- Minimum 6 characters

## AI Safety
- Oakie AI only answers school-related questions
- Inappropriate content (adult content, violence, drugs) is automatically blocked
- Prompt injection attempts ("ignore previous instructions") are detected and blocked
- All blocked queries are logged and reported to the Principal and Admin immediately
- The person who asked is shown by name in the safety alert

## Data Privacy
- All data is scoped to your school — no data is shared between schools
- File attachments (notes) are automatically deleted after the configured expiry period
- Parents can only see their own children's data

---

# FREQUENTLY ASKED QUESTIONS

**Q: I forgot my password. What do I do?**
A: Click "Forgot?" on the login page. You'll need to answer your security question. If you haven't set one, ask your admin to reset your password.

**Q: My child's photo isn't showing.**
A: The photo may not have been uploaded yet. Parents can upload it from the Home tab by tapping the photo area. Admins can also upload it from the Students page.

**Q: The teacher marked attendance but I didn't get a notification.**
A: Notifications appear in the Updates tab. Make sure you're checking the correct child if you have multiple children.

**Q: I can see "No plan generated" for today.**
A: The admin needs to generate plans for the current month. Ask your admin to go to Plans → Generate Plans for your class.

**Q: Oakie says "I can only help with school-related questions."**
A: Oakie is restricted to school topics only. Ask about your child's attendance, homework, topics covered, or curriculum progress.

**Q: I asked something and got a warning that it was reported to management.**
A: Oakie detected your query as inappropriate or an attempt to bypass its restrictions. This is logged and visible to the school's admin and principal.

**Q: How do I link my child's sibling to my account?**
A: Ask your admin to activate a parent account for the sibling using the same mobile number. You'll then see both children in your portal.

**Q: The brand color I set in Settings isn't showing.**
A: Make sure you ran migration 036 in Supabase first. The color applies to all portal headers immediately after saving.

---

*Oakit.ai — Built for schools that care about every child's journey.*
