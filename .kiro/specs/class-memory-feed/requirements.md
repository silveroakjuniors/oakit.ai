# Requirements Document

## Introduction

Class Memory Feed is a private, Instagram-like photo sharing feature for Oakit's preschool platform. It allows teachers to post daily photo moments from their assigned section, and parents to view, like, and share those posts — scoped strictly to their child's section. Admins and principals can post school-wide announcements visible to all classes. The feature is v1 with images only, likes and shares only (no comments), and automatic post expiry.

---

## Glossary

- **Feed**: The chronological, paginated list of posts visible to a user.
- **Post**: A single upload event consisting of 1–4 images, an optional caption, metadata (section/school, poster, date), and engagement data.
- **Section_Post**: A post scoped to a specific section, visible only to parents of that section and teachers assigned to it.
- **School_Post**: A post created by an admin or principal, visible to all parents and teachers across the entire school.
- **Memory_Feed**: The backend system responsible for storing, serving, and expiring posts and their associated media.
- **Image_Processor**: The component responsible for compressing uploaded images before storage.
- **Feed_Guard**: The authorization layer that enforces section-scoped and school-scoped visibility.
- **Retention_Job**: The scheduled cron job that deletes expired posts and their associated storage objects.
- **Engagement_Service**: The component handling likes on posts.
- **Admin_Console**: The admin/principal interface for monitoring, moderating, configuring, and posting school-wide content.
- **Share_Handler**: The client-side component that invokes the native share API with pre-filled text.
- **Teacher**: A user with role `teacher` — can be a class teacher or supporting teacher assigned to a section.
- **Supporting_Teacher**: A teacher assigned to a section via `teacher_sections` but not the `class_teacher_id`.
- **Parent**: A user with role `parent` linked to one or more students via `parent_student_links`.
- **Admin**: A user with role `admin` or `principal` within a school — has school-wide access and can post school-wide.
- **Section**: A subdivision of a class (e.g., UKG-A), identified by `section_id`.
- **school_id**: The tenant identifier scoped to every request via JWT, enforced by `schoolScope` middleware.

---

## Requirements

### Requirement 1: Teacher Photo Upload (Section-Scoped)

**User Story:** As a teacher or supporting teacher, I want to upload up to 4 photos with an optional caption in a single post to my assigned section, so that I can share today's class moments with parents.

#### Acceptance Criteria

1. WHEN a teacher submits the upload form, THE Memory_Feed SHALL accept between 1 and 4 image files per post submission.
2. WHEN a teacher submits the upload form, THE Memory_Feed SHALL accept an optional caption of up to 500 characters.
3. WHEN an uploaded image is received, THE Image_Processor SHALL compress each image to a maximum file size of 300 KB before storing it.
4. WHEN an image is uploaded, THE Memory_Feed SHALL store the post with metadata including `section_id`, `class_id`, `teacher_id`, `school_id`, `post_scope` = `section`, and `created_at`.
5. WHEN a teacher attempts to upload and the section has already reached 4 posts for the current calendar day, THE Memory_Feed SHALL reject the upload with an HTTP 429 response and a message indicating the daily limit has been reached.
6. WHEN a teacher attempts to upload images of a type other than JPEG or PNG, THE Memory_Feed SHALL reject the request with an HTTP 400 response.
7. WHEN a teacher attempts to upload more than 4 images in a single post, THE Memory_Feed SHALL reject the request with an HTTP 400 response.
8. THE Memory_Feed SHALL only permit a teacher to post to sections where they appear in `teacher_sections` OR where they are the `class_teacher_id` — both class teachers and supporting teachers can post.
9. THE Image_Processor SHALL reject any single image file exceeding 10 MB before compression, returning an HTTP 400 response.

---

### Requirement 2: Admin and Principal Photo Upload (School-Wide)

**User Story:** As an admin or principal, I want to upload up to 10 photos per day as school-wide posts visible to all classes, so that I can share whole-school moments with every parent and teacher.

