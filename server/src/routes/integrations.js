// Integrations Routes (OAuth Flows)
// GET    /api/integrations/:agencyId           → List all integrations
// POST   /api/integrations/:agencyId/google-ads/authorize  → Google OAuth
// POST   /api/integrations/:agencyId/meta-ads/authorize    → Meta OAuth
// POST   /api/integrations/:agencyId/stripe/authorize      → Stripe setup
// POST   /api/integrations/:agencyId/hubspot/authorize     → HubSpot setup
// DELETE /api/integrations/:agencyId/:integrationId        → Disconnect

const express = require('express');
const { db, AppError, asyncHandler } = require('../database/db');
const { authenticateToken, requireAgencyAccess } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ---------------------
// GET /api/integrations/:agencyId
// List all integrations for an agency
// ---------------------
router.get('/:agencyId', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId } = req.params;

  const integrations = await db.manyOrNone(
    `SELECT id, platform, status, account_id, account_name,
            last_sync_at, error_message, created_at, updated_at
     FROM integrations
     WHERE agency_id = $1
     ORDER BY platform`,
    [agencyId]
  );

  // Return all platforms with status (even if not connected)
  const allPlatforms = ['google-ads', 'meta-ads', 'stripe', 'hubspot'];
  const result = allPlatforms.map((platform) => {
    const existing = integrations.find((i) => i.platform === platform);
    return existing || {
      id: null,
      platform,
      status: 'disconnected',
      account_id: null,
      account_name: null,
      last_sync_at: null,
      error_message: null,
      created_at: null,
      updated_at: null,
    };
  });

  res.json({
    message: 'Integrations retrieved',
    integrations: result,
    total: integrations.length,
    connected: integrations.filter((i) => i.status === 'connected').length,
  });
}));

// ---------------------
// POST /api/integrations/:agencyId/google-ads/authorize
// Start Google Ads OAuth flow
// ---------------------
router.post('/:agencyId/google-ads/authorize', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId } = req.params;
  const { code, accessToken, refreshToken, accountId, accountName } = req.body;

  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback';

  // If no code/token provided, return the OAuth URL for the client to redirect to
  if (!code && !accessToken) {
    const scopes = encodeURIComponent('https://www.googleapis.com/auth/adwords');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent`;

    return res.json({
      message: 'Redirect user to authorization URL',
      authUrl,
      platform: 'google-ads',
    });
  }

  // If code or tokens provided, store the integration
  // In production, you'd exchange the code for tokens using Google's token endpoint
  const integration = await db.one(
    `INSERT INTO integrations (agency_id, platform, status, access_token, refresh_token, account_id, account_name, scopes)
     VALUES ($1, 'google-ads', 'connected', $2, $3, $4, $5, 'adwords')
     ON CONFLICT (agency_id, platform) DO UPDATE SET
       status = 'connected',
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       account_id = EXCLUDED.account_id,
       account_name = EXCLUDED.account_name,
       error_message = NULL,
       updated_at = NOW()
     RETURNING id, platform, status, account_id, account_name, created_at`,
    [agencyId, accessToken || code, refreshToken || null, accountId || null, accountName || 'Google Ads Account']
  );

  // Audit log
  await db.none(
    `INSERT INTO audit_logs (agency_id, user_id, action, resource_type, resource_id, details)
     VALUES ($1, $2, 'connect_integration', 'integration', $3, $4)`,
    [agencyId, req.user.userId, integration.id, JSON.stringify({ platform: 'google-ads' })]
  );

  res.json({
    message: 'Google Ads connected successfully',
    integration,
  });
}));

// ---------------------
// POST /api/integrations/:agencyId/meta-ads/authorize
// Start Meta Ads OAuth flow
// ---------------------
router.post('/:agencyId/meta-ads/authorize', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId } = req.params;
  const { code, accessToken, refreshToken, accountId, accountName } = req.body;

  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI || 'http://localhost:5000/api/auth/meta/callback';

  // If no code/token provided, return the OAuth URL
  if (!code && !accessToken) {
    const scopes = encodeURIComponent('ads_read,ads_management,business_management');
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code`;

    return res.json({
      message: 'Redirect user to authorization URL',
      authUrl,
      platform: 'meta-ads',
    });
  }

  // Store the integration
  const integration = await db.one(
    `INSERT INTO integrations (agency_id, platform, status, access_token, refresh_token, account_id, account_name, scopes)
     VALUES ($1, 'meta-ads', 'connected', $2, $3, $4, $5, 'ads_read,ads_management')
     ON CONFLICT (agency_id, platform) DO UPDATE SET
       status = 'connected',
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       account_id = EXCLUDED.account_id,
       account_name = EXCLUDED.account_name,
       error_message = NULL,
       updated_at = NOW()
     RETURNING id, platform, status, account_id, account_name, created_at`,
    [agencyId, accessToken || code, refreshToken || null, accountId || null, accountName || 'Meta Ads Account']
  );

  await db.none(
    `INSERT INTO audit_logs (agency_id, user_id, action, resource_type, resource_id, details)
     VALUES ($1, $2, 'connect_integration', 'integration', $3, $4)`,
    [agencyId, req.user.userId, integration.id, JSON.stringify({ platform: 'meta-ads' })]
  );

  res.json({
    message: 'Meta Ads connected successfully',
    integration,
  });
}));

