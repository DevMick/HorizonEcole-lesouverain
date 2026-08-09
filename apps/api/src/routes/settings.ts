import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { SettingsService, schoolSettingsSchema } from '../services/settings.service';
import { auditLogger } from '../middleware/auditTracking';

const router = Router();

// Get school settings
router.get('/school', authenticateToken, async (req, res) => {
  try {
    const settings = await SettingsService.getSchoolSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching school settings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch school settings' });
  }
});

// Update school settings
router.put('/school', authenticateToken, requireRole(['ADMIN']), validateRequest(schoolSettingsSchema), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const settings = await SettingsService.updateSchoolSettings(req.body);
    
    auditLogger.info('School settings updated', { userId, changes: req.body });

    res.json({ success: true, data: settings, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating school settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update school settings' });
  }
});

// Get payment modes
router.get('/payment-modes', authenticateToken, async (req, res) => {
  try {
    const paymentModes = await SettingsService.getPaymentModes();
    res.json({ success: true, data: paymentModes });
  } catch (error) {
    console.error('Error fetching payment modes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch payment modes' });
  }
});

// Get expense categories
router.get('/expense-categories', authenticateToken, async (req, res) => {
  try {
    const categories = await SettingsService.getExpenseCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching expense categories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch expense categories' });
  }
});

// Get revenue sources
router.get('/revenue-sources', authenticateToken, async (req, res) => {
  try {
    const sources = await SettingsService.getRevenueSources();
    res.json({ success: true, data: sources });
  } catch (error) {
    console.error('Error fetching revenue sources:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch revenue sources' });
  }
});

// Get all system configuration
router.get('/config', authenticateToken, async (req, res) => {
  try {
    const config = await SettingsService.getSystemConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('Error fetching system config:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch system configuration' });
  }
});

export default router;
