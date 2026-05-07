const express = require('express');
const { db, asyncHandler } = require('../database/db');
const { authenticateToken, requireAgencyAccess } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ---------------------
// GET /api/crm/:agencyId/funnel
// Get lead funnel metrics
// ---------------------
router.get('/:agencyId/funnel', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId } = req.params;

  const funnel = await db.manyOrNone(
    `SELECT status, COUNT(*) as count, SUM(value) as total_value
     FROM leads
     WHERE agency_id = $1
     GROUP BY status`,
    [agencyId]
  );

  // Normalize stages
  const stages = [
    { key: 'new', label: 'New Leads', color: '#5E6AD2' },
    { key: 'mql', label: 'MQLs', color: '#7C3AED' },
    { key: 'sql', label: 'SQLs', color: '#8B5CF6' },
    { key: 'deal', label: 'Deals', color: '#10B981' },
    { key: 'closed_won', label: 'Revenue Won', color: '#059669' }
  ];

  const data = stages.map(stage => {
    const found = funnel.find(f => f.status === stage.key);
    return {
      ...stage,
      count: parseInt(found?.count || 0),
      value: parseFloat(found?.total_value || 0)
    };
  });

  res.json({
    message: 'CRM funnel retrieved',
    funnel: data,
    totalLeads: data.reduce((acc, curr) => acc + curr.count, 0),
    totalRevenue: data.find(d => d.key === 'closed_won')?.value || 0
  });
}));

// ---------------------
// GET /api/crm/:agencyId/leads
// List recent leads
// ---------------------
router.get('/:agencyId/leads', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId } = req.params;
  const limit = req.query.limit || 10;

  const leads = await db.manyOrNone(
    `SELECT l.*, c.name as campaign_name
     FROM leads l
     LEFT JOIN campaigns c ON l.campaign_id = c.id
     WHERE l.agency_id = $1
     ORDER BY l.created_at DESC
     LIMIT $2`,
    [agencyId, limit]
  );

  res.json({
    message: 'Leads retrieved',
    leads
  });
}));

// ---------------------
// PATCH /api/crm/:agencyId/leads/:leadId
// Update lead status or value
// ---------------------
router.patch('/:agencyId/leads/:leadId', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId, leadId } = req.params;
  const { status, value } = req.body;

  const updatedLead = await db.oneOrNone(
    `UPDATE leads
     SET status = COALESCE($1, status),
         value = COALESCE($2, value),
         updated_at = NOW()
     WHERE id = $3 AND agency_id = $4
     RETURNING *`,
    [status, value, leadId, agencyId]
  );

  if (!updatedLead) {
    throw new AppError('Lead not found', 404, 'NOT_FOUND');
  }

  res.json({
    message: 'Lead updated',
    lead: updatedLead
  });
}));

module.exports = router;
