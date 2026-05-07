// Data Sync Routes
// POST /api/sync/:agencyId/all             → Sync all platforms
// POST /api/sync/:agencyId/:platform       → Sync specific platform
// GET  /api/sync/:agencyId/:syncId/status  → Check sync progress
// GET  /api/sync/:agencyId/recent          → Sync history
// GET  /api/sync/:agencyId/stats           → Sync statistics

const express = require('express');
const axios = require('axios');
const { db, AppError, asyncHandler } = require('../database/db');
const { authenticateToken, requireAgencyAccess } = require('../middleware/auth');
const { syncLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ---------------------
// Platform Sync Functions
// ---------------------

/**
 * Sync Google Ads data for an agency
 * Fetches campaigns and daily metrics via Google Ads API
 */
async function syncGoogleAds(agencyId, integrationId, accessToken) {
  let recordsSynced = 0;
  try {
    // Google Ads API: Fetch campaigns
    const campaignsResponse = await axios.get(
      'https://googleads.googleapis.com/v15/customers/' + (await db.oneOrNone('SELECT account_id FROM integrations WHERE id = $1', [integrationId]))?.account_id + '/campaigns',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': process.env.GOOGLE_DEVELOPER_TOKEN,
        },
      }
    ).catch(() => ({ data: { results: [] } }));

    const campaigns = campaignsResponse.data.results || [];

    for (const campaign of campaigns) {
      // Upsert campaign
      const dbCampaign = await db.one(
        `INSERT INTO campaigns (agency_id, integration_id, platform, platform_campaign_id, name, status, budget_daily)
         VALUES ($1, $2, 'google-ads', $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           status = EXCLUDED.status,
           budget_daily = EXCLUDED.budget_daily,
           updated_at = NOW()
         RETURNING id`,
        [
          agencyId, integrationId,
          campaign.campaign?.resourceName || `gads-${Date.now()}`,
          campaign.campaign?.name || 'Unnamed Campaign',
          campaign.campaign?.status || 'active',
          campaign.campaign?.campaignBudget?.amountMicros ? campaign.campaign.campaignBudget.amountMicros / 1000000 : 0,
        ]
      );

      // Insert daily metrics (today's data)
      const today = new Date().toISOString().split('T')[0];
      await db.none(
        `INSERT INTO daily_metrics (agency_id, campaign_id, platform, date, impressions, clicks, conversions, spend, revenue)
         VALUES ($1, $2, 'google-ads', $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [
          agencyId, dbCampaign.id, today,
          campaign.metrics?.impressions || 0,
          campaign.metrics?.clicks || 0,
          campaign.metrics?.conversions || 0,
          campaign.metrics?.costMicros ? campaign.metrics.costMicros / 1000000 : 0,
          campaign.metrics?.conversionsValue || 0,
        ]
      );

      recordsSynced++;
    }

    return recordsSynced;
  } catch (error) {
    console.error('Google Ads sync error:', error.message);
    throw error;
  }
}

/**
 * Sync Meta Ads data for an agency
 * Fetches campaigns and insights via Meta Graph API
 */
async function syncMetaAds(agencyId, integrationId, accessToken) {
  let recordsSynced = 0;
  try {
    const accountId = (await db.oneOrNone('SELECT account_id FROM integrations WHERE id = $1', [integrationId]))?.account_id;

    // Meta Graph API: Fetch campaigns
    const campaignsResponse = await axios.get(
      `https://graph.facebook.com/v18.0/act_${accountId}/campaigns`,
      {
        params: {
          fields: 'id,name,status,objective,daily_budget,lifetime_budget',
          access_token: accessToken,
        },
      }
    ).catch(() => ({ data: { data: [] } }));

    const campaigns = campaignsResponse.data.data || [];

    for (const campaign of campaigns) {
      const dbCampaign = await db.one(
        `INSERT INTO campaigns (agency_id, integration_id, platform, platform_campaign_id, name, status, objective, budget_daily)
         VALUES ($1, $2, 'meta-ads', $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           status = EXCLUDED.status,
           updated_at = NOW()
         RETURNING id`,
        [
          agencyId, integrationId,
          campaign.id,
          campaign.name || 'Unnamed Campaign',
          (campaign.status || 'active').toLowerCase(),
          campaign.objective || null,
          campaign.daily_budget ? campaign.daily_budget / 100 : 0,
        ]
      );

      // Fetch insights for this campaign
      const insightsResponse = await axios.get(
        `https://graph.facebook.com/v18.0/${campaign.id}/insights`,
        {
          params: {
            fields: 'impressions,clicks,conversions,spend,actions',
            date_preset: 'today',
            access_token: accessToken,
          },
        }
      ).catch(() => ({ data: { data: [] } }));

      const insights = insightsResponse.data.data?.[0];
      if (insights) {
        const today = new Date().toISOString().split('T')[0];
        await db.none(
          `INSERT INTO daily_metrics (agency_id, campaign_id, platform, date, impressions, clicks, conversions, spend)
           VALUES ($1, $2, 'meta-ads', $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [
            agencyId, dbCampaign.id, today,
            parseInt(insights.impressions) || 0,
            parseInt(insights.clicks) || 0,
            parseInt(insights.conversions) || 0,
            parseFloat(insights.spend) || 0,
          ]
        );
      }

      recordsSynced++;
    }

    return recordsSynced;
  } catch (error) {
    console.error('Meta Ads sync error:', error.message);
    throw error;
  }
}

/**
 * Sync Stripe revenue data
 * Fetches charges and calculates daily revenue
 */
async function syncStripe(agencyId, integrationId, accessToken) {
  let recordsSynced = 0;
  try {
    // Stripe API: Fetch recent charges
    const chargesResponse = await axios.get(
      'https://api.stripe.com/v1/charges',
      {
        params: { limit: 100 },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    ).catch(() => ({ data: { data: [] } }));

    const charges = chargesResponse.data.data || [];

    // Group charges by date
    const dailyTotals = {};
    for (const charge of charges) {
      const date = new Date(charge.created * 1000).toISOString().split('T')[0];
      if (!dailyTotals[date]) {
        dailyTotals[date] = { revenue: 0, count: 0, refunds: 0 };
      }
      if (charge.status === 'succeeded') {
        dailyTotals[date].revenue += charge.amount / 100;
        dailyTotals[date].count += 1;
      }
      if (charge.refunded) {
        dailyTotals[date].refunds += charge.amount_refunded / 100;
      }
    }

    // Store daily revenue as metrics
    for (const [date, totals] of Object.entries(dailyTotals)) {
      await db.none(
        `INSERT INTO daily_metrics (agency_id, platform, date, revenue, conversions, spend, metadata)
         VALUES ($1, 'stripe', $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [
          agencyId, date,
          totals.revenue,
          totals.count,
          totals.refunds,
          JSON.stringify({ transactions: totals.count, refunds: totals.refunds }),
        ]
      );
      recordsSynced++;
    }

    return recordsSynced;
  } catch (error) {
    console.error('Stripe sync error:', error.message);
    throw error;
  }
}

/**
 * Sync HubSpot CRM data
 * Fetches deals and contacts
 */
async function syncHubSpot(agencyId, integrationId, accessToken) {
  let recordsSynced = 0;
  try {
    // HubSpot API: Fetch deals
    const dealsResponse = await axios.get(
      'https://api.hubapi.com/crm/v3/objects/deals',
      {
        params: {
          limit: 100,
          properties: 'dealname,amount,dealstage,closedate,pipeline',
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    ).catch(() => ({ data: { results: [] } }));

    const deals = dealsResponse.data.results || [];

    for (const deal of deals) {
      const date = deal.properties?.closedate
        ? new Date(deal.properties.closedate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      await db.none(
        `INSERT INTO daily_metrics (agency_id, platform, date, revenue, conversions, metadata)
         VALUES ($1, 'hubspot', $2, $3, 1, $4)
         ON CONFLICT DO NOTHING`,
        [
          agencyId, date,
          parseFloat(deal.properties?.amount) || 0,
          JSON.stringify({
            dealName: deal.properties?.dealname,
            stage: deal.properties?.dealstage,
            pipeline: deal.properties?.pipeline,
          }),
        ]
      );
      recordsSynced++;
    }

    // Fetch contacts count
    const contactsResponse = await axios.get(
      'https://api.hubapi.com/crm/v3/objects/contacts',
      {
        params: { limit: 1 },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    ).catch(() => ({ data: { total: 0 } }));

    return recordsSynced;
  } catch (error) {
    console.error('HubSpot sync error:', error.message);
    throw error;
  }
}

// Map of platform sync functions
const syncFunctions = {
  'google-ads': syncGoogleAds,
  'meta-ads': syncMetaAds,
  'stripe': syncStripe,
  'hubspot': syncHubSpot,
};

// ---------------------
// POST /api/sync/:agencyId/all
// Sync all connected platforms
// ---------------------
router.post('/:agencyId/all', requireAgencyAccess, syncLimiter, asyncHandler(async (req, res) => {
  const { agencyId } = req.params;

  // Get all connected integrations
  const integrations = await db.manyOrNone(
    `SELECT id, platform, access_token FROM integrations
     WHERE agency_id = $1 AND status = 'connected'`,
    [agencyId]
  );

  if (integrations.length === 0) {
    return res.json({
      message: 'No connected integrations to sync',
      results: [],
    });
  }

  const results = [];

  for (const integration of integrations) {
    // Create sync record
    const syncRecord = await db.one(
      `INSERT INTO sync_history (agency_id, integration_id, platform, status)
       VALUES ($1, $2, $3, 'running')
       RETURNING id`,
      [agencyId, integration.id, integration.platform]
    );

    try {
      const syncFn = syncFunctions[integration.platform];
      const startTime = Date.now();
      const recordsSynced = syncFn
        ? await syncFn(agencyId, integration.id, integration.access_token)
        : 0;
      const duration = Date.now() - startTime;

      // Update sync record as completed
      await db.none(
        `UPDATE sync_history SET
           status = 'completed',
           records_synced = $1,
           completed_at = NOW(),
           duration_ms = $2
         WHERE id = $3`,
        [recordsSynced, duration, syncRecord.id]
      );

      // Update integration last_sync_at
      await db.none(
        'UPDATE integrations SET last_sync_at = NOW() WHERE id = $1',
        [integration.id]
      );

      results.push({
        platform: integration.platform,
        status: 'completed',
        recordsSynced,
        durationMs: duration,
        syncId: syncRecord.id,
      });
    } catch (error) {
      // Update sync record as failed
      await db.none(
        `UPDATE sync_history SET
           status = 'failed',
           error_message = $1,
           completed_at = NOW()
         WHERE id = $2`,
        [error.message, syncRecord.id]
      );

      // Update integration error
      await db.none(
        `UPDATE integrations SET error_message = $1, updated_at = NOW() WHERE id = $2`,
        [error.message, integration.id]
      );

      results.push({
        platform: integration.platform,
        status: 'failed',
        error: error.message,
        syncId: syncRecord.id,
      });
    }
  }

  res.json({
    message: 'Sync completed',
    results,
    totalPlatforms: results.length,
    successful: results.filter((r) => r.status === 'completed').length,
    failed: results.filter((r) => r.status === 'failed').length,
  });
}));

// ---------------------
// POST /api/sync/:agencyId/:platform
// Sync a specific platform
// ---------------------
router.post('/:agencyId/:platform', requireAgencyAccess, syncLimiter, asyncHandler(async (req, res) => {
  const { agencyId, platform } = req.params;

  // Validate platform
  const validPlatforms = ['google-ads', 'meta-ads', 'stripe', 'hubspot'];
  if (!validPlatforms.includes(platform)) {
    throw new AppError(`Invalid platform: ${platform}`, 400, 'INVALID_PLATFORM');
  }

  // Get integration
  const integration = await db.oneOrNone(
    `SELECT id, access_token FROM integrations
     WHERE agency_id = $1 AND platform = $2 AND status = 'connected'`,
    [agencyId, platform]
  );

  if (!integration) {
    throw new AppError(`${platform} is not connected`, 400, 'INTEGRATION_NOT_CONNECTED');
  }

  // Create sync record
  const syncRecord = await db.one(
    `INSERT INTO sync_history (agency_id, integration_id, platform, status)
     VALUES ($1, $2, $3, 'running')
     RETURNING id`,
    [agencyId, integration.id, platform]
  );

  try {
    const syncFn = syncFunctions[platform];
    const startTime = Date.now();
    const recordsSynced = syncFn
      ? await syncFn(agencyId, integration.id, integration.access_token)
      : 0;
    const duration = Date.now() - startTime;

    await db.none(
      `UPDATE sync_history SET
         status = 'completed',
         records_synced = $1,
         completed_at = NOW(),
         duration_ms = $2
       WHERE id = $3`,
      [recordsSynced, duration, syncRecord.id]
    );

    await db.none(
      'UPDATE integrations SET last_sync_at = NOW(), error_message = NULL WHERE id = $1',
      [integration.id]
    );

    res.json({
      message: `${platform} sync completed`,
      syncId: syncRecord.id,
      platform,
      status: 'completed',
      recordsSynced,
      durationMs: duration,
    });
  } catch (error) {
    await db.none(
      `UPDATE sync_history SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2`,
      [error.message, syncRecord.id]
    );

    throw new AppError(`Sync failed for ${platform}: ${error.message}`, 500, 'SYNC_FAILED');
  }
}));

// ---------------------
// GET /api/sync/:agencyId/:syncId/status
// Check sync progress
// ---------------------
router.get('/:agencyId/:syncId/status', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId, syncId } = req.params;

  const sync = await db.oneOrNone(
    `SELECT id, platform, status, records_synced, error_message,
            started_at, completed_at, duration_ms
     FROM sync_history
     WHERE id = $1 AND agency_id = $2`,
    [syncId, agencyId]
  );

  if (!sync) {
    throw new AppError('Sync record not found', 404, 'NOT_FOUND');
  }

  res.json({
    message: 'Sync status retrieved',
    sync,
  });
}));

// ---------------------
// GET /api/sync/:agencyId/recent
// Sync history (last 20 syncs)
// ---------------------
router.get('/:agencyId/recent', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId } = req.params;
  const limit = parseInt(req.query.limit) || 20;

  const history = await db.manyOrNone(
    `SELECT id, platform, status, records_synced, error_message,
            started_at, completed_at, duration_ms
     FROM sync_history
     WHERE agency_id = $1
     ORDER BY started_at DESC
     LIMIT $2`,
    [agencyId, limit]
  );

  res.json({
    message: 'Sync history retrieved',
    history,
    total: history.length,
  });
}));

