// Dashboard Routes (Analytics & Metrics)
// GET /api/dashboard/:agencyId/overview      → Main dashboard metrics
// GET /api/dashboard/:agencyId/campaigns     → All campaigns
// GET /api/dashboard/:agencyId/trends        → Performance trends
// GET /api/dashboard/:agencyId/roi-analysis  → ROI metrics
// GET /api/dashboard/:agencyId/insights      → Audience insights

const express = require('express');
const { db, AppError, asyncHandler } = require('../database/db');
const { authenticateToken, requireAgencyAccess } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ---------------------
// GET /api/dashboard/:agencyId/overview
// Main dashboard with aggregated metrics
// ---------------------
router.get('/:agencyId/overview', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId } = req.params;
  const { startDate, endDate, days = 30 } = req.query;

  let whereClause = 'WHERE agency_id = $1';
  let params = [agencyId];
  let prevWhereClause = 'WHERE agency_id = $1';
  let prevParams = [agencyId];

  if (startDate && endDate) {
    whereClause += ' AND date >= $2 AND date <= $3';
    params.push(startDate, endDate);

    // Calculate previous period for MoM
    const start = new Date(startDate);
    const end = new Date(endDate);
    const duration = end - start;
    const prevEnd = new Date(start - 1);
    const prevStart = new Date(prevEnd - duration);
    
    prevWhereClause += ' AND date >= $2 AND date <= $3';
    prevParams.push(prevStart.toISOString().split('T')[0], prevEnd.toISOString().split('T')[0]);
  } else {
    whereClause += ' AND date >= CURRENT_DATE - $2::integer';
    params.push(parseInt(days));
    
    prevWhereClause += ' AND date >= CURRENT_DATE - ($2::integer * 2) AND date < CURRENT_DATE - $2::integer';
    prevParams.push(parseInt(days));
  }

  // Overall metrics for the period
  const metrics = await db.oneOrNone(
    `SELECT
       COALESCE(SUM(spend), 0) AS total_spend,
       COALESCE(SUM(revenue), 0) AS total_revenue,
       COALESCE(SUM(impressions), 0) AS total_impressions,
       COALESCE(SUM(clicks), 0) AS total_clicks,
       COALESCE(SUM(conversions), 0) AS total_conversions,
       CASE WHEN SUM(spend) > 0 THEN ROUND(SUM(revenue) / SUM(spend), 2) ELSE 0 END AS roas,
       CASE WHEN SUM(clicks) > 0 THEN ROUND(SUM(spend) / SUM(clicks), 2) ELSE 0 END AS avg_cpc,
       CASE WHEN SUM(conversions) > 0 THEN ROUND(SUM(spend) / SUM(conversions), 2) ELSE 0 END AS avg_cpa,
       CASE WHEN SUM(impressions) > 0 THEN ROUND((SUM(clicks)::numeric / SUM(impressions)) * 100, 2) ELSE 0 END AS avg_ctr
     FROM daily_metrics
     ${whereClause}`,
    params
  );

  // Previous period for comparison
  const previousMetrics = await db.oneOrNone(
    `SELECT
       COALESCE(SUM(spend), 0) AS total_spend,
       COALESCE(SUM(revenue), 0) AS total_revenue,
       COALESCE(SUM(conversions), 0) AS total_conversions
     FROM daily_metrics
     ${prevWhereClause}`,
    prevParams
  );

  // Agency info for budget pacing
  const agency = await db.oneOrNone('SELECT monthly_budget FROM agencies WHERE id = $1', [agencyId]);

  // Per-platform breakdown
  const platformBreakdown = await db.manyOrNone(
    `SELECT
       platform,
       COALESCE(SUM(spend), 0) AS spend,
       COALESCE(SUM(revenue), 0) AS revenue,
       COALESCE(SUM(impressions), 0) AS impressions,
       COALESCE(SUM(clicks), 0) AS clicks,
       COALESCE(SUM(conversions), 0) AS conversions
     FROM daily_metrics
     WHERE agency_id = $1 AND date >= CURRENT_DATE - $2::integer
     GROUP BY platform
     ORDER BY spend DESC`,
    [agencyId, days]
  );

  // Active campaigns count
  const activeCampaigns = await db.oneOrNone(
    `SELECT COUNT(*) AS count FROM campaigns
     WHERE agency_id = $1 AND status = 'active'`,
    [agencyId]
  );

  // Connected integrations count
  const connectedIntegrations = await db.oneOrNone(
    `SELECT COUNT(*) AS count FROM integrations
     WHERE agency_id = $1 AND status = 'connected'`,
    [agencyId]
  );

  // Calculate change percentages
  const calcChange = (current, previous) => {
    if (!previous || previous === 0) return 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  res.json({
    message: 'Dashboard overview retrieved',
    period: `${days} days`,
    overview: {
      totalSpend: parseFloat(metrics?.total_spend || 0),
      totalRevenue: parseFloat(metrics?.total_revenue || 0),
      totalImpressions: parseInt(metrics?.total_impressions || 0),
      totalClicks: parseInt(metrics?.total_clicks || 0),
      totalConversions: parseInt(metrics?.total_conversions || 0),
      roas: parseFloat(metrics?.roas || 0),
      avgCpc: parseFloat(metrics?.avg_cpc || 0),
      avgCpa: parseFloat(metrics?.avg_cpa || 0),
      avgCtr: parseFloat(metrics?.avg_ctr || 0),
      roi: metrics?.total_spend > 0
        ? Math.round(((metrics.total_revenue - metrics.total_spend) / metrics.total_spend) * 100)
        : 0,
      monthlyBudget: parseFloat(agency?.monthly_budget || 0)
    },
    changes: {
      spendChange: calcChange(metrics?.total_spend, previousMetrics?.total_spend),
      revenueChange: calcChange(metrics?.total_revenue, previousMetrics?.total_revenue),
      conversionsChange: calcChange(metrics?.total_conversions, previousMetrics?.total_conversions),
    },
    platformBreakdown,
    activeCampaigns: parseInt(activeCampaigns?.count || 0),
    connectedIntegrations: parseInt(connectedIntegrations?.count || 0),
  });
}));

