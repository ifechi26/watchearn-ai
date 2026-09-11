import { db } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';

const CREATOR_SHARE_PERCENTAGE = 0.60; // 60%
const PLATFORM_SHARE_PERCENTAGE = 0.40; // 40%

export class RevenueService {
  /**
   * Record a revenue event
   * @param {Object} revenueData - Revenue event details
   * @returns {Promise<string>} Revenue event ID
   */
  static async recordRevenueEvent(revenueData) {
    const revenueEventId = uuidv4();
    const {
      creatorId,
      videoId,
      grossRevenue,
      advertisingFees = 0,
      otherApplicableFees = 0,
      source = 'platform_ads',
      period,
      currency = 'NGN',
    } = revenueData;

    // Calculate eligible net revenue
    const eligibleNetRevenue = grossRevenue - advertisingFees - otherApplicableFees;

    if (eligibleNetRevenue < 0) {
      throw new Error('Eligible net revenue cannot be negative');
    }

    // Calculate creator and platform shares
    const creatorShareAmount = eligibleNetRevenue * CREATOR_SHARE_PERCENTAGE;
    const platformShareAmount = eligibleNetRevenue * PLATFORM_SHARE_PERCENTAGE;

    // Verify shares add up correctly (with rounding tolerance)
    const totalShare = creatorShareAmount + platformShareAmount;
    const difference = Math.abs(totalShare - eligibleNetRevenue);
    if (difference > 0.01) {
      console.warn('Revenue share calculation mismatch:', { difference, totalShare, eligibleNetRevenue });
    }

    const revenueEvent = {
      revenueEventId,
      creatorId,
      videoId,
      grossRevenue,
      advertisingFees,
      otherApplicableFees,
      eligibleNetRevenue,
      creatorSharePercentage: CREATOR_SHARE_PERCENTAGE,
      platformSharePercentage: PLATFORM_SHARE_PERCENTAGE,
      creatorShareAmount,
      platformShareAmount,
      currency,
      source,
      period,
      status: 'pending', // pending, finalized
      createdAt: new Date(),
      finalizedAt: null,
    };

    await db.collection('revenueEvents').doc(revenueEventId).set(revenueEvent);
    return revenueEventId;
  }

  /**
   * Finalize revenue event
   * @param {string} revenueEventId - Revenue event ID
   * @returns {Promise<void>}
   */
  static async finalizeRevenueEvent(revenueEventId) {
    await db.collection('revenueEvents').doc(revenueEventId).update({
      status: 'finalized',
      finalizedAt: new Date(),
    });
  }

  /**
   * Get creator earnings (estimated and finalized)
   * @param {string} creatorId - Creator ID
   * @returns {Promise<Object>} Creator earnings summary
   */
  static async getCreatorEarnings(creatorId) {
    const query = await db.collection('revenueEvents')
      .where('creatorId', '==', creatorId)
      .get();

    let estimatedEarnings = 0;
    let finalizedEarnings = 0;
    let pendingEarnings = 0;

    query.docs.forEach((doc) => {
      const event = doc.data();
      if (event.status === 'finalized') {
        finalizedEarnings += event.creatorShareAmount || 0;
      } else if (event.status === 'pending') {
        estimatedEarnings += event.creatorShareAmount || 0;
      }
    });

    // Pending earnings are those approved for withdrawal but not yet paid
    const pendingWithdrawals = await db.collection('withdrawals')
      .where('creatorId', '==', creatorId)
      .where('status', 'in', ['pending', 'approved', 'processing'])
      .get();

    pendingWithdrawals.docs.forEach((doc) => {
      pendingEarnings += doc.data().amount || 0;
    });

    return {
      estimated: Math.round(estimatedEarnings * 100) / 100,
      finalized: Math.round(finalizedEarnings * 100) / 100,
      pending: Math.round(pendingEarnings * 100) / 100,
      available: Math.round((finalizedEarnings - pendingEarnings) * 100) / 100,
      total: Math.round((estimatedEarnings + finalizedEarnings) * 100) / 100,
    };
  }

