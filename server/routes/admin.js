import express from 'express';
import { db } from '../config/firebase.js';
import { verifyAdmin, verifySuperAdmin } from '../middleware/auth.js';
import { RevenueService } from '../services/revenueService.js';
import { FraudService } from '../services/fraudService.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Dashboard overview
router.get('/dashboard/overview', verifyAdmin, async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const creatorsSnapshot = await db.collection('creators').get();
    const videosSnapshot = await db.collection('videos').get();
    const fraudAlertsSnapshot = await db.collection('fraudAlerts')
      .where('status', '==', 'pending')
      .get();

    const reportsSnapshot = await db.collection('reports')
      .where('status', '==', 'pending')
      .get();

    const revenueSummary = await RevenueService.getPlatformRevenueSummary();

    const overview = {
      users: usersSnapshot.size,
      creators: creatorsSnapshot.size,
      videos: videosSnapshot.size,
      fraudAlerts: fraudAlertsSnapshot.size,
      pendingReports: reportsSnapshot.size,
      revenue: revenueSummary,
    };

    res.json(overview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User management
router.get('/users', verifyAdmin, async (req, res) => {
  try {
    const { search, role, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = db.collection('users');

    if (role) {
      query = query.where('role', '==', role);
    }

    const snapshot = await query.limit(parseInt(limit) + 1).get();
    let users = snapshot.docs.map(doc => doc.data());

    // Simple client-side search if needed
    if (search) {
      users = users.filter(u =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.username?.toLowerCase().includes(search.toLowerCase())
      );
    }

    const paginated = users.slice(offset).slice(0, limit);
    const hasMore = users.length > offset + parseInt(limit);

    res.json({ users: paginated, hasMore });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user details
router.get('/users/:userId', verifyAdmin, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.params.userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userDoc.data();

    // Get fraud alerts
    const fraudAlerts = await FraudService.getUserFraudAlerts(req.params.userId);

    // Get watch activity
    const watchSessions = await db.collection('watchSessions')
      .where('userId', '==', req.params.userId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    res.json({
      user,
      fraudAlerts,
      recentActivity: watchSessions.docs.map(doc => doc.data()),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Suspend user
router.put('/users/:userId/suspend', verifyAdmin, async (req, res) => {
  try {
    const { reason } = req.body;

    await db.collection('users').doc(req.params.userId).update({
      status: 'suspended',
      suspensionReason: reason,
      suspendedAt: new Date(),
      suspendedBy: req.userId,
    });

    // Log action
    await db.collection('adminLogs').add({
      action: 'user_suspended',
      userId: req.params.userId,
      adminId: req.userId,
      reason,
      timestamp: new Date(),
    });

    res.json({ message: 'User suspended successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restore user
router.put('/users/:userId/restore', verifyAdmin, async (req, res) => {
  try {
    await db.collection('users').doc(req.params.userId).update({
      status: 'active',
      suspensionReason: null,
      suspendedAt: null,
      restoredAt: new Date(),
      restoredBy: req.userId,
    });

    // Log action
    await db.collection('adminLogs').add({
      action: 'user_restored',
      userId: req.params.userId,
      adminId: req.userId,
      timestamp: new Date(),
    });

    res.json({ message: 'User restored successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Change user role
router.put('/users/:userId/role', verifyAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['USER', 'CREATOR', 'PREMIUM_CREATOR', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    await db.collection('users').doc(req.params.userId).update({
      role,
      roleUpdatedAt: new Date(),
      roleUpdatedBy: req.userId,
    });

    // Log action
    await db.collection('adminLogs').add({
      action: 'user_role_changed',
      userId: req.params.userId,
      adminId: req.userId,
      newRole: role,
      timestamp: new Date(),
    });

    res.json({ message: 'User role updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Video management
router.get('/videos', verifyAdmin, async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const snapshot = await db.collection('videos')
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit) + 1)
      .get();

    const videos = snapshot.docs.slice(offset).slice(0, limit).map(doc => doc.data());
    const hasMore = snapshot.docs.length > parseInt(limit);

    res.json({ videos, hasMore });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve video
router.put('/videos/:videoId/approve', verifyAdmin, async (req, res) => {
  try {
    await db.collection('videos').doc(req.params.videoId).update({
      status: 'approved',
      approvedAt: new Date(),
      approvedBy: req.userId,
    });

    res.json({ message: 'Video approved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject video
router.put('/videos/:videoId/reject', verifyAdmin, async (req, res) => {
  try {
    const { reason } = req.body;

    await db.collection('videos').doc(req.params.videoId).update({
      status: 'rejected',
      rejectedReason: reason,
      rejectedAt: new Date(),
      rejectedBy: req.userId,
    });

    res.json({ message: 'Video rejected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Withdrawal management
router.get('/withdrawals', verifyAdmin, async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const snapshot = await db.collection('withdrawals')
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit) + 1)
      .get();

    const withdrawals = snapshot.docs.slice(offset).slice(0, limit).map(doc => doc.data());
    const hasMore = snapshot.docs.length > parseInt(limit);

    res.json({ withdrawals, hasMore });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve withdrawal
router.put('/withdrawals/:withdrawalId/approve', verifyAdmin, async (req, res) => {
  try {
    await db.collection('withdrawals').doc(req.params.withdrawalId).update({
      status: 'approved',
      approvedAt: new Date(),
      approvedBy: req.userId,
    });

    res.json({ message: 'Withdrawal approved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject withdrawal
router.put('/withdrawals/:withdrawalId/reject', verifyAdmin, async (req, res) => {
  try {
    const { reason } = req.body;

    await db.collection('withdrawals').doc(req.params.withdrawalId).update({
      status: 'rejected',
      rejectionReason: reason,
      rejectedAt: new Date(),
      rejectedBy: req.userId,
    });

    res.json({ message: 'Withdrawal rejected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark withdrawal as paid
router.put('/withdrawals/:withdrawalId/mark-paid', verifyAdmin, async (req, res) => {
  try {
    const { paymentReference } = req.body;

    await db.collection('withdrawals').doc(req.params.withdrawalId).update({
      status: 'paid',
      paymentReference,
      paidAt: new Date(),
      paidBy: req.userId,
    });

    res.json({ message: 'Withdrawal marked as paid' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fraud management
router.get('/fraud/alerts', verifyAdmin, async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const snapshot = await db.collection('fraudAlerts')
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit) + 1)
      .get();

    const alerts = snapshot.docs.slice(offset).slice(0, limit).map(doc => doc.data());
    const hasMore = snapshot.docs.length > parseInt(limit);

    res.json({ alerts, hasMore });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resolve fraud alert
router.put('/fraud/alerts/:alertId/resolve', verifyAdmin, async (req, res) => {
  try {
    const { status, note } = req.body;

    await FraudService.resolveFraudAlert(req.params.alertId, status, req.userId, note);
    res.json({ message: 'Fraud alert resolved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Revenue management
router.get('/revenue/summary', verifyAdmin, async (req, res) => {
  try {
    const summary = await RevenueService.getPlatformRevenueSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import revenue data
router.post('/revenue/import', verifySuperAdmin, async (req, res) => {
  try {
    const { revenueData } = req.body;

    if (!Array.isArray(revenueData)) {
      return res.status(400).json({ error: 'Revenue data must be an array' });
    }

    const result = await RevenueService.importRevenueData(revenueData, req.userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Settings
router.get('/settings', verifyAdmin, async (req, res) => {
  try {
    const settingsDoc = await db.collection('settings').doc('platform').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update settings
router.put('/settings', verifySuperAdmin, async (req, res) => {
  try {
    const updates = req.body;

    await db.collection('settings').doc('platform').update(updates);

    // Log action
    await db.collection('adminLogs').add({
      action: 'settings_updated',
      adminId: req.userId,
      updates,
      timestamp: new Date(),
    });

    res.json({ message: 'Settings updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
