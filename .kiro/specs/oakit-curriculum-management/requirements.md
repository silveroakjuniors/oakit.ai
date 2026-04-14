# Requirements Document

## Introduction

Oakit.ai is an AI-powered curriculum management platform for schools. Phase 1 focuses exclusively on curriculum management for Silveroak Juniors, with a multi-school architecture designed for future expansion. The platform ingests large unstructured PDF curricula (200–300 pages), chunks and indexes them, and provides role-based AI-assisted experiences for Admins, Principals, and Teachers. Teachers interact with a conversational AI daily planner, log their classroom activity in free text, and receive context-aware guidance on pending work and activity help. Principals get a real-time status view across all classes and teachers.

---

## Glossary

- **Platform**: The Oakit.ai curriculum management system
- **School**: A registered educational institution (e.g., Silveroak Juniors)
- **Admin**: A school-level administrator who manages users, classes, sections, and curriculum uploads
- **Principal**: A school leader who monitors curriculum progress across all classes and teachers
- **Teacher**: A staff member assigned to one or more sections who uses the daily planner
- **Class**: An academic year group (e.g., LKG, UKG, Prep1, Prep2)
- **Section**: A subdivision of a Class (e.g., LKG-A, LKG-B) with one or more Teachers assigned
- **Curriculum_Document**: A PDF file uploaded by an Admin representing the full curriculum for a Class
- **Curriculum_Chunk**: A semantically meaningful segment extracted from a Curriculum_Document by the Ingestion_Service
- **Day_Plan**: The set of Curriculum_Chunks scheduled for a Teacher's Section on a specific calendar date
- **Coverage_Log**: A free-text entry submitted by a Teacher describing what was taught in a session
- **AI_Assistant**: The conversational AI component that answers Teacher and Principal queries
- **Ingestion_Service**: The Python service responsible for parsing, chunking, and indexing Curriculum_Documents
- **Planner_Service**: The backend service that generates and manages Day_Plans
- **Coverage_Analyzer**: The AI component that maps Coverage_Logs to Curriculum_Chunks to determine completion status
- **Activity**: A specific teaching task or exercise referenced within a Curriculum_Chunk (e.g., a worksheet or book exercise)

---

## Requirements

### Requirement 1: Multi-School Architecture

**User Story:** As a Platform operator, I want each school to have an isolated data space, so that multiple schools can use the platform without data leakage between them.

#### Acceptance Criteria

1. THE Platform SHALL associate every School, Class, Section, Teacher, Curriculum_Document, Day_Plan, and Coverage_Log with a unique School identifier.
2. WHEN a user authenticates, THE Platform SHALL restrict all data access to the School associated with that user's account.
3. THE Admin SHALL be able to register a new School by providing a school name, subdomain, and contact details.
4. IF a request attempts to access data belonging to a different School, THEN THE Platform SHALL reject the request with an authorization error.

---

### Requirement 2: Role-Based Authentication and Access Control

**User Story:** As a school operator, I want distinct login roles for Admin, Principal, and Teacher, so that each user sees only the features and data relevant to their role.

#### Acceptance Criteria

1. THE Platform SHALL support three roles in Phase 1: Admin, Principal, and Teacher.
2. WHEN a user submits valid credentials, THE Platform SHALL issue a session token scoped to that user's role and School.
3. IF a user submits invalid credentials, THEN THE Platform SHALL return an authentication failure response without revealing which field was incorrect.
4. WHILE a session token is expired, THE Platform SHALL reject API requests and prompt re-authentication.
5. THE Platform SHALL present a role-selection screen on the login page so that Admin, Principal, and Teacher login flows are visually separated.
6. THE Platform SHALL enforce role-based access so that a Teacher cannot access Principal or Admin screens, and a Principal cannot access Admin screens.

---

### Requirement 3: Admin — User and Class Management

**User Story:** As an Admin, I want to create and manage Teachers, Classes, and Sections, so that the school structure is accurately represented in the platform.

#### Acceptance Criteria

1. THE Admin SHALL be able to create a Teacher account by providing a name, email address, and assigned Section(s).
2. THE Admin SHALL be able to create a Class by providing a class name (e.g., LKG, UKG, Prep1, Prep2).
3. THE Admin SHALL be able to create a Section within a Class by providing a section label (e.g., A, B).
4. THE Admin SHALL be able to assign one or more Teachers to a Section.
5. THE Admin SHALL be able to remove a Teacher's assignment from a Section.
6. WHEN a Teacher account is created, THE Platform SHALL send the Teacher a credential setup link to their registered email address.
7. IF an Admin attempts to create a duplicate Section name within the same Class, THEN THE Platform SHALL return a validation error.