  /**
   * Get video revenue
   * @param {string} videoId - Video ID
   * @returns {Promise<Object>} Video revenue summary
   */
  static async getVideoRevenue(videoId) {
    const query = await db.collection('revenueEvents')
      .where('videoId', '==', videoId)
      .get();

    const revenue = {
      grossRevenue: 0,
      fees: 0,
      eligibleNetRevenue: 0,
      creatorShare: 0,
      platformShare: 0,
      events: [],
    };

    query.docs.forEach((doc) => {
      const event = doc.data();
      revenue.grossRevenue += event.grossRevenue || 0;
      revenue.fees += (event.advertisingFees + event.otherApplicableFees) || 0;
      revenue.eligibleNetRevenue += event.eligibleNetRevenue || 0;
      revenue.creatorShare += event.creatorShareAmount || 0;
      revenue.platformShare += event.platformShareAmount || 0;
      revenue.events.push(event);
    });

    return revenue;
  }

  /**
   * Import finalized revenue from advertising platform
   * @param {Array} revenueData - Array of revenue events to import
   * @param {string} adminId - Admin ID for audit trail
   * @returns {Promise<Object>} Import result
   */
  static async importRevenueData(revenueData, adminId) {
    const results = {
      imported: 0,
      failed: 0,
      errors: [],
      totalGrossRevenue: 0,
      totalCreatorShare: 0,
      totalPlatformShare: 0,
    };

    const batch = db.batch();
    let batchSize = 0;
    const maxBatchSize = 500;

    for (const item of revenueData) {
      try {
        const { creatorId, videoId, grossRevenue, fees = 0, period, source = 'platform_ads' } = item;

        if (!creatorId || !videoId || grossRevenue === undefined) {
          throw new Error('Missing required fields: creatorId, videoId, grossRevenue');
        }

        // Calculate amounts
        const eligibleNetRevenue = grossRevenue - fees;
        const creatorShareAmount = eligibleNetRevenue * CREATOR_SHARE_PERCENTAGE;
        const platformShareAmount = eligibleNetRevenue * PLATFORM_SHARE_PERCENTAGE;

        const revenueEventId = uuidv4();
        const revenueEvent = {
          revenueEventId,
          creatorId,
          videoId,
          grossRevenue,
          advertisingFees: fees,
          otherApplicableFees: 0,
          eligibleNetRevenue,
          creatorSharePercentage: CREATOR_SHARE_PERCENTAGE,
          platformSharePercentage: PLATFORM_SHARE_PERCENTAGE,
          creatorShareAmount,
          platformShareAmount,
          currency: 'NGN',
          source,
          period,
          status: 'finalized',
          importedBy: adminId,
          createdAt: new Date(),
          finalizedAt: new Date(),
        };

        batch.set(db.collection('revenueEvents').doc(revenueEventId), revenueEvent);
        results.imported++;
        results.totalGrossRevenue += grossRevenue;
        results.totalCreatorShare += creatorShareAmount;
        results.totalPlatformShare += platformShareAmount;
        batchSize++;

        // Commit batch if size reached
        if (batchSize >= maxBatchSize) {
          await batch.commit();
          batchSize = 0;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          item,
          error: error.message,
        });
      }
    }

    // Commit remaining batch
    if (batchSize > 0) {
      await batch.commit();
    }

    // Log import
    await db.collection('adminLogs').add({
      action: 'revenue_import',
      adminId,
      results,
      timestamp: new Date(),
    });

    return results;
  }

  /**
   * Get platform revenue summary
   * @param {string} period - Period to query (optional)
   * @returns {Promise<Object>} Platform revenue summary
   */
  static async getPlatformRevenueSummary(period = null) {
    let query = db.collection('revenueEvents');

    if (period) {
      query = query.where('period', '==', period);
    }

    const snapshot = await query.get();

    const summary = {
      grossRevenue: 0,
      fees: 0,
      eligibleNetRevenue: 0,
      creatorShare: 0,
      platformShare: 0,
      finalized: 0,
      pending: 0,
      uniqueCreators: new Set(),
      uniqueVideos: new Set(),
    };

    snapshot.docs.forEach((doc) => {
      const event = doc.data();
      summary.grossRevenue += event.grossRevenue || 0;
      summary.fees += (event.advertisingFees + event.otherApplicableFees) || 0;
      summary.eligibleNetRevenue += event.eligibleNetRevenue || 0;
      summary.creatorShare += event.creatorShareAmount || 0;
      summary.platformShare += event.platformShareAmount || 0;
      summary.uniqueCreators.add(event.creatorId);
      summary.uniqueVideos.add(event.videoId);

      if (event.status === 'finalized') {
        summary.finalized++;
      } else {
        summary.pending++;
      }
    });

    return {
      ...summary,
      uniqueCreators: summary.uniqueCreators.size,
      uniqueVideos: summary.uniqueVideos.size,
    };
  }
}
