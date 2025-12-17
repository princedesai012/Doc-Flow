const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const multer = require('multer');

// Configure Multer to hold files in memory (buffer)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Admin Routes
router.get('/requests', requestController.getAllRequests);
router.post('/request', requestController.createRequest);
router.put('/request/:requestId/doc/:docId', requestController.updateDocumentStatus);
router.delete('/request/:id', requestController.deleteRequest);

// Public/Client Routes
router.get('/request/:token', requestController.getRequest);
router.post('/upload', upload.single('file'), requestController.uploadDocument);
//

// Router mein yeh line add karein (jahan baaki routes hain)
router.post('/whatsapp/pair', requestController.generatePairingCode);
module.exports = router;