---

### Requirement 4: Curriculum Document Ingestion

**User Story:** As an Admin, I want to upload a PDF curriculum for a Class, so that the platform can parse and schedule it as structured daily content.

#### Acceptance Criteria

1. THE Admin SHALL be able to upload a Curriculum_Document in PDF format for a specific Class.
2. WHEN a Curriculum_Document is uploaded, THE Ingestion_Service SHALL extract text content from all pages of the document.
3. WHEN text extraction is complete, THE Ingestion_Service SHALL split the content into Curriculum_Chunks using semantic boundaries (topics, headings, or activity blocks).
4. THE Ingestion_Service SHALL store each Curriculum_Chunk with metadata including: Class identifier, page range, topic label, and any referenced Activity identifiers.
5. WHEN ingestion is complete, THE Platform SHALL notify the Admin with a summary showing total chunks created and any pages that could not be parsed.
6. IF a Curriculum_Document page cannot be parsed, THEN THE Ingestion_Service SHALL log the page number and reason, and continue processing remaining pages.
7. THE Ingestion_Service SHALL generate vector embeddings for each Curriculum_Chunk to enable semantic search.
8. WHEN a new Curriculum_Document is uploaded for a Class that already has an existing document, THE Admin SHALL be prompted to confirm replacement before the Ingestion_Service processes the new document.

---

### Requirement 5: Day Plan Generation

**User Story:** As a Planner, I want the system to automatically distribute Curriculum_Chunks across school days, so that Teachers have a structured daily plan without manual scheduling.

#### Acceptance Criteria

1. THE Planner_Service SHALL distribute Curriculum_Chunks for a Class across the school calendar, assigning chunks to working days in sequential order.
2. THE Admin SHALL be able to configure the school calendar by specifying working days per week and public holidays.
3. WHEN the school calendar is configured, THE Planner_Service SHALL generate Day_Plans for each Section from the curriculum start date to the end date.
4. THE Planner_Service SHALL assign each Day_Plan to the Teacher(s) of the corresponding Section.
5. IF a Teacher is absent and the Admin marks the day as absent, THEN THE Planner_Service SHALL carry forward undelivered Curriculum_Chunks to the next available working day.
6. THE Planner_Service SHALL recalculate remaining Day_Plans whenever a Coverage_Log is submitted that indicates partial or no coverage of the scheduled Curriculum_Chunks.

---

### Requirement 6: Teacher Daily Planner — AI Query Interface

**User Story:** As a Teacher, I want to ask the AI assistant what I need to do today, so that I get a clear, context-aware plan without manually reading the curriculum.

#### Acceptance Criteria

1. WHEN a Teacher submits the query "What do I need to do today?" or a semantically equivalent query, THE AI_Assistant SHALL respond with the Teacher's Day_Plan for the current date, including topic names, Activity references, and any pending items carried forward from previous days.
2. WHEN a Teacher submits a query about yesterday's coverage, THE AI_Assistant SHALL retrieve the most recent Coverage_Log for that Teacher and summarize what was covered and what remains pending.
3. THE AI_Assistant SHALL present pending Curriculum_Chunks from prior days alongside today's scheduled chunks in a single consolidated response.
4. WHEN a Teacher asks for help with a specific Activity, THE AI_Assistant SHALL retrieve the relevant Curriculum_Chunk and provide a step-by-step explanation of how to conduct the Activity.
5. THE AI_Assistant SHALL respond to Teacher queries within 5 seconds under normal load conditions.
6. IF no Day_Plan exists for the current date (e.g., a holiday), THEN THE AI_Assistant SHALL inform the Teacher that no plan is scheduled for today.

---

### Requirement 7: Coverage Logging

**User Story:** As a Teacher, I want to log what I covered after each class in free text, so that the platform can track curriculum progress accurately.

#### Acceptance Criteria

1. THE Teacher SHALL be able to submit a Coverage_Log as free-form text describing what was taught in a session.
2. WHEN a Coverage_Log is submitted, THE Coverage_Analyzer SHALL compare the log text against the Day_Plan's Curriculum_Chunks using semantic similarity to determine which chunks were fully covered, partially covered, or not covered.
3. THE Coverage_Analyzer SHALL store a coverage status (covered, partial, pending) for each Curriculum_Chunk associated with the submitted Coverage_Log.
4. WHEN a Coverage_Log is submitted, THE Platform SHALL display a confirmation to the Teacher showing which planned topics were detected as covered and which remain pending.
5. THE Teacher SHALL be able to submit only one Coverage_Log per Section per calendar day, and SHALL be able to edit it within 24 hours of submission.
6. IF a Coverage_Log contains no detectable match to any scheduled Curriculum_Chunk, THEN THE Coverage_Analyzer SHALL flag the log for Admin review and notify the Teacher that the entry could not be automatically mapped.

