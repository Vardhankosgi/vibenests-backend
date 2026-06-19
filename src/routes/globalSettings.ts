import { Router } from 'express';
import { getSettingsMap, upsertSettings } from '../services/globalSettings.service';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Get public settings (no auth required)
router.get('/public', async (req, res) => {
  try {
    const settings = await getSettingsMap(true);
    res.json(settings);
  } catch (err: any) {
    console.error('Error fetching public settings:', err);
    res.status(500).json({ message: 'Failed to fetch public settings' });
  }
});

// Get all settings (Admin only)
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const settings = await getSettingsMap(false);
    res.json(settings);
  } catch (err: any) {
    console.error('Error fetching admin settings:', err);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

// Upsert settings (Admin only)
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const settingsMap = req.body;
    await upsertSettings(settingsMap);
    res.json({ message: 'Settings updated successfully' });
  } catch (err: any) {
    console.error('Error updating admin settings:', err);
    res.status(500).json({ message: 'Failed to update settings' });
  }
});

export default router;
