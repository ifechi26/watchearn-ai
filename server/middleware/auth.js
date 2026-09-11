import { auth } from '../config/firebase.js';

export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    req.userId = decodedToken.uid;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const verifyAdmin = async (req, res, next) => {
  try {
    await verifyToken(req, res, () => {});
    
    const userDoc = await admin.firestore().collection('users').doc(req.userId).get();
    const userData = userDoc.data();
    
    if (userData?.role !== 'ADMIN' && userData?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.userRole = userData.role;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Forbidden' });
  }
};

export const verifySuperAdmin = async (req, res, next) => {
  try {
    await verifyToken(req, res, () => {});
    
    const userDoc = await admin.firestore().collection('users').doc(req.userId).get();
    const userData = userDoc.data();
    
    if (userData?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    
    next();
  } catch (error) {
    res.status(403).json({ error: 'Forbidden' });
  }
};