#### Acceptance Criteria

1. WHEN an admin or principal submits the upload form, THE Memory_Feed SHALL accept between 1 and 10 image files per post submission.
2. WHEN an admin or principal submits the upload form, THE Memory_Feed SHALL accept an optional caption of up to 500 characters.
3. WHEN an admin or principal post is created, THE Memory_Feed SHALL store the post with `post_scope` = `school`, `school_id`, `posted_by` (user id), and `created_at` — with no `section_id`.
4. WHEN an admin or principal attempts to upload and the school has already reached 10 school-wide posts for the current calendar day, THE Memory_Feed SHALL reject the upload with an HTTP 429 response.
5. WHEN an admin or principal uploads images of a type other than JPEG or PNG, THE Memory_Feed SHALL reject the request with an HTTP 400 response.
6. WHEN an admin or principal attempts to upload more than 10 images in a single post, THE Memory_Feed SHALL reject the request with an HTTP 400 response.

---

### Requirement 3: Feed Visibility Rules

**User Story:** As a user, I want to see only the posts I am authorised to view, so that class and school privacy is protected.

#### Acceptance Criteria

1. WHEN a parent requests the feed, THE Feed_Guard SHALL return all school-wide posts (`post_scope = school`) PLUS all section posts for every section in which the parent has an enrolled child.
2. WHEN a parent requests the feed for a specific section they are not linked to, THE Feed_Guard SHALL return an HTTP 403 response.
3. WHEN a teacher requests the feed, THE Feed_Guard SHALL return all school-wide posts PLUS all section posts for every section the teacher is assigned to (as class teacher or supporting teacher).
4. WHEN an admin or principal requests the feed, THE Feed_Guard SHALL return all posts across the entire school — both school-wide and all section posts — in a single scrollable feed.
5. THE Memory_Feed SHALL never return posts from a different `school_id` than the one encoded in the requester's JWT.

---

### Requirement 4: Paginated Feed Retrieval

**User Story:** As any user, I want to scroll through posts in a fast, paginated feed ordered newest-first, so that I can browse memories without performance issues.

#### Acceptance Criteria

1. WHEN a feed request is made, THE Memory_Feed SHALL return posts in descending order of `created_at` (newest first).
2. WHEN a feed request is made, THE Memory_Feed SHALL return a maximum of 10 posts per page.
3. WHEN a feed request includes a `cursor` parameter, THE Memory_Feed SHALL return the next page of results starting after the post identified by that cursor.
4. WHEN a feed response is returned, THE Memory_Feed SHALL include a `next_cursor` field that is `null` when no further pages exist.
5. WHEN a feed response is returned, each post object SHALL include: post `id`, `caption`, `created_at`, poster `name`, poster `role`, `post_scope`, section label (if section post), array of image URLs, like count, and a boolean `liked_by_me` indicating whether the requesting user has liked the post.

---

### Requirement 5: Post Retention and Auto-Expiry

**User Story:** As an admin, I want posts to be automatically deleted after a configurable number of days, so that storage is managed and old content does not accumulate.

#### Acceptance Criteria

1. WHEN a post is created, THE Memory_Feed SHALL set an `expires_at` timestamp equal to `created_at` plus the school's configured retention period in days.
2. THE Retention_Job SHALL execute once per day and delete all posts where `expires_at` is less than the current timestamp.
3. WHEN the Retention_Job deletes a post, THE Retention_Job SHALL also delete all associated image files from Supabase Storage.
4. WHEN the Retention_Job deletes a post, THE Retention_Job SHALL also delete all associated likes for that post.
5. THE Memory_Feed SHALL use a default retention period of 20 days when no school-specific configuration exists.
6. WHERE an admin has configured a custom retention period, THE Memory_Feed SHALL use that value instead of the default.
7. WHILE a post's `expires_at` has passed, THE Memory_Feed SHALL not return that post in any feed response, even before the Retention_Job has run.

---

### Requirement 6: Likes

