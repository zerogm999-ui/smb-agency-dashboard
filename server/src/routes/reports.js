// Reports Routes (PDF Generation)
// POST   /api/reports/:agencyId/generate      → Generate PDF report
// GET    /api/reports/:agencyId               → List reports
// GET    /api/reports/:agencyId/:reportId     → Get report details
// GET    /api/reports/:agencyId/:reportId/download → Download PDF
// DELETE /api/reports/:agencyId/:reportId     → Delete report

const express = require('express');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { db, AppError, asyncHandler } = require('../database/db');
const { authenticateToken, requireAgencyAccess } = require('../middleware/auth');

const router = express.Router();

// Ensure reports directory exists
const REPORTS_DIR = path.join(__dirname, '..', '..', 'reports');
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// All routes require authentication
router.use(authenticateToken);

// ---------------------
// POST /api/reports/:agencyId/generate
// Generate a PDF report
// ---------------------
router.post('/:agencyId/generate', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId } = req.params;
  const {
    title,
    dateRangeStart,
    dateRangeEnd,
    platforms,
    type = 'performance',
  } = req.body;

  // Defaults
  const startDate = dateRangeStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = dateRangeEnd || new Date().toISOString().split('T')[0];
  const reportTitle = title || `Performance Report - ${startDate} to ${endDate}`;

  // Create report record
  const report = await db.one(
    `INSERT INTO reports (agency_id, title, type, status, date_range_start, date_range_end, platforms, created_by)
     VALUES ($1, $2, $3, 'generating', $4, $5, $6, $7)
     RETURNING id, title, type, status, date_range_start, date_range_end, created_at`,
    [agencyId, reportTitle, type, startDate, endDate, platforms || '{}', req.user.userId]
  );

  try {
    // Fetch agency info
    const agency = await db.one('SELECT name, email FROM agencies WHERE id = $1', [agencyId]);

    // Fetch metrics for the period
    const metrics = await db.oneOrNone(
      `SELECT
         COALESCE(SUM(spend), 0) AS total_spend,
         COALESCE(SUM(revenue), 0) AS total_revenue,
         COALESCE(SUM(impressions), 0) AS total_impressions,
         COALESCE(SUM(clicks), 0) AS total_clicks,
         COALESCE(SUM(conversions), 0) AS total_conversions
       FROM daily_metrics
       WHERE agency_id = $1 AND date >= $2 AND date <= $3`,
      [agencyId, startDate, endDate]
    );

    // Fetch campaigns data
    const campaigns = await db.manyOrNone(
      `SELECT
         c.name, c.platform, c.status,
         COALESCE(SUM(m.spend), 0) AS spend,
         COALESCE(SUM(m.revenue), 0) AS revenue,
         COALESCE(SUM(m.impressions), 0) AS impressions,
         COALESCE(SUM(m.clicks), 0) AS clicks,
         COALESCE(SUM(m.conversions), 0) AS conversions
       FROM campaigns c
       LEFT JOIN daily_metrics m ON c.id = m.campaign_id AND m.date >= $2 AND m.date <= $3
       WHERE c.agency_id = $1
       GROUP BY c.id, c.name, c.platform, c.status
       ORDER BY spend DESC
       LIMIT 20`,
      [agencyId, startDate, endDate]
    );

    // Generate PDF
    const fileName = `report_${report.id}.pdf`;
    const filePath = path.join(REPORTS_DIR, fileName);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // --- PDF Content ---

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('SMB Agency Dashboard', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(18).font('Helvetica').text(reportTitle, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#666').text(`Agency: ${agency.name} | Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(1);

    // Divider
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ddd');
    doc.moveDown(1);

    // Summary Metrics
    doc.fontSize(16).fillColor('#333').font('Helvetica-Bold').text('Summary Metrics');
    doc.moveDown(0.5);

    const summaryData = [
      ['Total Spend', `$${parseFloat(metrics?.total_spend || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
      ['Total Revenue', `$${parseFloat(metrics?.total_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
      ['Total Impressions', parseInt(metrics?.total_impressions || 0).toLocaleString()],
      ['Total Clicks', parseInt(metrics?.total_clicks || 0).toLocaleString()],
      ['Total Conversions', parseInt(metrics?.total_conversions || 0).toLocaleString()],
      ['ROAS', metrics?.total_spend > 0 ? `${(metrics.total_revenue / metrics.total_spend).toFixed(2)}x` : 'N/A'],
      ['ROI', metrics?.total_spend > 0 ? `${Math.round(((metrics.total_revenue - metrics.total_spend) / metrics.total_spend) * 100)}%` : 'N/A'],
    ];

    doc.fontSize(11).font('Helvetica');
    for (const [label, value] of summaryData) {
      doc.fillColor('#555').text(`${label}:`, 70, doc.y, { continued: true, width: 200 });
      doc.fillColor('#000').font('Helvetica-Bold').text(`  ${value}`);
      doc.font('Helvetica');
      doc.moveDown(0.3);
    }

    doc.moveDown(1);

    // Campaign Performance Table
    if (campaigns.length > 0) {
      doc.fontSize(16).fillColor('#333').font('Helvetica-Bold').text('Campaign Performance');
      doc.moveDown(0.5);

      // Table Header
      const tableTop = doc.y;
      const colWidths = [150, 70, 60, 65, 65, 85];
      const colX = [50, 200, 270, 330, 395, 460];
      const headers = ['Campaign', 'Platform', 'Spend', 'Clicks', 'Conv.', 'Revenue'];

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#fff');
      doc.rect(50, tableTop, 495, 20).fill('#4a90d9');

      headers.forEach((header, i) => {
        doc.fillColor('#fff').text(header, colX[i] + 5, tableTop + 5, { width: colWidths[i] - 10 });
      });

      // Table Rows
      let rowY = tableTop + 22;
      doc.font('Helvetica').fontSize(8).fillColor('#333');

      campaigns.forEach((campaign, index) => {
        if (rowY > 720) {
          doc.addPage();
          rowY = 50;
        }

        const bgColor = index % 2 === 0 ? '#f9f9f9' : '#ffffff';
        doc.rect(50, rowY, 495, 18).fill(bgColor);

        doc.fillColor('#333');
        doc.text(campaign.name.substring(0, 25), colX[0] + 5, rowY + 4, { width: colWidths[0] - 10 });
        doc.text(campaign.platform, colX[1] + 5, rowY + 4, { width: colWidths[1] - 10 });
        doc.text(`$${parseFloat(campaign.spend).toFixed(0)}`, colX[2] + 5, rowY + 4, { width: colWidths[2] - 10 });
        doc.text(parseInt(campaign.clicks).toLocaleString(), colX[3] + 5, rowY + 4, { width: colWidths[3] - 10 });
        doc.text(parseInt(campaign.conversions).toLocaleString(), colX[4] + 5, rowY + 4, { width: colWidths[4] - 10 });
        doc.text(`$${parseFloat(campaign.revenue).toFixed(0)}`, colX[5] + 5, rowY + 4, { width: colWidths[5] - 10 });

        rowY += 18;
      });
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).fillColor('#999')
      .text(`Report ID: ${report.id}`, 50, 750)
      .text(`Generated by SMB Agency Dashboard`, 50, 762);

    doc.end();

    // Wait for write to finish
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Get file size
    const stats = fs.statSync(filePath);

    // Update report record
    await db.none(
      `UPDATE reports SET
         status = 'completed',
         file_path = $1,
         file_size = $2
       WHERE id = $3`,
      [filePath, stats.size, report.id]
    );

    // Audit log
    await db.none(
      `INSERT INTO audit_logs (agency_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'generate_report', 'report', $3, $4)`,
      [agencyId, req.user.userId, report.id, JSON.stringify({ title: reportTitle, type })]
    );

    res.status(201).json({
      message: 'Report generated successfully',
      report: {
        id: report.id,
        title: reportTitle,
        type,
        status: 'completed',
        fileSize: stats.size,
        dateRangeStart: startDate,
        dateRangeEnd: endDate,
        createdAt: report.created_at,
      },
    });
  } catch (error) {
    // Mark report as failed
    await db.none(
      `UPDATE reports SET status = 'failed' WHERE id = $1`,
      [report.id]
    );
    throw new AppError(`Report generation failed: ${error.message}`, 500, 'REPORT_GENERATION_FAILED');
  }
}));

// ---------------------
// GET /api/reports/:agencyId
// List all reports for an agency
// ---------------------
router.get('/:agencyId', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId } = req.params;
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  const reports = await db.manyOrNone(
    `SELECT id, title, type, status, file_size,
            date_range_start, date_range_end, platforms, created_at
     FROM reports
     WHERE agency_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [agencyId, limit, offset]
  );

  const total = await db.one(
    'SELECT COUNT(*) FROM reports WHERE agency_id = $1',
    [agencyId]
  );

  res.json({
    message: 'Reports retrieved',
    reports,
    pagination: {
      total: parseInt(total.count),
      limit,
      offset,
      hasMore: offset + limit < parseInt(total.count),
    },
  });
}));

// ---------------------
// GET /api/reports/:agencyId/:reportId
// Get report details
// ---------------------
router.get('/:agencyId/:reportId', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId, reportId } = req.params;

  const report = await db.oneOrNone(
    `SELECT id, title, type, status, file_size, file_path,
            date_range_start, date_range_end, platforms, metadata, created_at
     FROM reports
     WHERE id = $1 AND agency_id = $2`,
    [reportId, agencyId]
  );

  if (!report) {
    throw new AppError('Report not found', 404, 'NOT_FOUND');
  }

  res.json({
    message: 'Report retrieved',
    report: {
      ...report,
      file_path: undefined, // Don't expose server file path
      downloadUrl: report.status === 'completed'
        ? `/api/reports/${agencyId}/${reportId}/download`
        : null,
    },
  });
}));

// ---------------------
// GET /api/reports/:agencyId/:reportId/download
// Download PDF report
// ---------------------
router.get('/:agencyId/:reportId/download', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId, reportId } = req.params;

  const report = await db.oneOrNone(
    `SELECT id, title, file_path, status FROM reports
     WHERE id = $1 AND agency_id = $2`,
    [reportId, agencyId]
  );

  if (!report) {
    throw new AppError('Report not found', 404, 'NOT_FOUND');
  }

  if (report.status !== 'completed') {
    throw new AppError('Report is not ready for download', 400, 'REPORT_NOT_READY');
  }

  if (!report.file_path || !fs.existsSync(report.file_path)) {
    throw new AppError('Report file not found on server', 404, 'FILE_NOT_FOUND');
  }

  const fileName = `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  const readStream = fs.createReadStream(report.file_path);
  readStream.pipe(res);
}));

// ---------------------
// DELETE /api/reports/:agencyId/:reportId
// Delete a report
// ---------------------
router.delete('/:agencyId/:reportId', requireAgencyAccess, asyncHandler(async (req, res) => {
  const { agencyId, reportId } = req.params;

  const report = await db.oneOrNone(
    'SELECT id, file_path FROM reports WHERE id = $1 AND agency_id = $2',
    [reportId, agencyId]
  );

  if (!report) {
    throw new AppError('Report not found', 404, 'NOT_FOUND');
  }

  // Delete file if it exists
  if (report.file_path && fs.existsSync(report.file_path)) {
    fs.unlinkSync(report.file_path);
  }

  // Delete database record
  await db.none('DELETE FROM reports WHERE id = $1', [reportId]);

  // Audit log
  await db.none(
    `INSERT INTO audit_logs (agency_id, user_id, action, resource_type, resource_id)
     VALUES ($1, $2, 'delete_report', 'report', $3)`,
    [agencyId, req.user.userId, reportId]
  );

  res.json({
    message: 'Report deleted successfully',
    deletedId: reportId,
  });
}));

module.exports = router;
