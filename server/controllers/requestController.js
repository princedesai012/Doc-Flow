const Request = require('../models/Request');
const whatsappService = require('../services/whatsapp');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const createRequest = async (req, res) => {
    try {
        const { clientName, whatsappNumber, requestedDocs } = req.body;

        // Generate unique access token
        const accessToken = crypto.randomBytes(16).toString('hex');

        // Create Request
        const newRequest = new Request({
            clientName,
            whatsappNumber,
            requestedDocs,
            accessToken,
            documents: requestedDocs.map(type => ({ type }))
        });

        await newRequest.save();

        // Send WhatsApp Message
        const link = `${process.env.FRONTEND_URL}/upload/${accessToken}`;
        // Format message
        const message = `Hello ${clientName}, please upload your requested documents (${requestedDocs.join(', ')}) securely using this link:  ${link}`;

        try {
            await whatsappService.sendMessage(whatsappNumber, message);
        } catch (waError) {
            console.error('Failed to send WA message', waError);
        }

        res.status(201).json(newRequest);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getRequest = async (req, res) => {
    try {
        const { token } = req.params;
        const request = await Request.findOne({ accessToken: token });
        if (!request) return res.status(404).json({ error: 'Request not found' });

        // Link Expiry Check
        if (request.status === 'Submitted' || request.status === 'Approved') {
            return res.status(403).json({
                error: 'Link Expired',
                message: 'This application has already been submitted and is under review.'
            });
        }

        // Mark as Viewed if currently Sent
        if (request.status === 'Sent') {
            request.status = 'Viewed';
            await request.save();
        }

        res.json(request);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getAllRequests = async (req, res) => {
    try {
        const requests = await Request.find().sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

const updateDocumentStatus = async (req, res) => {
    try {
        const { requestId, docId } = req.params;
        const { status, rejectionReason } = req.body;

        const request = await Request.findById(requestId);
        if (!request) return res.status(404).json({ error: 'Request not found' });

        const doc = request.documents.id(docId);
        if (!doc) return res.status(404).json({ error: 'Document not found' });

        doc.status = status;
        if (status === 'Rejected') {
            doc.rejectionReason = rejectionReason;

            // Re-activate the request link
            request.status = 'Partial';

            // Send Rejection Message
            const link = `${process.env.FRONTEND_URL}/upload/${request.accessToken}`;
            const message = `Your ${doc.type} document was rejected. Reason: ${rejectionReason}. Please re-upload here:  ${link}`;
            try {
                await whatsappService.sendMessage(request.whatsappNumber, message);
            } catch (waError) {
                console.error('Failed to send WA message', waError);
            }
        }

        await request.save();
        res.json(request);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

const uploadDocument = async (req, res) => {
    try {
        const { accessToken, docType } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const request = await Request.findOne({ accessToken });
        if (!request) return res.status(404).json({ error: 'Request not found' });

        // Determine resource type: 'raw' for PDFs, 'image' for others (or 'auto')
        // Using 'raw' for PDF is safer to prevent corruption
        const isPDF = file.mimetype === 'application/pdf';
        const resourceType = isPDF ? 'raw' : 'image';

        const randomId = crypto.randomBytes(8).toString('hex');
        // Ensure extension is present in public_id for 'raw' files
        const ext = isPDF ? '.pdf' : '';
        const publicId = `${docType.replace(/\s+/g, '_')}_${randomId}${ext}`;

        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'smartfin_docs',
                    resource_type: resourceType,
                    public_id: publicId,
                    use_filename: true,
                    unique_filename: false
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            uploadStream.end(file.buffer);
        });

        const doc = request.documents.find(d => d.type === docType);
        if (doc) {
            doc.url = uploadResult.secure_url;
            doc.status = 'Submitted';
            doc.submittedAt = new Date();
        } else {
            return res.status(400).json({ error: 'Invalid document type' });
        }

        // Check if all docs are submitted
        const allSubmitted = request.documents.every(d => d.status === 'Submitted' || d.status === 'Approved');
        if (allSubmitted) {
            request.status = 'Submitted';
        } else {
            request.status = 'Partial';
        }

        await request.save();

        // Notify Admin via Socket
        const io = req.app.get('io');
        if (io) {
            io.emit('request_updated', request);
        }

        res.json(request);
    } catch (error) {
        console.error('Upload Controller Error:', error);
        res.status(500).json({ error: error.message || 'Server upload failed' });
    }
};

const deleteRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Request.findByIdAndDelete(id);
        if (!result) return res.status(404).json({ error: 'Request not found' });
        res.json({ message: 'Request deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

//

// Yeh naya function add karein
const generatePairingCode = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        const code = await whatsappService.requestPairingCode(phoneNumber);
        res.json({ code: code, message: 'Pairing code generated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Failed to generate pairing code' });
    }
};

// File ke end mein module.exports mein 'generatePairingCode' add karna mat bhulna!
module.exports = {
    createRequest,
    getRequest,
    getAllRequests,
    updateDocumentStatus,
    uploadDocument,
    deleteRequest,
    generatePairingCode // <--- Added here
};
