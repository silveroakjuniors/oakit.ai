import { Router } from 'express';
import { pool } from '../../lib/db';

const router = Router();

// ── Indian standard kids uniform size chart ───────────────────────────────────
// Sizes: 20 22 24 26 28 30 32
// Based on chest measurement (cm) — most reliable for shirt sizing
const SHIRT_SIZE_CHART: { size: string; chestMin: number; chestMax: number; heightMin: number; heightMax: number }[] = [
  { size: '20', chestMin: 48, chestMax: 52, heightMin: 95,  heightMax: 105 },
  { size: '22', chestMin: 53, chestMax: 57, heightMin: 106, heightMax: 115 },
  { size: '24', chestMin: 58, chestMax: 62, heightMin: 116, heightMax: 125 },
  { size: '26', chestMin: 63, chestMax: 67, heightMin: 126, heightMax: 135 },
  { size: '28', chestMin: 68, chestMax: 72, heightMin: 136, heightMax: 145 },
  { size: '30', chestMin: 73, chestMax: 77, heightMin: 146, heightMax: 155 },
  { size: '32', chestMin: 78, chestMax: 82, heightMin: 156, heightMax: 165 },
];

// Pant size based on waist/pant-length
const PANT_SIZE_CHART: { size: string; pantLengthMin: number; pantLengthMax: number }[] = [
  { size: '20', pantLengthMin: 40, pantLengthMax: 48 },
  { size: '22', pantLengthMin: 49, pantLengthMax: 55 },
  { size: '24', pantLengthMin: 56, pantLengthMax: 62 },
  { size: '26', pantLengthMin: 63, pantLengthMax: 68 },
  { size: '28', pantLengthMin: 69, pantLengthMax: 74 },
  { size: '30', pantLengthMin: 75, pantLengthMax: 80 },
  { size: '32', pantLengthMin: 81, pantLengthMax: 90 },
];

function recommendShirtSize(chest?: number, height?: number): string | null {
  if (!chest && !height) return null;
  // Primary: chest measurement
  if (chest) {
    for (const row of SHIRT_SIZE_CHART) {
      if (chest >= row.chestMin && chest <= row.chestMax) return row.size;
    }
    // Out of range — clamp to nearest
    if (chest < SHIRT_SIZE_CHART[0].chestMin) return SHIRT_SIZE_CHART[0].size;
    return SHIRT_SIZE_CHART[SHIRT_SIZE_CHART.length - 1].size;
  }
  // Fallback: height
  if (height) {
    for (const row of SHIRT_SIZE_CHART) {
      if (height >= row.heightMin && height <= row.heightMax) return row.size;
    }
    if (height < SHIRT_SIZE_CHART[0].heightMin) return SHIRT_SIZE_CHART[0].size;
    return SHIRT_SIZE_CHART[SHIRT_SIZE_CHART.length - 1].size;
  }
  return null;
}

function recommendPantSize(pantLength?: number, height?: number): string | null {
  if (pantLength) {
    for (const row of PANT_SIZE_CHART) {
      if (pantLength >= row.pantLengthMin && pantLength <= row.pantLengthMax) return row.size;
    }
    if (pantLength < PANT_SIZE_CHART[0].pantLengthMin) return PANT_SIZE_CHART[0].size;
    return PANT_SIZE_CHART[PANT_SIZE_CHART.length - 1].size;
  }
  // Fallback: estimate pant length as ~55% of height
  if (height) {
    const estimated = height * 0.55;
    return recommendPantSize(estimated);
  }
  return null;
}

// ── POST /api/v1/public/uniform ───────────────────────────────────────────────
// Public — no auth required.
// Parents submit child measurements; we recommend sizes and save to DB.
router.post('/', async (req, res) => {
  try {
    const {
      school_code,
      child_name,
      class_name,
      parent_name,
      contact_number,
      height_cm,
      weight_kg,
      chest_cm,
      shirt_length_cm,
      pant_length_cm,
    } = req.body as {
      school_code: string;
      child_name: string;
      class_name: string;
      parent_name: string;
      contact_number: string;
      height_cm?: number;
      weight_kg?: number;
      chest_cm?: number;
      shirt_length_cm?: number;
      pant_length_cm?: number;
    };

    // Validate required fields
    if (!school_code || !child_name || !class_name || !parent_name || !contact_number) {
      return res.status(400).json({
        error: 'school_code, child_name, class_name, parent_name, and contact_number are required',
      });
    }

    const cleaned = String(contact_number).replace(/\D/g, '');
    if (cleaned.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit contact number' });
    }

    // Look up school
    const schoolRow = await pool.query(
      'SELECT id FROM schools WHERE school_code = $1 AND status != $2',
      [school_code.toLowerCase().trim(), 'inactive']
    );
    if (schoolRow.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }
    const school_id = schoolRow.rows[0].id;

    // Recommend sizes
    const recommended_shirt_size = recommendShirtSize(
      chest_cm ? Number(chest_cm) : undefined,
      height_cm ? Number(height_cm) : undefined
    );
    const recommended_pant_size = recommendPantSize(
      pant_length_cm ? Number(pant_length_cm) : undefined,
      height_cm ? Number(height_cm) : undefined
    );

    // Save to DB
    const result = await pool.query(
      `INSERT INTO uniform_sizing_requests
         (school_id, school_code, child_name, class_name, parent_name, contact_number,
          height_cm, weight_kg, chest_cm, shirt_length_cm, pant_length_cm,
          recommended_shirt_size, recommended_pant_size)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, recommended_shirt_size, recommended_pant_size`,
      [
        school_id, school_code.toLowerCase().trim(),
        child_name.trim(), class_name.trim(),
        parent_name.trim(), cleaned,
        height_cm || null, weight_kg || null,
        chest_cm || null, shirt_length_cm || null, pant_length_cm || null,
        recommended_shirt_size, recommended_pant_size,
      ]
    );

    return res.status(201).json({
      id: result.rows[0].id,
      recommended_shirt_size: result.rows[0].recommended_shirt_size,
      recommended_pant_size: result.rows[0].recommended_pant_size,
      message: 'Uniform sizing request submitted successfully',
    });
  } catch (err) {
    console.error('[uniform sizing]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/v1/public/uniform/size-chart ─────────────────────────────────────
// Returns the size chart so the frontend can show it to parents
router.get('/size-chart', (_req, res) => {
  return res.json({ shirt: SHIRT_SIZE_CHART, pant: PANT_SIZE_CHART });
});

export default router;
