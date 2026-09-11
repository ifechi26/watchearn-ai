import express from 'express';
import { db } from '../config/firebase.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.js';
import { RevenueService } from '../services/revenueService.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get monetization status
router.get('/status/:creatorId', async (req, res) => {
  try {
    const creatorDoc = await db.collection('creators').doc(req.params.creatorId).get();
    
    if (!creatorDoc.exists) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const creator = creatorDoc.data();
    const earnings = await RevenueService.getCreatorEarnings(req.params.creatorId);

    res.json({
      creatorId: req.params.creatorId,
      premiumStatus: creator.premiumStatus,
      monetizationStatus: creator.monetizationStatus,
      revenueShare: {
        creator: 60,
        platform: 40,
      },
      earnings,
      eligibilityChecklist: {
        premium: creator.premiumStatus === 'active',
        accountStanding: creator.status === 'active',
        contentQuality: creator.verificationStatus === 'verified',
        paymentInfo: !!creator.paymentInfo,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Apply for monetization
router.post('/apply', verifyToken, async (req, res) => {
  try {
    const { contentCategory, website, paymentInfo } = req.body;
    const applicationId = uuidv4();

    // Verify creator exists and is premium
    const creatorDoc = await db.collection('creators').doc(req.userId).get();
    if (!creatorDoc.exists) {
      return res.status(404).json({ error: 'Creator account not found' });
    }

    const creator = creatorDoc.data();
    if (creator.premiumStatus !== 'active') {
      return res.status(400).json({ error: 'Must have active Premium Creator subscription' });
    }

    const application = {
      applicationId,
      creatorId: req.userId,
      contentCategory,
      website: website || null,
      paymentInfo: {
        bankName: paymentInfo?.bankName || null,
        accountName: paymentInfo?.accountName || null,
        // NOTE: Account number should not be stored in plaintext
        accountNumberHash: paymentInfo?.accountNumber ? 
          Buffer.from(paymentInfo.accountNumber).toString('base64') : null,
      },
      status: 'submitted', // draft, submitted, under_review, approved, rejected
      submittedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      adminNotes: [],
    };

    await db.collection('monetizationApplications').doc(applicationId).set(application);

    // Log the action
    await db.collection('adminLogs').add({
      action: 'monetization_application_submitted',
      applicationId,
      creatorId: req.userId,
      timestamp: new Date(),
    });

    res.status(201).json({
      applicationId,
      message: 'Monetization application submitted for review',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get creator earnings
router.get('/earnings/:creatorId', verifyToken, async (req, res) => {
  try {
    if (req.userId !== req.params.creatorId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const earnings = await RevenueService.getCreatorEarnings(req.params.creatorId);
    
    // Get revenue history
    const revenueSnapshot = await db.collection('revenueEvents')
      .where('creatorId', '==', req.params.creatorId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const revenueHistory = revenueSnapshot.docs.map(doc => doc.data());

    res.json({
      earnings,
      revenueHistory,
      revenueSplit: {
        creatorPercentage: 60,
        platformPercentage: 40,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Review monetization application
router.put('/admin/applications/:applicationId', verifyAdmin, async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const validStatuses = ['approved', 'rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const appDoc = await db.collection('monetizationApplications')
      .doc(req.params.applicationId).get();
    
    if (!appDoc.exists) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = appDoc.data();
    const updates = {
      status,
      reviewedAt: new Date(),
      reviewedBy: req.userId,
    };

    if (adminNote) {
      updates.adminNotes = [...(application.adminNotes || []), {
        adminId: req.userId,
        note: adminNote,
        timestamp: new Date(),
      }];
    }

    // If approved, update creator monetization status
    if (status === 'approved') {
      await db.collection('creators').doc(application.creatorId).update({
        monetizationStatus: 'approved',
        monetizationApprovedAt: new Date(),
      });

      // Update user role to PREMIUM_CREATOR if not already
      await db.collection('users').doc(application.creatorId).update({
        role: 'PREMIUM_CREATOR',
      });
    }

    await db.collection('monetizationApplications').doc(req.params.applicationId).update(updates);

    // Log action
    await db.collection('adminLogs').add({
      action: 'monetization_application_reviewed',
      applicationId: req.params.applicationId,
      creatorId: application.creatorId,
      adminId: req.userId,
      decision: status,
      timestamp: new Date(),
    });

    res.json({ message: `Application ${status}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
