"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../../lib/db");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
// Apply auth middleware to all routes
router.use(auth_1.jwtVerify, auth_1.schoolScope, (0, auth_1.roleGuard)('admin'));
// GET /api/v1/admin/users
router.get('/', async (req, res) => {
    try {
        const { school_id } = req.user;
        const result = await db_1.pool.query(`SELECT u.id, u.name, u.mobile, u.is_active, u.created_at,
              r.name as role,
              COALESCE(
                json_agg(
                  json_build_object('section_id', ts.section_id, 'section_label', s.label, 'class_name', c.name)
                ) FILTER (WHERE ts.section_id IS NOT NULL), '[]'
              ) as sections,
              CASE WHEN ct.id IS NOT NULL
                THEN json_build_object('label', ct.label, 'class_name', ctc.name)
                ELSE NULL
              END as class_teacher_section
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN teacher_sections ts ON u.id = ts.teacher_id
       LEFT JOIN sections s ON ts.section_id = s.id
       LEFT JOIN classes c ON s.class_id = c.id
       LEFT JOIN sections ct ON ct.class_teacher_id = u.id
       LEFT JOIN classes ctc ON ctc.id = ct.class_id
       WHERE u.school_id = $1
       GROUP BY u.id, r.name, ct.id, ct.label, ctc.name
       ORDER BY u.created_at DESC`, [school_id]);
        return res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/admin/users/roles  — must be before /:id to avoid param collision
router.get('/roles', async (req, res) => {
    try {
        const { school_id } = req.user;
        const result = await db_1.pool.query('SELECT id, name, permissions, portal_access FROM roles WHERE school_id = $1 ORDER BY name', [school_id]);
        return res.json(result.rows);
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/admin/users/roles — create a new role
router.post('/roles', async (req, res) => {
    try {
        const { school_id } = req.user;
        const { name, permissions, portal_access } = req.body;
        if (!name)
            return res.status(400).json({ error: 'name is required' });
        const result = await db_1.pool.query(`INSERT INTO roles (school_id, name, permissions, portal_access) VALUES ($1, $2, $3, $4)
       ON CONFLICT (school_id, name) DO UPDATE SET permissions = EXCLUDED.permissions, portal_access = EXCLUDED.portal_access
       RETURNING id, name, permissions, portal_access`, [school_id, name.trim(), JSON.stringify(permissions || []), portal_access ?? null]);
        return res.status(201).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// PUT /api/v1/admin/users/roles/:id — update role permissions
router.put('/roles/:id', async (req, res) => {
    try {
        const { school_id } = req.user;
        const { name, permissions, portal_access } = req.body;
        const result = await db_1.pool.query(`UPDATE roles SET
         name = COALESCE($1, name),
         permissions = COALESCE($2, permissions),
         portal_access = $3
       WHERE id = $4 AND school_id = $5
       RETURNING id, name, permissions, portal_access`, [name || null, permissions ? JSON.stringify(permissions) : null, portal_access ?? null, req.params.id, school_id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Role not found' });
        return res.json(result.rows[0]);
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// DELETE /api/v1/admin/users/roles/:id
router.delete('/roles/:id', async (req, res) => {
    try {
        const { school_id } = req.user;
        // Check if any users have this role
        const inUse = await db_1.pool.query('SELECT COUNT(*) FROM users WHERE role_id = $1 AND school_id = $2', [req.params.id, school_id]);
        if (parseInt(inUse.rows[0].count) > 0) {
            return res.status(409).json({ error: 'Cannot delete a role that is assigned to users' });
        }
        await db_1.pool.query('DELETE FROM roles WHERE id = $1 AND school_id = $2', [req.params.id, school_id]);
        return res.json({ message: 'Role deleted' });
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/admin/users
router.post('/', async (req, res) => {
    try {
        const { school_id } = req.user;
        const { name, mobile, role_name, section_ids } = req.body;
        if (!name || !mobile || !role_name) {
            return res.status(400).json({ error: 'name, mobile, and role_name are required' });
        }
        if (!/^\d{10}$/.test(mobile)) {
            return res.status(400).json({ error: 'Mobile must be 10 digits' });
        }
        const roleResult = await db_1.pool.query('SELECT id FROM roles WHERE school_id = $1 AND name = $2', [school_id, role_name]);
        if (roleResult.rows.length === 0) {
            return res.status(400).json({ error: `Role '${role_name}' not found` });
        }
        const role_id = roleResult.rows[0].id;
        // Initial password = mobile number
        const bcrypt = require('bcryptjs');
        const password_hash = await bcrypt.hash(mobile, 12);
        const userResult = await db_1.pool.query(`INSERT INTO users (school_id, role_id, name, mobile, password_hash, force_password_reset)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, name, mobile, created_at`, [school_id, role_id, name, mobile, password_hash]);
        const user = userResult.rows[0];
        if (section_ids && Array.isArray(section_ids) && section_ids.length > 0) {
            for (const section_id of section_ids) {
                await db_1.pool.query('INSERT INTO teacher_sections (teacher_id, section_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, section_id]);
            }
        }
        return res.status(201).json({ ...user, message: `User created. Initial password is their mobile number: ${mobile}` });
    }
    catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Mobile number already exists for this school' });
        }
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/admin/users/:id/reset-password — reset to mobile number
router.post('/:id/reset-password', async (req, res) => {
    try {
        const { school_id } = req.user;
        const userRow = await db_1.pool.query('SELECT id, mobile FROM users WHERE id = $1 AND school_id = $2', [req.params.id, school_id]);
        if (userRow.rows.length === 0)
            return res.status(404).json({ error: 'User not found' });
        const { mobile } = userRow.rows[0];
        const bcrypt = require('bcryptjs');
        const password_hash = await bcrypt.hash(mobile, 12);
        await db_1.pool.query('UPDATE users SET password_hash = $1, force_password_reset = true WHERE id = $2 AND school_id = $3', [password_hash, req.params.id, school_id]);
        return res.json({ message: `Password reset to mobile number: ${mobile}` });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// PUT /api/v1/admin/users/:id/role — reassign role
router.put('/:id/role', async (req, res) => {
    try {
        const { school_id } = req.user;
        const { role_name } = req.body;
        if (!role_name)
            return res.status(400).json({ error: 'role_name is required' });
        const roleRow = await db_1.pool.query('SELECT id FROM roles WHERE school_id = $1 AND name = $2', [school_id, role_name]);
        if (roleRow.rows.length === 0)
            return res.status(404).json({ error: 'Role not found' });
        await db_1.pool.query('UPDATE users SET role_id = $1 WHERE id = $2 AND school_id = $3', [roleRow.rows[0].id, req.params.id, school_id]);
        return res.json({ message: 'Role updated' });
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// DELETE /api/v1/admin/users/:id
router.delete('/:id', async (req, res) => {
    try {
        const { school_id } = req.user;
        await db_1.pool.query('UPDATE users SET is_active = false WHERE id = $1 AND school_id = $2', [req.params.id, school_id]);
        return res.json({ message: 'User deactivated' });
    }
    catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
