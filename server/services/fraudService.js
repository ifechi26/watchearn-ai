import { db } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';

export class FraudService {
  /**
   * Calculate risk score for user activity
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Risk assessment
   */
  static async calculateUserRiskScore(userId) {
    let riskScore = 0;
    const factors = [];

    try {
      // Check account age
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      if (!userData) {
        return { riskScore: 100, factors: ['User not found'] };
      }

      const accountAgeHours = (Date.now() - userData.createdAt?.toMillis?.() || 0) / (1000 * 60 * 60);
      if (accountAgeHours < 24) {
        riskScore += 15;
        factors.push('Very new account (< 24 hours)');
      } else if (accountAgeHours < 168) {
        riskScore += 10;
        factors.push('New account (< 7 days)');
      }

      // Check watch session patterns
      const recentSessions = await db.collection('watchSessions')
        .where('userId', '==', userId)
        .where('createdAt', '>', new Date(Date.now() - 24 * 60 * 60 * 1000))
        .get();

      if (recentSessions.size > 50) {
        riskScore += 20;
        factors.push('Abnormally high watch sessions (> 50 in 24h)');
      }

      // Check for rapid reward claims
      const recentWithdrawals = await db.collection('withdrawals')
        .where('userId', '==', userId)
        .where('createdAt', '>', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .get();

      if (recentWithdrawals.size > 5) {
        riskScore += 25;
        factors.push('Frequent withdrawal requests (> 5 in 7 days)');
      }

      // Check referral patterns
      const referrals = await db.collection('referrals')
        .where('referrerId', '==', userId)
        .get();

      if (referrals.size > 100) {
        riskScore += 15;
        factors.push('Unusually high referral count (> 100)');
      }

      // Check for multiple accounts from same IP/device (if tracked)
      // This would require additional logging infrastructure

      // Check suspension history
      if (userData.suspensions?.length > 0) {
        riskScore += 30;
        factors.push(`Previous suspensions (${userData.suspensions.length})`);
      }

      // Check policy violations
      const violations = await db.collection('reports')
        .where('targetUserId', '==', userId)
        .where('status', '==', 'verified')
        .get();

      if (violations.size > 3) {
        riskScore += Math.min(20, violations.size * 5);
        factors.push(`Multiple verified violations (${violations.size})`);
      }

    } catch (error) {
      console.error('Error calculating risk score:', error);
    }

    // Cap score at 100
    riskScore = Math.min(100, riskScore);

    return {
      userId,
      riskScore,
      level: riskScore <= 30 ? 'LOW' : riskScore <= 70 ? 'MEDIUM' : 'HIGH',
      factors,
      calculatedAt: new Date(),
    };
  }

  /**
   * Create fraud alert
   * @param {Object} alertData - Alert details
   * @returns {Promise<string>} Alert ID
   */
  static async createFraudAlert(alertData) {
    const alertId = uuidv4();
    const {
      userId,
      reason,
      evidence,
      riskScore,
      severity = 'MEDIUM',
    } = alertData;

    const alert = {
      alertId,
      userId,
      reason,
      evidence,
      riskScore,
      severity,
      status: 'pending', // pending, investigating, resolved, false_positive
      adminNotes: [],
      createdAt: new Date(),
      resolvedAt: null,
      resolvedBy: null,
    };

    await db.collection('fraudAlerts').doc(alertId).set(alert);
    return alertId;
  }

  /**
   * Get fraud alert
   * @param {string} alertId - Alert ID
   * @returns {Promise<Object>} Fraud alert details
   */
  static async getFraudAlert(alertId) {
    const doc = await db.collection('fraudAlerts').doc(alertId).get();
    if (!doc.exists) return null;
    return doc.data();
  }

  /**
   * Update fraud alert status
   * @param {string} alertId - Alert ID
   * @param {string} status - New status
   * @param {string} adminId - Admin ID
   * @param {string} note - Admin note
   * @returns {Promise<void>}
   */
  static async resolveFraudAlert(alertId, status, adminId, note) {
    const alert = await this.getFraudAlert(alertId);
    if (!alert) throw new Error('Alert not found');

    const updates = {
      status,
      resolvedAt: new Date(),
      resolvedBy: adminId,
    };

    // Add admin note
    if (note) {
      updates.adminNotes = [...(alert.adminNotes || []), {
        adminId,
        note,
        timestamp: new Date(),
      }];
    }

    // Log action
    await db.collection('adminLogs').add({
      action: 'fraud_alert_resolved',
      alertId,
      adminId,
      status,
      timestamp: new Date(),
    });

    await db.collection('fraudAlerts').doc(alertId).update(updates);
  }

  /**
   * Get all fraud alerts for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Fraud alerts
   */
  static async getUserFraudAlerts(userId) {
    const snapshot = await db.collection('fraudAlerts')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * Monitor suspicious watch patterns
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Suspicious patterns
   */
  static async checkSuspiciousWatchPatterns(userId) {
    const patterns = [];
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const sessions = await db.collection('watchSessions')
      .where('userId', '==', userId)
      .where('createdAt', '>', last24h)
      .orderBy('createdAt', 'desc')
      .get();

    // Pattern 1: Multiple videos watched in rapid succession with full completion
    if (sessions.size > 20) {
      const avgWatchTime = sessions.docs.reduce((sum, doc) => 
        sum + (doc.data().watchDuration || 0), 0
      ) / sessions.size;

      if (avgWatchTime < 30) { // Less than 30 seconds average
        patterns.push({
          pattern: 'rapid_video_consumption',
          severity: 'medium',
          description: 'Unusually high number of videos watched with very low average watch time',
          sessionCount: sessions.size,
          avgWatchTime,
        });
      }
    }

    // Pattern 2: Same video watched repeatedly
    const videoWatches = {};
    sessions.docs.forEach(doc => {
      const videoId = doc.data().videoId;
      videoWatches[videoId] = (videoWatches[videoId] || 0) + 1;
    });

    Object.entries(videoWatches).forEach(([videoId, count]) => {
      if (count > 5) {
        patterns.push({
          pattern: 'repeated_video_watch',
          severity: 'high',
          description: 'Same video watched multiple times in 24 hours',
          videoId,
          watchCount: count,
        });
      }
    });

    return patterns;
  }
}
