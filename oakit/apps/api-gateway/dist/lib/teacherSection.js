"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeacherSections = getTeacherSections;
const db_1 = require("./db");
async function getTeacherSections(teacher_id, school_id) {
    const [ctRows, tsRows] = await Promise.all([
        db_1.pool.query(`SELECT id AS section_id FROM sections
       WHERE class_teacher_id = $1 AND school_id = $2`, [teacher_id, school_id]),
        db_1.pool.query(`SELECT ts.section_id FROM teacher_sections ts
       JOIN sections s ON ts.section_id = s.id
       WHERE ts.teacher_id = $1 AND s.school_id = $2`, [teacher_id, school_id]),
    ]);
    const result = new Map();
    for (const r of ctRows.rows)
        result.set(r.section_id, 'class_teacher');
    for (const r of tsRows.rows) {
        if (!result.has(r.section_id))
            result.set(r.section_id, 'supporting');
    }
    return Array.from(result.entries()).map(([section_id, role]) => ({ section_id, role }));
}
