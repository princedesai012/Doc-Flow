const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  type: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Submitted', 'Approved', 'Rejected'], default: 'Pending' },
  url: { type: String }, // Cloudinary URL
  rejectionReason: { type: String },
  submittedAt: { type: Date }
});

const RequestSchema = new mongoose.Schema({
  clientName: { type: String, required: true },
  whatsappNumber: { type: String, required: true },
  requestedDocs: [{ type: String }], // List of doc types e.g. "Aadhar", "PAN"
  documents: [DocumentSchema], // Stores the actual uploaded docs corresponding to requestedDocs
  status: { type: String, enum: ['Sent', 'Viewed', 'Submitted', 'Partial', 'Approved', 'Rejected'], default: 'Sent' },
  accessToken: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Request', RequestSchema);
