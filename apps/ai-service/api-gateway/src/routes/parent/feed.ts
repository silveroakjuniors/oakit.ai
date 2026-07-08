import { Router, Request, Response } from 'express';
import { pool } from '../../lib/db';
import { jwtVerify, forceResetGuard, schoolScope, roleGuard } from '../../middleware/auth';
import { getToday } from '../../lib/today';

const router = Router();
router.use(jwtVerify, forceResetGuard, schoolScope, roleGuard('parent'));

// GET / — daily feed for linked children
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, school_id } = req.user!;
    const date = req.query.date as string | undefined;

    // Determine date
    let feedDate: string;
    if (date) {
      feedDate = date;
    } else {
      feedDate = await getToday(school_id!);
    }

    // Get linked children with their sections
    const links = await pool.query(
      `SELECT psl.student_id, st.name AS student_name, st.section_id
       FROM parent_student_links psl
       JOIN students st ON st.id = psl.student_id
       WHERE psl.parent_id = $1`,
      [user_id]
    );

    const feed = [];
    for (const link of links.rows) {
      const { student_id, student_name, section_id } = link;

      // Check for completion
      const completionRow = await pool.query(
        `SELECT id, covered_chunk_ids, settling_day_note FROM daily_completions
         WHERE section_id = $1 AND completion_date = $2`,
        [section_id, feedDate]
      );

      if (completionRow.rows.length > 0) {
        const comp = completionRow.rows[0];
        // Get topic labels for covered chunks
        let topic_labels: string[] = [];
        if (comp.covered_chunk_ids?.length > 0) {
          const chunksRow = await pool.query(
            `SELECT cc.topic_label, cc.content FROM curriculum_chunks cc WHERE cc.id = ANY($1::uuid[])`,
            [comp.covered_chunk_ids]
          );
          // Parse subjects from content and enrich with resource lookup
          const allContent = chunksRow.rows.map((r: any) => r.content || r.topic_label).join('\n');
          // Extract resource numbers and look them up
          const refNums: string[] = [...(allContent.match(/\b(\d{2,4})\b/g) || []), ...(allContent.match(/\b(w\d{4})\b/gi) || [])];
          let resourceMap: Record<string, { topic: string; book_page: string }> = {};
          if (refNums.length > 0) {
            const resRows = await pool.query(
              `SELECT resource_id, topic, book_page FROM curriculum_resources WHERE school_id = $1 AND resource_id = ANY($2)`,
              [school_id, [...new Set(refNums)]]
            );
            for (const r of resRows.rows) resourceMap[r.resource_id] = { topic: r.topic, book_page: r.book_page };
          }
          // Build enriched topic labels
          topic_labels = chunksRow.rows.map((r: any) => {
            let label = r.topic_label || '';
            // Parse subjects from content
            const content = r.content || '';
            const lines = content.split('\n').filter((l: string) => l.includes(':'));
            if (lines.length > 0) {
              return lines.map((line: string) => {
                // Enrich numbers in the line
                let enriched = line;
                for (const [rid, info] of Object.entries(resourceMap)) {
                  if (enriched.includes(rid)) {
                    enriched = enriched.replace(new RegExp(`\\b${rid}\\b`), `${rid} (${info.topic}, pg ${info.book_page})`);
                  }
                }
                return enriched;
              });
            }
            return [label];
          }).flat();
        }
        feed.push({
          student_id,
          student_name,
          type: 'curriculum',
          topic_labels,
          settling_day_note: comp.settling_day_note ?? null,
        });
        continue;
      }

      // Check for special day
      const specialRow = await pool.query(
        `SELECT label, day_type FROM special_days
         WHERE school_id = $1 AND day_date = $2 LIMIT 1`,
        [school_id, feedDate]
      );
      if (specialRow.rows.length > 0) {
        feed.push({
          student_id,
          student_name,
          type: 'special_day',
          label: specialRow.rows[0].label,
          day_type: specialRow.rows[0].day_type,
        });
        continue;
      }

      feed.push({ student_id, student_name, type: 'empty' });
    }

    return res.json(feed);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
