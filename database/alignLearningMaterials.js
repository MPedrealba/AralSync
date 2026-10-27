// One-off alignment script: checks all LearningMaterial records in MongoDB,
// verifies physical existence on disk, and auto-aligns missing files to
// existing uploads or curriculum defaults.
const path = require('path');
const fs = require('fs');
const connectDB = require('./db');
const LearningMaterial = require('../models/LearningMaterial');

const run = async () => {
  await connectDB();

  console.log('--- Starting Learning Materials Alignment Audit ---');
  const publicDir = path.resolve(process.cwd(), 'public');
  const uploadsDir = path.join(publicDir, 'uploads', 'materials');

  let availableUploads = [];
  if (fs.existsSync(uploadsDir)) {
    availableUploads = fs.readdirSync(uploadsDir).filter((f) => f.toLowerCase().endsWith('.pdf') && !f.startsWith('.'));
  }
  console.log('Available PDFs in public/uploads/materials:', availableUploads);

  const materials = await LearningMaterial.find({});
  console.log(`Found ${materials.length} total LearningMaterial records in MongoDB.`);

  let verifiedCount = 0;
  let healedCount = 0;

  for (const m of materials) {
    const rawUrl = m.fileUrl || '';
    const cleanRel = rawUrl.split(/[#?]/)[0].trim().replace(/^\/+/, '');
    const fullPath = path.resolve(publicDir, cleanRel);

    const exists = fs.existsSync(fullPath);
    if (exists) {
      verifiedCount++;
      console.log(`[VERIFIED] "${m.title}" (${m._id}) -> ${m.fileUrl}`);
    } else {
      console.warn(`[MISSING ON DISK] "${m.title}" (${m._id}) -> target: ${m.fileUrl}`);

      // Attempt fuzzy matching
      const mathMatch = availableUploads.find(
        (f) => f.toLowerCase().includes('math') || f.includes('learner_s_worksheets')
      );

      if (mathMatch && (m.subject === 'Math' || (m.title || '').toLowerCase().includes('math'))) {
        m.fileUrl = `/uploads/materials/${mathMatch}`;
        await m.save();
        healedCount++;
        console.log(`  -> Healed: Updated fileUrl to /uploads/materials/${mathMatch}`);
      } else if (availableUploads.length > 0) {
        m.fileUrl = `/uploads/materials/${availableUploads[0]}`;
        await m.save();
        healedCount++;
        console.log(`  -> Healed: Updated fileUrl to /uploads/materials/${availableUploads[0]}`);
      } else {
        // Fallback to KS3 basic workbook
        m.fileUrl = '/learning-materials/ks3-basic/learner-workbook.pdf';
        await m.save();
        healedCount++;
        console.log(`  -> Fallback: Updated fileUrl to ${m.fileUrl}`);
      }
    }
  }

  console.log(`\nAudit Summary: Verified: ${verifiedCount}, Healed: ${healedCount}, Total: ${materials.length}`);
  process.exit(0);
};

run().catch((err) => {
  console.error('Alignment failed:', err);
  process.exit(1);
});
