import { Router, Request, Response } from 'express';
import axios from 'axios';
import { jwtVerify, schoolScope, roleGuard, forceResetGuard } from '../../middleware/auth';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('teacher', 'principal', 'admin'));

const AI = () => process.env.AI_SERVICE_URL || 'http://localhost:8000';

const FALLBACK_ACTIVITIES = (subject: string, classLevel: string) => ({
  activities: [
    {
      title: `${subject} — Simple Activity`,
      description: `A basic ${subject.toLowerCase()} activity suitable for ${classLevel} students. Ask children to identify and name familiar objects related to the topic.`,
      difficulty: 'Simple',
      support_level: 'additional',
    },
    {
      title: `${subject} — Standard Activity`,
      description: `A standard ${subject.toLowerCase()} activity for ${classLevel}. Guide children through the topic using visual aids, songs, or hands-on materials.`,
      difficulty: 'Standard',
      support_level: 'standard',
    },
    {
      title: `${subject} — Extended Activity`,
      description: `An extended ${subject.toLowerCase()} activity for advanced ${classLevel} learners. Encourage children to create, explain, or demonstrate their understanding.`,
      difficulty: 'Extended',
      support_level: 'advanced',
    },
  ],
});

// POST /api/v1/teacher/suggestions/activity
router.post('/activity', async (req: Request, res: Response) => {
  try {
    const { school_id } = req.user!;
    const { subject, class_level, topic } = req.body;
    if (!subject || !class_level) return res.status(400).json({ error: 'subject and class_level are required' });

    const today = await getToday(school_id);

    try {
      const aiResp = await axios.post(`${AI()}/internal/suggest-activity`, {
        subject, class_level, topic: topic || subject, school_id, query_date: today,
      }, { timeout: 8000 });
      return res.json(aiResp.data);
    } catch {
      // Fallback if AI unavailable
      return res.json(FALLBACK_ACTIVITIES(subject, class_level));
    }
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/teacher/suggestions/worksheet
router.post('/worksheet', async (req: Request, res: Response) => {
  try {
    const { subject, topic, class_level } = req.body;
    if (!subject || !class_level) return res.status(400).json({ error: 'subject and class_level are required' });

    try {
      const aiResp = await axios.post(`${AI()}/internal/generate-worksheet`, {
        subject, topic: topic || subject, class_level,
      }, { timeout: 15000 });
      return res.json(aiResp.data);
    } catch {
      // Structured fallback worksheet
      return res.json({
        title: `${subject} Worksheet — ${class_level}`,
        topic: topic || subject,
        class_level,
        no_curriculum_content: !topic,
        sections: [
          {
            type: 'fill_in_blank',
            title: 'Fill in the Blanks',
            items: [
              { question: `The colour of the sky is _______.`, answer: 'blue' },
              { question: `A cat says _______.`, answer: 'meow' },
              { question: `We have _______ fingers on one hand.`, answer: 'five' },
            ],
          },
          {
            type: 'matching',
            title: 'Match the Following',
            items: [
              { left: 'Sun', right: 'Shines in the day' },
              { left: 'Moon', right: 'Shines at night' },
              { left: 'Rain', right: 'Falls from clouds' },
            ],
          },
          {
            type: 'drawing',
            title: 'Draw and Colour',
            prompt: `Draw your favourite animal and colour it.`,
          },
        ],
      });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
