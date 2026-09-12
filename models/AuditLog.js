const mongoose = require('mongoose');

/**
 * AuditLog — records actions for accountability (capstone paper entity).
 * Every entry captures who did what, to which target, and when, so a
 * principal can review the trail (login, OMR upload, reading analysis,
 * intervention status changes, assessment approval/flagging, etc.).
 */
const AuditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String },
    role: { type: String, default: 'user' },
    action: { type: String, required: true },
    targetType: { type: String },
    targetId: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

AuditLogSchema.index({ createdAt: -1 });

module.exports =
  mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);