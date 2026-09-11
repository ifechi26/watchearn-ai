import express from 'express';
import { db, storage } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Get all videos with filtering
router.get('/', async (req, res) => {
  try {
    const { category, search, sort = 'createdAt', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = db.collection('videos')
      .where('status', '==', 'approved')
      .where('visibility', '==', 'public');

    if (category) {
      query = query.where('category', '==', category);
    }

    // Firestore doesn't support full-text search natively, so we use startAt/endAt for prefix matching
    if (search) {
      query = query.where('titleLower', '>=', search.toLowerCase())
        .where('titleLower', '<=', search.toLowerCase() + '\uf8ff');
    }

    // Apply sorting
    if (sort === 'trending') {
      query = query.orderBy('views', 'desc');
    } else if (sort === 'latest') {
      query = query.orderBy('createdAt', 'desc');
    } else {
      query = query.orderBy(sort, 'desc');
    }

    const snapshot = await query.limit(parseInt(limit) + 1).get();
    const videos = snapshot.docs.slice(offset).slice(0, limit).map(doc => doc.data());
    const hasMore = snapshot.docs.length > parseInt(limit);

    res.json({
      videos,
      hasMore,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single video
router.get('/:videoId', async (req, res) => {
  try {
    const videoDoc = await db.collection('videos').doc(req.params.videoId).get();
    
    if (!videoDoc.exists) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = videoDoc.data();
    if (video.visibility !== 'public' && video.status !== 'approved') {
      return res.status(403).json({ error: 'Video not accessible' });
    }

    res.json(video);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create watch session
router.post('/:videoId/watch', verifyToken, async (req, res) => {
  try {
    const { watchDuration, completionPercentage } = req.body;
    const sessionId = uuidv4();

    const watchSession = {
      sessionId,
      userId: req.userId,
      videoId: req.params.videoId,
      watchDuration: watchDuration || 0,
      completionPercentage: completionPercentage || 0,
      createdAt: new Date(),
    };

    await db.collection('watchSessions').doc(sessionId).set(watchSession);

    // Increment video view count
    await db.collection('videos').doc(req.params.videoId).update({
      views: (
        await db.collection('videos').doc(req.params.videoId).get()
      ).data().views + 1 || 1,
      updatedAt: new Date(),
    });

    res.status(201).json({ sessionId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Like video
router.post('/:videoId/like', verifyToken, async (req, res) => {
  try {
    const likeId = uuidv4();
    const like = {
      likeId,
      userId: req.userId,
      videoId: req.params.videoId,
      createdAt: new Date(),
    };

    await db.collection('likes').doc(likeId).set(like);

    // Update video likes count
    const videoDoc = await db.collection('videos').doc(req.params.videoId).get();
    const currentLikes = videoDoc.data().likes || 0;
    await db.collection('videos').doc(req.params.videoId).update({
      likes: currentLikes + 1,
    });

    res.status(201).json({ likeId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save video
router.post('/:videoId/save', verifyToken, async (req, res) => {
  try {
    const saveId = uuidv4();
    const save = {
      saveId,
      userId: req.userId,
      videoId: req.params.videoId,
      createdAt: new Date(),
    };

    await db.collection('savedVideos').doc(saveId).set(save);
    res.status(201).json({ saveId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Post comment
router.post('/:videoId/comments', verifyToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Comment text required' });
    }

    const commentId = uuidv4();
    const comment = {
      commentId,
      videoId: req.params.videoId,
      userId: req.userId,
      text,
      status: 'pending', // pending, approved, rejected
      likes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('comments').doc(commentId).set(comment);
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get comments
router.get('/:videoId/comments', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const snapshot = await db.collection('comments')
      .where('videoId', '==', req.params.videoId)
      .where('status', '==', 'approved')
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit) + 1)
      .get();

    const comments = snapshot.docs.slice(offset).slice(0, limit).map(doc => doc.data());
    const hasMore = snapshot.docs.length > parseInt(limit);

    res.json({ comments, hasMore });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Report video
router.post('/:videoId/report', verifyToken, async (req, res) => {
  try {
    const { reason, description } = req.body;
    const reportId = uuidv4();

    const report = {
      reportId,
      videoId: req.params.videoId,
      reportedBy: req.userId,
      reason,
      description,
      status: 'pending', // pending, investigating, resolved, dismissed
      createdAt: new Date(),
    };

    await db.collection('reports').doc(reportId).set(report);
    res.status(201).json({ reportId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