// ---------------------
// GET /api/sync/:agencyId/stats
// Sync statistics
// ---------------------
router.get('/:agencyId/stats', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId } = req.params;

  const stats = await db.one(
    `SELECT
       COUNT(*) AS total_syncs,
       COUNT(*) FILTER (WHERE status = 'completed') AS successful_syncs,
       COUNT(*) FILTER (WHERE status = 'failed') AS failed_syncs,
       SUM(records_synced) AS total_records_synced,
       AVG(duration_ms) AS avg_duration_ms,
       MAX(completed_at) AS last_sync_at
     FROM sync_history
     WHERE agency_id = $1`,
    [agencyId]
  );

  res.json({
    message: 'Sync statistics retrieved',
    stats: {
      totalSyncs: parseInt(stats.total_syncs),
      successfulSyncs: parseInt(stats.successful_syncs),
      failedSyncs: parseInt(stats.failed_syncs),
      totalRecordsSynced: parseInt(stats.total_records_synced) || 0,
      avgDurationMs: Math.round(parseFloat(stats.avg_duration_ms) || 0),
      lastSyncAt: stats.last_sync_at,
      successRate: stats.total_syncs > 0
        ? Math.round((stats.successful_syncs / stats.total_syncs) * 100)
        : 0,
    },
  });
}));

module.exports = router;
