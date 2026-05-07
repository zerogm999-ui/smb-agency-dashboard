const { db, initializeDatabase } = require('./src/database/db');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
  console.log('🌱 Starting database seeding for advanced features...');

  try {
    // 0. Ensure schema exists
    await initializeDatabase();
    // 1. Clear existing data
    console.log('Clearing existing data...');
    await db.none(`
      TRUNCATE TABLE 
      audit_logs, scheduled_jobs, alerts, reports, sync_history, 
      daily_metrics, campaigns, integrations, users, agencies, leads
      RESTART IDENTITY CASCADE;
    `);

    // 2. Create Demo Agency with a Monthly Budget
    console.log('Creating demo agency and user...');
    const agency = await db.one(
      `INSERT INTO agencies (name, email, status, monthly_budget, created_at) 
       VALUES ('Acme Marketing', 'demo@agency.com', 'active', 15000.00, NOW() - INTERVAL '90 days')
       RETURNING id`
    );

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    await db.one(
      `INSERT INTO users (agency_id, name, email, password_hash, role) 
       VALUES ($1, 'Demo Admin', 'demo@agency.com', $2, 'admin')
       RETURNING id`,
      [agency.id, hashedPassword]
    );

    // 3. Create Integrations
    console.log('Setting up integrations...');
    const integrations = [];
    const platforms = ['google-ads', 'meta-ads', 'stripe'];
    
    for (const platform of platforms) {
      const integration = await db.one(
        `INSERT INTO integrations (agency_id, platform, status, last_sync_at) 
         VALUES ($1, $2, 'connected', NOW() - INTERVAL '2 hours')
         RETURNING id, platform`,
        [agency.id, platform]
      );
      integrations.push(integration);
    }

    // 4. Create Campaigns with Performance Targets
    console.log('Generating campaigns with performance targets...');
    const campaigns = [];
    const campaignNames = [
      { name: 'Search - Brand Terms', platform: 'google-ads', target_cpa: 15.00, target_roas: 4.50 },
      { name: 'Summer Retargeting', platform: 'meta-ads', target_cpa: 25.00, target_roas: 3.20 },
      { name: 'Display Network - Cold', platform: 'google-ads', target_cpa: 45.00, target_roas: 1.80 },
      { name: 'Lookalike 1% - US', platform: 'meta-ads', target_cpa: 20.00, target_roas: 3.80 },
      { name: 'Shopping - Electronics', platform: 'google-ads', target_cpa: 30.00, target_roas: 4.20 }
    ];

    for (const c of campaignNames) {
      const integration = integrations.find(i => i.platform === c.platform);
      if (integration) {
        const campaign = await db.one(
          `INSERT INTO campaigns (agency_id, integration_id, platform, platform_campaign_id, name, status, target_cpa, target_roas) 
           VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
           RETURNING id, platform`,
          [agency.id, integration.id, c.platform, `camp_${Math.random().toString(36).substring(7)}`, c.name, c.target_cpa, c.target_roas]
        );
        campaigns.push(campaign);
      }
    }

    // 5. Generate 60 days of metric data (for MoM comparison)
    console.log('Generating 60 days of metric data...');
    let currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - 60);

    for (let i = 0; i < 60; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      for (const campaign of campaigns) {
        // Base metrics
        let baseSpend = Math.random() * 200 + 100;
        let baseImpressions = Math.floor(Math.random() * 8000 + 2000);
        let baseClicks = Math.floor(baseImpressions * (Math.random() * 0.05 + 0.01));
        let baseConversions = Math.floor(baseClicks * (Math.random() * 0.1 + 0.02));
        let baseRevenue = baseConversions * (Math.random() * 200 + 50);

        // Add growth trend (higher in the second 30 days)
        const isSecondMonth = i >= 30;
        const trendMultiplier = isSecondMonth ? 1.15 + (i - 30) * 0.01 : 0.85 + i * 0.01;
        
        await db.none(
          `INSERT INTO daily_metrics (agency_id, campaign_id, platform, date, spend, impressions, clicks, conversions, revenue) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            agency.id, 
            campaign.id, 
            campaign.platform,
            dateStr, 
            baseSpend * trendMultiplier, 
            Math.floor(baseImpressions * trendMultiplier), 
            Math.floor(baseClicks * trendMultiplier), 
            Math.floor(baseConversions * trendMultiplier), 
            baseRevenue * trendMultiplier
          ]
        );
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 7. Generate Mock Leads for CRM Funnel
    console.log('Generating mock leads for CRM funnel...');
    const leadStatuses = [
      { status: 'new', weight: 40 },
      { status: 'mql', weight: 25 },
      { status: 'sql', weight: 15 },
      { status: 'deal', weight: 10 },
      { status: 'closed_won', weight: 7 },
      { status: 'closed_lost', weight: 3 }
    ];

    const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
    const companies = ['TechCorp', 'Starlight Inc', 'CloudScale', 'NextGen Solutions', 'Mainstream Co'];

    for (let i = 0; i < 200; i++) {
      // Pick random status based on weights
      let rand = Math.random() * 100;
      let cumulative = 0;
      let status = 'new';
      for (const s of leadStatuses) {
        cumulative += s.weight;
        if (rand <= cumulative) {
          status = s.status;
          break;
        }
      }

      const campaign = campaigns[Math.floor(Math.random() * campaigns.length)];
      const value = (status === 'deal' || status.startsWith('closed')) ? Math.random() * 5000 + 1000 : 0;
      
      await db.none(
        `INSERT INTO leads (agency_id, campaign_id, first_name, last_name, email, company, status, value, platform, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - INTERVAL '$10:raw days')`,
        [
          agency.id, 
          campaign.id, 
          firstNames[Math.floor(Math.random() * firstNames.length)],
          lastNames[Math.floor(Math.random() * lastNames.length)],
          `lead${i}@example.com`,
          companies[Math.floor(Math.random() * companies.length)],
          status,
          value,
          campaign.platform,
          Math.floor(Math.random() * 60)
        ]
      );
    }

    console.log('✅ Seeding completed successfully!');
    console.log('\n--- NEW FEATURE READY ---');
    console.log('Added: monthly_budget ($15k)');
    console.log('Added: target_cpa and target_roas per campaign');
    console.log('Added: 60 days of metrics for comparisons');
    console.log('---------------------------\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