// ---------------------
// GET /api/dashboard/:agencyId/campaigns
// All campaigns with filtering & pagination
// ---------------------
router.get('/:agencyId/campaigns', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId } = req.params;
  const {
    platform,
    status,
    search,
    sortBy = 'created_at',
    sortOrder = 'DESC',
    limit = 20,
    offset = 0,
  } = req.query;

  let whereClause = 'WHERE c.agency_id = $1';
  const params = [agencyId];
  let paramIndex = 2;

  if (platform) {
    whereClause += ` AND c.platform = $${paramIndex}`;
    params.push(platform);
    paramIndex++;
  }

  if (status) {
    whereClause += ` AND c.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (search) {
    whereClause += ` AND c.name ILIKE $${paramIndex}`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Validate sort column
  const validSortColumns = ['name', 'platform', 'status', 'budget_daily', 'created_at', 'updated_at'];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const campaigns = await db.manyOrNone(
    `SELECT c.id, c.platform, c.platform_campaign_id, c.name, c.status,
            c.objective, c.budget_daily, c.budget_total, c.currency,
            c.target_cpa, c.target_roas,
            c.start_date, c.end_date, c.created_at, c.updated_at,
            COALESCE(m.total_spend, 0) AS total_spend,
            COALESCE(m.total_impressions, 0) AS total_impressions,
            COALESCE(m.total_clicks, 0) AS total_clicks,
            COALESCE(m.total_conversions, 0) AS total_conversions,
            COALESCE(m.total_revenue, 0) AS total_revenue
     FROM campaigns c
     LEFT JOIN (
       SELECT campaign_id,
              SUM(spend) AS total_spend,
              SUM(impressions) AS total_impressions,
              SUM(clicks) AS total_clicks,
              SUM(conversions) AS total_conversions,
              SUM(revenue) AS total_revenue
       FROM daily_metrics
       WHERE agency_id = $1
       GROUP BY campaign_id
     ) m ON c.id = m.campaign_id
     ${whereClause}
     ORDER BY c.${sortColumn} ${order}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, parseInt(limit), parseInt(offset)]
  );

  const total = await db.one(
    `SELECT COUNT(*) FROM campaigns c ${whereClause}`,
    params
  );

  res.json({
    message: 'Campaigns retrieved',
    campaigns,
    pagination: {
      total: parseInt(total.count),
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: parseInt(offset) + parseInt(limit) < parseInt(total.count),
    },
  });
}));