// ---------------------
// POST /api/integrations/:agencyId/stripe/authorize
// Set up Stripe integration
// ---------------------
router.post('/:agencyId/stripe/authorize', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId } = req.params;
  const { apiKey, accountId, accountName } = req.body;

  if (!apiKey) {
    throw new AppError('Stripe API key is required', 400, 'VALIDATION_ERROR');
  }

  const integration = await db.one(
    `INSERT INTO integrations (agency_id, platform, status, access_token, account_id, account_name)
     VALUES ($1, 'stripe', 'connected', $2, $3, $4)
     ON CONFLICT (agency_id, platform) DO UPDATE SET
       status = 'connected',
       access_token = EXCLUDED.access_token,
       account_id = EXCLUDED.account_id,
       account_name = EXCLUDED.account_name,
       error_message = NULL,
       updated_at = NOW()
     RETURNING id, platform, status, account_id, account_name, created_at`,
    [agencyId, apiKey, accountId || null, accountName || 'Stripe Account']
  );

  await db.none(
    `INSERT INTO audit_logs (agency_id, user_id, action, resource_type, resource_id, details)
     VALUES ($1, $2, 'connect_integration', 'integration', $3, $4)`,
    [agencyId, req.user.userId, integration.id, JSON.stringify({ platform: 'stripe' })]
  );

  res.json({
    message: 'Stripe connected successfully',
    integration,
  });
}));

// ---------------------
// POST /api/integrations/:agencyId/hubspot/authorize
// Set up HubSpot integration
// ---------------------
router.post('/:agencyId/hubspot/authorize', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId } = req.params;
  const { code, accessToken, refreshToken, accountId, accountName } = req.body;

  const appId = process.env.HUBSPOT_APP_ID;
  const redirectUri = process.env.HUBSPOT_REDIRECT_URI || 'http://localhost:5000/api/auth/hubspot/callback';

  // If no code/token provided, return the OAuth URL
  if (!code && !accessToken) {
    const scopes = encodeURIComponent('crm.objects.contacts.read crm.objects.deals.read');
    const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}`;

    return res.json({
      message: 'Redirect user to authorization URL',
      authUrl,
      platform: 'hubspot',
    });
  }

  const integration = await db.one(
    `INSERT INTO integrations (agency_id, platform, status, access_token, refresh_token, account_id, account_name, scopes)
     VALUES ($1, 'hubspot', 'connected', $2, $3, $4, $5, 'crm.objects.contacts.read,crm.objects.deals.read')
     ON CONFLICT (agency_id, platform) DO UPDATE SET
       status = 'connected',
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       account_id = EXCLUDED.account_id,
       account_name = EXCLUDED.account_name,
       error_message = NULL,
       updated_at = NOW()
     RETURNING id, platform, status, account_id, account_name, created_at`,
    [agencyId, accessToken || code, refreshToken || null, accountId || null, accountName || 'HubSpot Account']
  );

  await db.none(
    `INSERT INTO audit_logs (agency_id, user_id, action, resource_type, resource_id, details)
     VALUES ($1, $2, 'connect_integration', 'integration', $3, $4)`,
    [agencyId, req.user.userId, integration.id, JSON.stringify({ platform: 'hubspot' })]
  );

  res.json({
    message: 'HubSpot connected successfully',
    integration,
  });
}));

// ---------------------
// DELETE /api/integrations/:agencyId/:integrationId
// Disconnect an integration
// ---------------------
router.delete('/:agencyId/:integrationId', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId, integrationId } = req.params;

  const integration = await db.oneOrNone(
    `UPDATE integrations SET
       status = 'disconnected',
       access_token = NULL,
       refresh_token = NULL,
       error_message = NULL,
       updated_at = NOW()
     WHERE id = $1 AND agency_id = $2
     RETURNING id, platform, status`,
    [integrationId, agencyId]
  );

  if (!integration) {
    throw new AppError('Integration not found', 404, 'NOT_FOUND');
  }

  await db.none(
    `INSERT INTO audit_logs (agency_id, user_id, action, resource_type, resource_id, details)
     VALUES ($1, $2, 'disconnect_integration', 'integration', $3, $4)`,
    [agencyId, req.user.userId, integrationId, JSON.stringify({ platform: integration.platform })]
  );

  res.json({
    message: `${integration.platform} disconnected successfully`,
    integration,
  });
}));

module.exports = router;
