const mongoose = require('mongoose');

/**
 * NotificationAck — tracks which audit-log entries each user has already
 * acknowledged (read) from the notification bell. Notifications are derived
 * from the shared AuditLog, so read state lives here as (userId, entryId).
 */
const NotificationAckSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    entryId: { type: String, required: true },
    readAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

NotificationAckSchema.index({ userId: 1, entryId: 1 }, { unique: true });

module.exports =
  mongoose.models.NotificationAck ||
  mongoose.model('NotificationAck', NotificationAckSchema);