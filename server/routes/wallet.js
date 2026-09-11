import express from 'express';
import { db } from '../config/firebase.js';
import { verifyToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get wallet
router.get('/:userId', verifyToken, async (req, res) => {
  try {
    if (req.userId !== req.params.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const userDoc = await db.collection('users').doc(req.userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const walletData = {
      userId: req.userId,
      estimated: 0,
      finalized: 0,
      pending: 0,
      available: 0,
      totalEarned: 0,
      totalPaid: 0,
    };

    // Get earnings if creator
    const creatorDoc = await db.collection('creators').doc(req.userId).get();
    if (creatorDoc.exists) {
      const revenueSnapshot = await db.collection('revenueEvents')
        .where('creatorId', '==', req.userId)
        .get();

      revenueSnapshot.docs.forEach(doc => {
        const event = doc.data();
        if (event.status === 'finalized') {
          walletData.finalized += event.creatorShareAmount || 0;
        } else {
          walletData.estimated += event.creatorShareAmount || 0;
        }
      });
    }

    // Get pending withdrawals
    const pendingSnapshot = await db.collection('withdrawals')
      .where('userId', '==', req.userId)
      .where('status', 'in', ['pending', 'approved', 'processing'])
      .get();

    pendingSnapshot.docs.forEach(doc => {
      walletData.pending += doc.data().amount || 0;
    });

    // Get paid withdrawals
    const paidSnapshot = await db.collection('withdrawals')
      .where('userId', '==', req.userId)
      .where('status', '==', 'paid')
      .get();

    paidSnapshot.docs.forEach(doc => {
      walletData.totalPaid += doc.data().amount || 0;
    });

    walletData.available = walletData.finalized - walletData.pending;
    walletData.totalEarned = walletData.finalized + walletData.estimated;

    res.json(walletData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get transaction history
router.get('/:userId/history', verifyToken, async (req, res) => {
  try {
    if (req.userId !== req.params.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Get withdrawal history
    const withdrawalSnapshot = await db.collection('withdrawals')
      .where('userId', '==', req.userId)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit) + 1)
      .get();

    const transactions = withdrawalSnapshot.docs
      .slice(offset)
      .slice(0, limit)
      .map(doc => ({
        ...doc.data(),
        type: 'withdrawal',
      }));

    const hasMore = withdrawalSnapshot.docs.length > parseInt(limit);

    res.json({
      transactions,
      hasMore,
      page: parseInt(page),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit withdrawal request
router.post('/request', verifyToken, async (req, res) => {
  try {
    const { amount, paymentDetails } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Verify user has sufficient balance
    const walletSnapshot = await db.collection('revenueEvents')
      .where('creatorId', '==', req.userId)
      .where('status', '==', 'finalized')
      .get();

    let availableBalance = 0;
    walletSnapshot.docs.forEach(doc => {
      availableBalance += doc.data().creatorShareAmount || 0;
    });

    // Subtract pending withdrawals
    const pendingSnapshot = await db.collection('withdrawals')
      .where('userId', '==', req.userId)
      .where('status', 'in', ['pending', 'approved', 'processing'])
      .get();

    let pendingAmount = 0;
    pendingSnapshot.docs.forEach(doc => {
      pendingAmount += doc.data().amount || 0;
    });

    const actualAvailable = availableBalance - pendingAmount;

    if (amount > actualAvailable) {
      return res.status(400).json({
        error: 'Insufficient balance',
        availableBalance: actualAvailable,
      });
    }

    const withdrawalId = uuidv4();
    const withdrawal = {
      withdrawalId,
      userId: req.userId,
      amount,
      paymentDetails: {
        bankName: paymentDetails?.bankName || null,
        accountName: paymentDetails?.accountName || null,
        // NOTE: Never store sensitive banking info in plaintext
        accountNumberHash: paymentDetails?.accountNumber ? 
          Buffer.from(paymentDetails.accountNumber).toString('base64') : null,
      },
      status: 'pending', // pending, review, approved, processing, paid, rejected, failed, cancelled
      paymentReference: null,
      adminNotes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      processedAt: null,
      processedBy: null,
    };

    await db.collection('withdrawals').doc(withdrawalId).set(withdrawal);

    // Log the action
    await db.collection('adminLogs').add({
      action: 'withdrawal_request_submitted',
      withdrawalId,
      userId: req.userId,
      amount,
      timestamp: new Date(),
    });

    res.status(201).json({
      withdrawalId,
      message: 'Withdrawal request submitted. Admin will review shortly.',
      status: 'pending',
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel withdrawal request
router.post('/:withdrawalId/cancel', verifyToken, async (req, res) => {
  try {
    const withdrawalDoc = await db.collection('withdrawals')
      .doc(req.params.withdrawalId).get();

    if (!withdrawalDoc.exists) {
      return res.status(404).json({ error: 'Withdrawal not found' });
    }

    const withdrawal = withdrawalDoc.data();

    if (withdrawal.userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (['approved', 'processing', 'paid'].includes(withdrawal.status)) {
      return res.status(400).json({
        error: `Cannot cancel withdrawal with status: ${withdrawal.status}`,
      });
    }

    await db.collection('withdrawals').doc(req.params.withdrawalId).update({
      status: 'cancelled',
      updatedAt: new Date(),
    });

    res.json({ message: 'Withdrawal request cancelled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
