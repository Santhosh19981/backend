const admin = require('firebase-admin');
const pool = require('../config/database');

if (!admin.apps.length) {
  try {
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').replace(/"/g, '');
    
    // Only initialize if we have something that looks like a key
    if (privateKey && privateKey.includes('BEGIN PRIVATE KEY')) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: privateKey,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
      console.log('✅ Firebase Admin initialized successfully');
    } else {
      console.warn('⚠️ FCM: FIREBASE_PRIVATE_KEY is missing or invalid. Notifications will be disabled.');
    }
  } catch (err) {
    console.error('❌ Firebase initialization failed:', err.message);
    console.warn('⚠️ App will continue running without FCM features.');
  }
}

exports.sendNotificationToUser = async (userId, title, body, data = {}) => {
  try {
    const [[user]] = await pool.query('SELECT fcm_token FROM users WHERE id = ?', [userId]);
    if (!user?.fcm_token) return;

    await admin.messaging().send({
      token: user.fcm_token,
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
    console.log(`🔔 FCM sent to user ${userId}`);
  } catch (err) {
    console.error('FCM error:', err.message);
  }
};

exports.sendNotificationToTopic = async (topic, title, body, data = {}) => {
  try {
    await admin.messaging().sendToTopic(topic, { notification: { title, body }, data });
  } catch (err) {
    console.error('FCM topic error:', err.message);
  }
};