// ---------------------
// GET /api/dashboard/:agencyId/trends
// Performance trends (time series data)
// ---------------------
router.get('/:agencyId/trends', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId } = req.params;
  const { startDate, endDate, days = 30, platform } = req.query;

  let whereClause = 'WHERE agency_id = $1';
  let params = [agencyId];
  let paramIndex = 2;

  if (startDate && endDate) {
    whereClause += ` AND date >= $${paramIndex} AND date <= $${paramIndex + 1}`;
    params.push(startDate, endDate);
    paramIndex += 2;
  } else {
    whereClause += ` AND date >= CURRENT_DATE - $${paramIndex}::integer`;
    params.push(parseInt(days));
    paramIndex++;
  }

  if (platform) {
    whereClause += ` AND platform = $${paramIndex}`;
    params.push(platform);
  }

  const trends = await db.manyOrNone(
    `SELECT
       date,
       SUM(spend) AS spend,
       SUM(revenue) AS revenue,
       SUM(impressions) AS impressions,
       SUM(clicks) AS clicks,
       SUM(conversions) AS conversions,
       CASE WHEN SUM(impressions) > 0
         THEN ROUND((SUM(clicks)::numeric / SUM(impressions)) * 100, 2)
         ELSE 0 END AS ctr,
       CASE WHEN SUM(clicks) > 0
         THEN ROUND(SUM(spend) / SUM(clicks), 2)
         ELSE 0 END AS cpc
     FROM daily_metrics
     ${whereClause}
     GROUP BY date
     ORDER BY date ASC`,
    params
  );

  res.json({
    message: 'Performance trends retrieved',
    period: `${days} days`,
    trends: trends.map((t) => ({
      date: t.date,
      spend: parseFloat(t.spend),
      revenue: parseFloat(t.revenue),
      impressions: parseInt(t.impressions),
      clicks: parseInt(t.clicks),
      conversions: parseInt(t.conversions),
      ctr: parseFloat(t.ctr),
      cpc: parseFloat(t.cpc),
    })),
  });
}));

// ---------------------
// GET /api/dashboard/:agencyId/roi-analysis
// ROI analysis per campaign and platform
// ---------------------
router.get('/:agencyId/roi-analysis', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId } = req.params;
  const days = parseInt(req.query.days) || 30;

  // ROI by platform
  const platformROI = await db.manyOrNone(
    `SELECT
       platform,
       SUM(spend) AS spend,
       SUM(revenue) AS revenue,
       SUM(conversions) AS conversions,
       CASE WHEN SUM(spend) > 0 THEN ROUND(SUM(revenue) / SUM(spend), 2) ELSE 0 END AS roas,
       CASE WHEN SUM(spend) > 0
         THEN ROUND(((SUM(revenue) - SUM(spend)) / SUM(spend)) * 100, 2)
         ELSE 0 END AS roi_percentage
     FROM daily_metrics
     WHERE agency_id = $1 AND date >= CURRENT_DATE - $2::integer
     GROUP BY platform
     ORDER BY roi_percentage DESC`,
    [agencyId, days]
  );

  // Top performing campaigns by ROI
  const topCampaigns = await db.manyOrNone(
    `SELECT
       c.name AS campaign_name,
       c.platform,
       SUM(m.spend) AS spend,
       SUM(m.revenue) AS revenue,
       SUM(m.conversions) AS conversions,
       CASE WHEN SUM(m.spend) > 0 THEN ROUND(SUM(m.revenue) / SUM(m.spend), 2) ELSE 0 END AS roas
     FROM daily_metrics m
     JOIN campaigns c ON m.campaign_id = c.id
     WHERE m.agency_id = $1 AND m.date >= CURRENT_DATE - $2::integer
     GROUP BY c.name, c.platform
     HAVING SUM(m.spend) > 0
     ORDER BY roas DESC
     LIMIT 10`,
    [agencyId, days]
  );

  res.json({
    message: 'ROI analysis retrieved',
    period: `${days} days`,
    platformROI: platformROI.map((p) => ({
      platform: p.platform,
      spend: parseFloat(p.spend),
      revenue: parseFloat(p.revenue),
      conversions: parseInt(p.conversions),
      roas: parseFloat(p.roas),
      roiPercentage: parseFloat(p.roi_percentage),
    })),
    topCampaigns: topCampaigns.map((c) => ({
      campaignName: c.campaign_name,
      platform: c.platform,
      spend: parseFloat(c.spend),
      revenue: parseFloat(c.revenue),
      conversions: parseInt(c.conversions),
      roas: parseFloat(c.roas),
    })),
  });
}));

