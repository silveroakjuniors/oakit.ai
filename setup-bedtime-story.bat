@echo off
echo Creating Speak Story Module Structure...

:: FRONTEND STRUCTURE
mkdir apps\frontend\app\speak-story
mkdir apps\frontend\app\speak-story\library
mkdir apps\frontend\app\speak-story\player
mkdir apps\frontend\app\speak-story\player\[id]
mkdir apps\frontend\app\speak-story\feedback

:: COMPONENTS
mkdir apps\frontend\components\speak-story

:: CONTENT
mkdir apps\frontend\content
mkdir apps\frontend\content\stories

:: AI SERVICE STRUCTURE
mkdir apps\ai-service\src\storytelling
mkdir apps\ai-service\src\speech
mkdir apps\ai-service\src\evaluation
mkdir apps\ai-service\src\prompts
mkdir apps\ai-service\src\feedback

:: FRONTEND FILES
type nul > apps\frontend\app\speak-story\page.tsx
type nul > apps\frontend\app\speak-story\library\page.tsx
type nul > apps\frontend\app\speak-story\player\[id]\page.tsx
type nul > apps\frontend\app\speak-story\feedback\page.tsx

:: COMPONENT FILES
type nul > apps\frontend\components\speak-story\StoryCard.tsx
type nul > apps\frontend\components\speak-story\StoryPlayer.tsx
type nul > apps\frontend\components\speak-story\RecordButton.tsx
type nul > apps\frontend\components\speak-story\FeedbackCard.tsx
type nul > apps\frontend\components\speak-story\ProgressChart.tsx

:: CONTENT FILES
type nul > apps\frontend\content\stories\age-2-3.json
type nul > apps\frontend\content\stories\age-3-4.json
type nul > apps\frontend\content\stories\age-4-5.json
type nul > apps\frontend\content\stories\age-5-6.json

:: AI SERVICE FILES
type nul > apps\ai-service\src\speech\transcribe.ts
type nul > apps\ai-service\src\evaluation\storyEvaluator.ts
type nul > apps\ai-service\src\prompts\storyPrompt.ts
type nul > apps\ai-service\src\feedback\encouragement.ts

echo.
echo Speak Story Module Structure Created Successfully!
pause