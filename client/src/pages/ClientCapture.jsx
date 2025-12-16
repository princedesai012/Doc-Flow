import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Camera, X, Check, AlertTriangle, Upload, RefreshCw, Image as ImageIcon, Loader, ChevronLeft, FileText } from 'lucide-react';
import { useOpenCV } from '../hooks/useOpenCV';
import { detectBlur } from '../utils/cvHelper';
import { API_URL } from '../api';

export default function ClientCapture() {
    const { token } = useParams();
    const cvReady = useOpenCV();
    const [request, setRequest] = useState(null);
    const [activeDoc, setActiveDoc] = useState(null);
    const [isCameraMode, setIsCameraMode] = useState(false);
    const [capturedImage, setCapturedImage] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [blurScore, setBlurScore] = useState(0);
    const [isBlurry, setIsBlurry] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' }); // success | error

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const intervalRef = useRef(null);
    const fileInputRef = useRef(null);

    // Helper to show toast messages
    const showToast = (message, type) => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    const fetchRequest = async () => {
        try {
            const res = await axios.get(`${API_URL}/request/${token}`);
            setRequest(res.data);
        } catch (err) {
            if (err.response && err.response.status === 403) {
                // Link Expired / Under Review
                setRequest({ status: 'Submitted', isExpired: true });
            } else {
                console.error(err);
                showToast('Invalid or expired link', 'error');
            }
        }
    };

    useEffect(() => {
        fetchRequest();
    }, [token]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                startProcessing();
            }
        } catch (err) {
            console.error("Camera Error", err);
            alert("Could not access camera");
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    const startProcessing = () => {
        if (!cvReady) return;

        intervalRef.current = setInterval(() => {
            if (videoRef.current && canvasRef.current) {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');

                // Downscale for processing speed
                const processWidth = 640;
                const scale = processWidth / video.videoWidth;
                const processHeight = video.videoHeight * scale;

                canvas.width = processWidth;
                canvas.height = processHeight;
                ctx.drawImage(video, 0, 0, processWidth, processHeight);

                try {
                    const src = window.cv.imread(canvas);
                    const variance = detectBlur(src);
                    src.delete();

                    setBlurScore(variance);
                    setIsBlurry(variance < 100); // Adjusted threshold
                } catch (e) {
                    console.error("CV Process Error", e);
                }
            }
        }, 500); // 2 FPS check
    };

    const captureImage = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        if (canvas && video) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);

            // Standard JPEG quality 0.8
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setCapturedImage(dataUrl);

            // Convert to Blob for upload
            fetch(dataUrl)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
                    setSelectedFile(file);
                });

            stopCamera();
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('accessToken', token);
        formData.append('docType', activeDoc);
        formData.append('file', selectedFile);

        try {
            await axios.post(`${API_URL}/upload`, formData); // Axios automatically sets correct multipart/form-data header with boundary

            // Update local state
            setRequest(prev => {
                const newDocs = prev.documents.map(d =>
                    d.type === activeDoc ? { ...d, status: 'Submitted', url: 'temp_optimistic_update' } : d
                );
                return { ...prev, documents: newDocs };
            });

            setIsCameraMode(false);
            setCapturedImage(null);
            setSelectedFile(null); // Clear selected file
            setActiveDoc(null);
            showToast('Document uploaded securely!', 'success');
        } catch (err) {
            console.error(err);
            showToast('Upload failed. Please try again.', 'error');
        } finally {
            setUploading(false);
        }
    };

    const retake = () => {
        setCapturedImage(null);
        setSelectedFile(null);
        if (isCameraMode) {
            startCamera();
        } else {
            // If file mode, just clear
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onload = (event) => {
                if (file.type === 'application/pdf') {
                    // Start of PDF data URL: "data:application/pdf;base64,..."
                    setCapturedImage(event.target.result);
                } else {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;

                        // Resize if larger than 1280px width
                        if (width > 1280) {
                            height *= 1280 / width;
                            width = 1280;
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        // Compress to JPEG 0.8 quality
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                        setCapturedImage(dataUrl);
                    };
                    img.src = event.target.result;
                }
            };
            reader.readAsDataURL(file);
        }
    };

    if (!request) return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500 font-medium">Loading your session...</p>
        </div>
    );

    if (request.isExpired || request.status === 'Submitted') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="text-green-600" size={40} />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h1>
                    <p className="text-gray-500 mb-8">Thank you, {request.clientName || 'valued client'}. Your documents have been securely received and are under review.</p>
                    <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-400">
                        You can close this window now.
                    </div>
                </div>
            </div>
        );
    }

    // Camera View
    if (activeDoc && isCameraMode && !capturedImage) {
        return (
            <div className="fixed inset-0 bg-black z-50 flex flex-col">
                <div className="flex items-center justify-between p-4 bg-black/40 backdrop-blur-sm absolute top-0 left-0 right-0 z-10">
                    <span className="text-white font-bold text-lg drop-shadow-md">{activeDoc}</span>
                    <button onClick={() => { stopCamera(); setActiveDoc(null); setIsCameraMode(false); }} className="p-2 bg-white/20 rounded-full text-white backdrop-blur-md">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover"
                        onLoadedMetadata={startProcessing}
                    />

                    {/* Overlay Guide */}
                    <div className={`absolute inset-0 border-[2px] transition-colors duration-300 pointer-events-none ${isBlurry ? 'border-red-500/50' : 'border-white/30'} m-8 rounded-2xl`}>
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl"></div>

                        {isBlurry && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full text-white font-bold flex items-center gap-2">
                                <AlertTriangle size={20} className="text-yellow-400" />
                                Hold Steady
                            </div>
                        )}
                    </div>
                </div>

                <div className="h-32 bg-black/80 backdrop-blur-sm flex items-center justify-center gap-8 pb-8 pt-4">
                    <canvas ref={canvasRef} className="hidden" />
                    <button
                        onClick={captureImage}
                        disabled={isBlurry || !cvReady}
                        className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all transform active:scale-95 ${isBlurry ? 'border-gray-500 bg-gray-500/20' : 'border-white bg-white/20 hover:bg-white/30'
                            }`}
                    >
                        <div className={`w-16 h-16 rounded-full transition-all duration-300 ${isBlurry ? 'bg-gray-400' : 'bg-white'
                            }`} />
                    </button>
                </div>
                {!cvReady && <div className="absolute bottom-36 left-0 right-0 text-center text-white/50 text-sm font-medium">Initializing Vision AI...</div>}
            </div>
        );
    }

    // Review View
    if (capturedImage) {
        const isPDF = capturedImage.startsWith('data:application/pdf');
        return (
            <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
                <div className="flex-1 p-6 flex flex-col items-center justify-center relative">
                    {isPDF ? (
                        <div className="bg-white/10 p-8 rounded-2xl flex flex-col items-center justify-center text-white animate-in zoom-in-95 duration-300">
                            <div className="w-24 h-24 bg-red-500/20 rounded-2xl flex items-center justify-center mb-6">
                                <FileText size={48} className="text-red-400" />
                            </div>
                            <p className="font-bold text-xl mb-1">PDF Document Selected</p>
                            <p className="text-sm text-gray-400">Ready to securely upload</p>
                        </div>
                    ) : (
                        <img src={capturedImage} alt="Capture" className="max-w-full max-h-[70vh] rounded-xl shadow-2xl object-contain" />
                    )}

                    {!isPDF && (
                        <>
                            <h2 className="text-white text-xl font-bold mt-6 mb-2">Review Capture</h2>
                            <p className="text-gray-400 text-sm">Make sure text is readable and clear</p>
                        </>
                    )}
                </div>

                <div className="bg-gray-800 p-6 flex gap-4 pb-8">
                    <button onClick={retake} disabled={uploading} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                        <RefreshCw size={20} /> {isCameraMode ? 'Retake' : 'Cancel'}
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={uploading}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/50"
                    >
                        {uploading ? <Loader className="animate-spin" /> : <><Upload size={20} /> Use {isPDF ? 'PDF' : 'Photo'}</>}
                    </button>
                </div>

                {uploading && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
                        <p className="text-white font-bold text-xl">Uploading...</p>
                        <p className="text-gray-400 text-sm mt-2">Securely encrypting your document</p>
                    </div>
                )}
            </div>
        );
    }

    // Request List View
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b border-gray-100 p-6 sticky top-0 z-10 shadow-sm">
                <h1 className="text-2xl font-bold text-gray-900">Hi, {request.clientName.split(' ')[0]}</h1>
                <p className="text-gray-500 text-sm mt-1">Please upload the requested documents below.</p>
            </header>

            <div className="flex-1 p-6 space-y-4 max-w-lg mx-auto w-full pb-28">
                {/* Toast Notification */}
                {toast.show && (
                    <div className={`fixed top-4 left-4 right-4 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
                        }`}>
                        {toast.type === 'success' ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
                        <p className="font-medium">{toast.message}</p>
                    </div>
                )}

                {request.documents.map(doc => {
                    const isDone = doc.status === 'Submitted' || doc.status === 'Approved';
                    const isRejected = doc.status === 'Rejected';

                    return (
                        <div key={doc._id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 overflow-hidden">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg text-gray-800">{doc.type}</h3>
                                {isDone ? (
                                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full flex items-center gap-1">
                                        <Check size={12} strokeWidth={3} /> Submitted
                                    </span>
                                ) : isRejected ? (
                                    <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full flex items-center gap-1">
                                        <X size={12} strokeWidth={3} /> Action Needed
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 bg-gray-100 text-gray-500 text-xs font-bold rounded-full">
                                        Pending
                                    </span>
                                )}
                            </div>

                            {isRejected && (
                                <div className="bg-red-50 p-4 rounded-xl mb-4 border border-red-100 flex gap-3 text-red-800">
                                    <AlertTriangle size={20} className="shrink-0" />
                                    <div>
                                        <p className="font-bold text-sm">Rejection Reason</p>
                                        <p className="text-sm mt-1 opacity-90">{doc.rejectionReason}</p>
                                    </div>
                                </div>
                            )}

                            {isDone ? (
                                <div className="h-40 bg-gray-50 rounded-xl relative overflow-hidden group">
                                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                                        <CheckCircle size={64} className="text-green-500/20" />
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="bg-green-500 text-white p-3 rounded-full shadow-lg">
                                            <Check size={32} strokeWidth={3} />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => { setActiveDoc(doc.type); setIsCameraMode(true); startCamera(); }}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                                    >
                                        <Camera size={20} />
                                        {isRejected ? 'Retake' : 'Camera'}
                                    </button>
                                    <button
                                        onClick={() => { setActiveDoc(doc.type); setIsCameraMode(false); fileInputRef.current.click(); }}
                                        className="flex-1 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] text-gray-700 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                                    >
                                        <ImageIcon size={20} />
                                        Upload
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className={`fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100 transition-transform duration-300 ${request.documents.every(d => d.status === 'Submitted' || d.status === 'Approved')
                ? 'translate-y-0'
                : 'translate-y-full'
                }`}>
                <div className="max-w-lg mx-auto">
                    <button
                        onClick={() => {
                            showToast('Application Submitted! You can close this window.', 'success');
                        }}
                        className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-green-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <CheckCircle size={24} /> Complete & Finish
                    </button>
                </div>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
            />
        </div>
    );
}

function CheckCircle(props) {
    return <Check className={props.className} size={props.size} color={props.color} />;
}