// ---------------------
// GET /api/dashboard/:agencyId/insights
// Audience insights and recommendations
// ---------------------
router.get('/:agencyId/insights', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId } = req.params;
  const days = parseInt(req.query.days) || 30;

  // Best performing day of week
  const dayOfWeekPerformance = await db.manyOrNone(
    `SELECT
       EXTRACT(DOW FROM date) AS day_of_week,
       TO_CHAR(date, 'Day') AS day_name,
       AVG(conversions) AS avg_conversions,
       AVG(spend) AS avg_spend,
       CASE WHEN AVG(spend) > 0
         THEN ROUND(AVG(revenue) / AVG(spend), 2)
         ELSE 0 END AS avg_roas
     FROM daily_metrics
     WHERE agency_id = $1 AND date >= CURRENT_DATE - $2::integer
     GROUP BY EXTRACT(DOW FROM date), TO_CHAR(date, 'Day')
     ORDER BY avg_conversions DESC`,
    [agencyId, days]
  );

  // Campaigns that need attention (low ROAS or high spend with low conversions)
  const underperforming = await db.manyOrNone(
    `SELECT
       c.name AS campaign_name,
       c.platform,
       SUM(m.spend) AS total_spend,
       SUM(m.conversions) AS total_conversions,
       CASE WHEN SUM(m.spend) > 0 THEN ROUND(SUM(m.revenue) / SUM(m.spend), 2) ELSE 0 END AS roas
     FROM daily_metrics m
     JOIN campaigns c ON m.campaign_id = c.id
     WHERE m.agency_id = $1 AND m.date >= CURRENT_DATE - $2::integer
     GROUP BY c.name, c.platform
     HAVING SUM(m.spend) > 0 AND (SUM(m.revenue) / SUM(m.spend)) < 1
     ORDER BY total_spend DESC
     LIMIT 5`,
    [agencyId, days]
  );

  // Generate recommendations
  const recommendations = [];

  if (underperforming.length > 0) {
    recommendations.push({
      type: 'warning',
      title: 'Underperforming Campaigns',
      message: `${underperforming.length} campaign(s) have ROAS below 1.0. Consider pausing or optimizing them.`,
      campaigns: underperforming.map((c) => c.campaign_name),
    });
  }

  if (dayOfWeekPerformance.length > 0) {
    const bestDay = dayOfWeekPerformance[0];
    recommendations.push({
      type: 'tip',
      title: 'Best Performing Day',
      message: `${bestDay.day_name.trim()} tends to perform best with ${Math.round(bestDay.avg_conversions)} avg conversions. Consider increasing budgets on this day.`,
    });
  }

  res.json({
    message: 'Insights retrieved',
    period: `${days} days`,
    dayOfWeekPerformance: dayOfWeekPerformance.map((d) => ({
      dayOfWeek: parseInt(d.day_of_week),
      dayName: d.day_name.trim(),
      avgConversions: Math.round(parseFloat(d.avg_conversions)),
      avgSpend: parseFloat(d.avg_spend),
      avgRoas: parseFloat(d.avg_roas),
    })),
    underperformingCampaigns: underperforming.map((c) => ({
      campaignName: c.campaign_name,
      platform: c.platform,
      totalSpend: parseFloat(c.total_spend),
      totalConversions: parseInt(c.total_conversions),
      roas: parseFloat(c.roas),
    })),
    recommendations,
  });
}));

module.exports = router;