---

### Requirement 8: AI-Powered Curriculum Progress Queries

**User Story:** As a Teacher or Principal, I want to ask the AI assistant about curriculum progress, so that I can identify lagging areas and take corrective action.

#### Acceptance Criteria

1. WHEN a Teacher asks "Who is lagging in the curriculum?" or a semantically equivalent query, THE AI_Assistant SHALL return a summary of Curriculum_Chunks that are overdue relative to the Day_Plan schedule for that Teacher's Section.
2. WHEN a Principal asks about the status of all classes, THE AI_Assistant SHALL return a consolidated progress report showing coverage percentage per Class and Section.
3. WHEN a Principal asks what a specific Teacher covered on a specific date, THE AI_Assistant SHALL retrieve and summarize the Coverage_Log for that Teacher and date.
4. THE AI_Assistant SHALL calculate curriculum completion percentage as the ratio of covered Curriculum_Chunks to total Curriculum_Chunks for a given Section and date range.
5. IF no Coverage_Logs have been submitted for a Section for more than 3 consecutive working days, THEN THE Platform SHALL flag that Section as inactive and include it in the Principal's status view.

---

### Requirement 9: Principal Dashboard

**User Story:** As a Principal, I want a visual dashboard showing curriculum status across all classes and teachers, so that I can monitor school-wide progress at a glance.

#### Acceptance Criteria

1. THE Principal dashboard SHALL display a list of all Classes and Sections with their current curriculum completion percentage.
2. THE Principal dashboard SHALL highlight Sections where coverage has fallen behind the Day_Plan schedule by more than 5 working days.
3. WHEN a Principal selects a Section, THE Platform SHALL display a timeline view showing Day_Plans, Coverage_Logs, and pending Curriculum_Chunks for that Section.
4. THE Principal dashboard SHALL refresh coverage data at intervals no greater than 60 seconds without requiring a manual page reload.
5. THE Principal dashboard SHALL display the date and content of the most recent Coverage_Log for each Teacher.

---

### Requirement 10: Activity Help from Curriculum

**User Story:** As a Teacher, I want to ask the AI assistant how to conduct a specific activity referenced in my plan, so that I can deliver lessons effectively without searching through the full PDF.

#### Acceptance Criteria

1. WHEN a Teacher asks how to perform a specific Activity by name or description, THE AI_Assistant SHALL retrieve the Curriculum_Chunk containing that Activity and return a structured explanation including objectives, materials needed, and step-by-step instructions as present in the source document.
2. IF an Activity is referenced in the Curriculum_Chunk but detailed instructions are not present in the Curriculum_Document, THEN THE AI_Assistant SHALL inform the Teacher that detailed instructions are not available in the uploaded curriculum and suggest consulting the referenced book or worksheet.
3. THE AI_Assistant SHALL support Activity queries in natural language (e.g., "How do I do the colour mixing activity?") and match them to Curriculum_Chunks using semantic search.

---

### Requirement 11: Curriculum Document Round-Trip Integrity

**User Story:** As an Admin, I want the ingested curriculum content to faithfully represent the uploaded PDF, so that Teachers receive accurate plans.

#### Acceptance Criteria

1. THE Ingestion_Service SHALL preserve the original text of each Curriculum_Chunk without modification during extraction and storage.
2. FOR ALL Curriculum_Chunks, re-exporting the stored chunks for a Class SHALL produce a document that contains all topics and Activities present in the original Curriculum_Document.
3. THE Ingestion_Service SHALL record a checksum of each uploaded Curriculum_Document and verify it on re-upload to detect duplicate submissions.

---

### Requirement 12: Extensible Role Architecture

**User Story:** As a Platform operator, I want the role system to be extensible, so that future roles (Parent, Accountant, Staff) can be added without redesigning the access control model.

#### Acceptance Criteria

1. THE Platform SHALL define roles as configurable entities with associated permission sets rather than hard-coded role checks.
2. THE Admin SHALL be able to view the list of active roles for a School.
3. WHERE a new role is introduced in a future phase, THE Platform SHALL allow assigning that role to a user without modifying existing role definitions.

---

## Out of Scope for Phase 1

The following capabilities are explicitly deferred to future phases:

- Parent login and parent-facing AI queries
- Enrollment management
- Fee management
- Accountant role
- Staff enquiry portal (open link for job applications)
- Mobile native application (a Progressive Web App approach is recommended for Phase 1 to provide mobile-friendly access without a separate build pipeline)