**User Story:** As a parent or teacher, I want to like and unlike posts, so that I can express appreciation for shared moments.

#### Acceptance Criteria

1. WHEN a user likes a post they have not previously liked, THE Engagement_Service SHALL record the like and return the updated like count.
2. WHEN a user likes a post they have already liked, THE Engagement_Service SHALL remove the like (toggle off) and return the updated like count.
3. WHEN a like or unlike action is performed, THE Engagement_Service SHALL respond within 500ms under normal load.
4. THE Memory_Feed SHALL display the total like count for each post in the feed response.
5. THE Feed_Guard SHALL prevent a user from liking a post they are not authorised to view.
6. THE Memory_Feed SHALL NOT support comments in v1 — likes and shares are the only engagement actions.

---

### Requirement 7: External Share

**User Story:** As a parent, I want to share a post externally via WhatsApp, Instagram, or Facebook, so that I can share class memories with family members.

#### Acceptance Criteria

1. WHEN a parent taps the share button on a post, THE Share_Handler SHALL invoke the device's native Web Share API with pre-filled text in the format: `"Today's moments from [School Name] ❤️"`.
2. WHEN the native share API is not available in the browser, THE Share_Handler SHALL display direct share links for WhatsApp, Instagram, and Facebook as a fallback.
3. THE Share_Handler SHALL NOT automatically post to any social media platform; all sharing SHALL require explicit user action.
4. THE Share_Handler SHALL share only the image URL(s) and pre-filled text; it SHALL NOT include any child names or personally identifiable information in the shared content.

---

### Requirement 8: Admin and Principal Moderation

**User Story:** As an admin or principal, I want to monitor and delete any post across the school, so that I can ensure appropriate content.

#### Acceptance Criteria

1. WHEN an admin or principal requests the feed, THE Admin_Console SHALL return all posts across the school (section posts and school-wide posts) in a single scrollable feed, newest first.
2. WHEN an admin or principal deletes any post, THE Memory_Feed SHALL remove the post, its images from storage, and all associated likes.
3. WHEN an admin configures the daily section upload limit, THE Memory_Feed SHALL enforce the new limit for all subsequent teacher uploads; the configurable range SHALL be 1 to 20 posts per section per day.
4. WHEN an admin configures the retention period, THE Memory_Feed SHALL apply the new value to all subsequently created posts; the configurable range SHALL be 1 to 90 days.
5. THE Admin_Console SHALL display the total active post count and storage usage estimate per section and school-wide.

---

### Requirement 9: Image Storage and CDN Delivery

**User Story:** As any user, I want images to load quickly and reliably, so that the feed feels responsive.

#### Acceptance Criteria

1. WHEN a section post image is stored, THE Memory_Feed SHALL store it under the path `{school_id}/memory-feed/sections/{section_id}/{post_id}/{filename}`.
2. WHEN a school-wide post image is stored, THE Memory_Feed SHALL store it under the path `{school_id}/memory-feed/school/{post_id}/{filename}`.
3. WHEN image URLs are returned in a feed response, THE Memory_Feed SHALL return Supabase CDN public URLs so that images are served via CDN without requiring authentication.
4. WHEN an image upload fails at the storage layer, THE Memory_Feed SHALL roll back the post record and return an HTTP 500 response with an error message.

---

### Requirement 10: Security and Tenant Isolation

**User Story:** As a school administrator, I want all feed data to be strictly isolated per school, so that no cross-school data leakage occurs.

#### Acceptance Criteria

1. THE Memory_Feed SHALL include `school_id` as a filter condition in every database query that reads or writes post or like data.
2. WHEN a request arrives without a valid JWT, THE Feed_Guard SHALL return an HTTP 401 response.
3. WHEN a request arrives with a JWT whose `school_id` does not match the resource's `school_id`, THE Feed_Guard SHALL return an HTTP 403 response.
4. THE Memory_Feed SHALL not expose internal database identifiers of other users' records in error messages.
