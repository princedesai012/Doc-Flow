import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import {
    MessageCircle, CheckCircle, RefreshCw, X, Eye,
    Download, Plus, Search, FileText, Smartphone, Trash2,
    LogOut, Lock, ShieldCheck
} from 'lucide-react';
import { SOCKET_URL, API_URL } from '../api';

// Simple client-side auth for demonstration
const ADMIN_PASS = 'admin123';

export default function Dashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');

    // Check session storage on load
    useEffect(() => {
        if (sessionStorage.getItem('auth') === 'true') {
            setIsAuthenticated(true);
        }
    }, []);

    const handleLogin = (e) => {
        e.preventDefault();
        if (password === ADMIN_PASS) {
            setIsAuthenticated(true);
            sessionStorage.setItem('auth', 'true');
        } else {
            alert('Invalid Password');
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        sessionStorage.removeItem('auth');
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 sticky top-0">
                <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/20">
                    <div className="flex flex-col items-center mb-6">
                        <div className="bg-blue-600 p-3 rounded-full mb-4 shadow-lg shadow-blue-500/30">
                            <Lock className="text-white" size={32} />
                        </div>
                        <h1 className="text-2xl font-bold text-white">Admin Access</h1>
                        <p className="text-gray-400 text-sm">Enter security code to continue</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="password"
                            placeholder="Passcode"
                            className="w-full bg-gray-800/50 border border-gray-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-500 text-center tracking-widest text-lg"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                        <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3 rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-blue-900/50">
                            Unlock Dashboard
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return <DashboardContent onLogout={handleLogout} />;
}

function DashboardContent({ onLogout }) {
    const [waStatus, setWaStatus] = useState({ isReady: false, qrCode: '' });
    const [requests, setRequests] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [viewImage, setViewImage] = useState(null);

    // Form State
    const [formData, setFormData] = useState({ clientName: '', whatsappNumber: '', requestedDocs: [] });

    const AVAILABLE_DOCS = ['Aadhaar Card', 'PAN Card', 'Voter ID', 'Passport', 'Driving License', 'Passport Size Photo', 'Bank Statement', 'Cancelled Cheque', 'Form 16', 'Salary Slips', 'Rent Agreement', 'Electricity Bill', 'Property Tax Receipt', 'GST Registration Certificate', 'Udhyam Aadhar', 'Shop & Establishment Certificate', 'Sales Invoices', 'Purchase Invoices', 'Expense Vouchers', 'Previous ITR Copies', 'Balance Sheet', 'Profit & Loss Statement', 'LIC Premium Receipt', 'Tuition Fee Receipt', 'Home Loan Interest Certificate', 'Partnership Deed', 'Certificate of Incorporation', 'Digital Signature Certificate (DSC)']

    useEffect(() => {
        const newSocket = io(SOCKET_URL);
        newSocket.on('connect', () => console.log('Socket Connected'));
        newSocket.on('whatsapp_qr', (qr) => setWaStatus({ isReady: false, qrCode: qr }));
        newSocket.on('whatsapp_ready', () => setWaStatus({ isReady: true, qrCode: '' }));
        newSocket.on('request_updated', (updatedRequest) => {
            setRequests(prev => prev.map(r => r._id === updatedRequest._id ? updatedRequest : r));
            if (selectedRequest && selectedRequest._id === updatedRequest._id) {
                setSelectedRequest(updatedRequest);
            }
        });

        fetchRequests();
        return () => newSocket.close();
    }, [selectedRequest]);

    const fetchRequests = async () => {
        try {
            const res = await axios.get(`${API_URL}/requests`);
            setRequests(res.data);
        } catch (err) { console.error(err); }
    };

    const handleCreateRequest = async (e) => {
        e.preventDefault();
        if (formData.requestedDocs.length === 0) return alert('Select at least one document');
        try {
            await axios.post(`${API_URL}/request`, formData);
            setFormData({ clientName: '', whatsappNumber: '', requestedDocs: [] });
            setShowCreateModal(false);
            fetchRequests();
            alert('Request Sent Successfully!');
        } catch (err) { alert('Failed to send request'); }
    };

    const handleUpdateStatus = async (requestId, docId, status, rejectionReason = '') => {
        try {
            await axios.put(`${API_URL}/request/${requestId}/doc/${docId}`, { status, rejectionReason });
            fetchRequests();
            if (selectedRequest) {
                // Refresh selected request locally
                const res = await axios.get(`${API_URL}/requests`);
                const freshReq = res.data.find(r => r._id === selectedRequest._id);
                if (freshReq) setSelectedRequest(freshReq);
            }
        } catch (err) { alert('Failed to update status'); }
    };

    const handleDeleteRequest = async (id, e) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this request? This cannot be undone.')) {
            try {
                await axios.delete(`${API_URL}/request/${id}`);
                fetchRequests();
            } catch (err) {
                console.error(err);
                alert('Failed to delete request');
            }
        }
    };

    const handleDownload = async (url, filename) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) { alert('Download failed'); }
    };

    const toggleDocSelection = (doc) => {
        setFormData(prev => ({
            ...prev,
            requestedDocs: prev.requestedDocs.includes(doc)
                ? prev.requestedDocs.filter(d => d !== doc)
                : [...prev.requestedDocs, doc]
        }));
    };

    const filteredRequests = requests.filter(r =>
        r.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.whatsappNumber.includes(searchTerm)
    );

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-white hidden md:flex flex-col shadow-2xl z-20">
                <div className="p-6 flex items-center gap-3 border-b border-gray-800">
                    <div className="bg-blue-600 p-2 rounded-lg">
                        <MessageCircle className="text-white" size={24} />
                    </div>
                    <div>
                        <span className="text-lg font-bold tracking-tight">DocuCollect</span>
                        <p className="text-xs text-gray-400">SmartFin Admin</p>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <div className="flex items-center gap-3 px-4 py-3 bg-blue-600/20 text-blue-400 rounded-xl cursor-pointer transition-all border border-blue-600/30">
                        <FileText size={20} />
                        <span className="font-medium">Dashboard</span>
                    </div>
                </nav>

                <div className="p-4 border-t border-gray-800">
                    <div className="bg-gray-800/50 rounded-xl p-4 backdrop-blur-sm border border-gray-700/50">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">WhatsApp Status</span>
                            {waStatus.isReady ? (
                                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                            ) : (
                                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
                            )}
                        </div>

                        {waStatus.isReady ? (
                            <div className="flex flex-col items-center gap-2 py-2">
                                <div className="p-2 bg-green-500/20 rounded-full">
                                    <CheckCircle className="text-green-500" size={20} />
                                </div>
                                <span className="text-sm font-medium text-green-400">System Online</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3">
                                {waStatus.qrCode ? (
                                    <div className="bg-white p-2 rounded-lg">
                                        <img src={waStatus.qrCode} alt="QR" className="w-24 h-24 rounded" />
                                    </div>
                                ) : (
                                    <RefreshCw className="animate-spin text-blue-500" size={24} />
                                )}
                                <span className="text-xs text-center text-gray-400">Scan to connect bot</span>
                            </div>
                        )}
                    </div>

                    <button onClick={onLogout} className="mt-4 w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white hover:bg-gray-800 p-2 rounded-lg transition-all text-sm">
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50/50">
                <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm z-10">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Overview</h1>
                        <p className="text-sm text-gray-500">Welcome back, Admin</p>
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="Search client or number..."
                            className="pl-10 pr-4 py-2.5 bg-gray-100 border-transparent focus:bg-white border focus:border-blue-500 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 w-72 transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-8">
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
                            <div>
                                <h3 className="text-gray-500 text-sm font-medium mb-1">Total Requests</h3>
                                <div className="text-3xl font-bold text-gray-800">{requests.length}</div>
                            </div>
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                <FileText className="text-blue-600" size={24} />
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
                            <div>
                                <h3 className="text-gray-500 text-sm font-medium mb-1">Completed</h3>
                                <div className="text-3xl font-bold text-green-600">{requests.filter(r => r.status === 'Approved').length}</div>
                            </div>
                            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center group-hover:bg-green-100 transition-colors">
                                <ShieldCheck className="text-green-600" size={24} />
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
                            <div>
                                <h3 className="text-gray-500 text-sm font-medium mb-1">Pending Review</h3>
                                <div className="text-3xl font-bold text-yellow-600">{requests.filter(r => r.status === 'Submitted').length}</div>
                            </div>
                            <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center group-hover:bg-yellow-100 transition-colors">
                                <RefreshCw className="text-yellow-600" size={24} />
                            </div>
                        </div>
                    </div>

                    {/* Request Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredRequests.map(req => (
                            <div
                                key={req._id}
                                onClick={() => setSelectedRequest(req)}
                                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800 group-hover:text-blue-600 transition-colors">{req.clientName}</h3>
                                        <div className="flex items-center gap-1.5 text-gray-500 text-sm mt-1">
                                            <Smartphone size={14} />
                                            <span>{req.whatsappNumber}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${req.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                            req.status === 'Submitted' ? 'bg-yellow-100 text-yellow-700' :
                                                req.status === 'Partial' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-blue-50 text-blue-700'
                                            }`}>
                                            {req.status}
                                        </span>
                                        <button
                                            onClick={(e) => handleDeleteRequest(req._id, e)}
                                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="h-px bg-gray-100 mb-4"></div>

                                <div className="flex flex-wrap gap-2">
                                    {req.documents.map(doc => {
                                        let bg = 'bg-gray-50 text-gray-500 border-gray-200';
                                        if (doc.status === 'Submitted') bg = 'bg-yellow-50 text-yellow-700 border-yellow-200 shadow-sm';
                                        if (doc.status === 'Approved') bg = 'bg-green-50 text-green-700 border-green-200 shadow-sm';
                                        if (doc.status === 'Rejected') bg = 'bg-red-50 text-red-700 border-red-200 shadow-sm';

                                        return (
                                            <span key={doc._id} className={`text-xs px-2.5 py-1 rounded-md border ${bg} transition-all`}>
                                                {doc.type}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Create Request FAB */}
                <button
                    className="absolute bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl shadow-lg shadow-blue-600/30 transition-all transform hover:scale-110 active:scale-95"
                    onClick={() => setShowCreateModal(true)}
                >
                    <Plus size={28} />
                </button>
            </main>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
                            <h2 className="text-xl font-bold text-gray-800">New Document Request</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="p-8 overflow-y-auto">
                            <form onSubmit={handleCreateRequest} className="space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Client Name</label>
                                        <input
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all placeholder:text-gray-400"
                                            placeholder="e.g. John Doe"
                                            value={formData.clientName}
                                            onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">WhatsApp Number</label>
                                        <input
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all placeholder:text-gray-400"
                                            placeholder="e.g. 919876543210 (with country code)"
                                            value={formData.whatsappNumber}
                                            onChange={e => setFormData({ ...formData, whatsappNumber: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-3">Required Documents</label>
                                    <div className="flex flex-wrap gap-2">
                                        {AVAILABLE_DOCS.map(doc => (
                                            <button
                                                key={doc}
                                                type="button"
                                                onClick={() => toggleDocSelection(doc)}
                                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${formData.requestedDocs.includes(doc)
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                    }`}
                                            >
                                                {doc}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-xl shadow-blue-600/20 transform active:scale-[0.98] transition-all">
                                    Send Request
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Review Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">{selectedRequest.clientName}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm text-gray-500 flex items-center gap-1"><Smartphone size={14} /> {selectedRequest.whatsappNumber}</span>
                                    <span className="text-gray-300">|</span>
                                    <span className="text-sm text-gray-500">Requested {new Date(selectedRequest.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                                {selectedRequest.documents.map(doc => (
                                    <div key={doc._id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 group hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-4">
                                            <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${doc.status === 'Submitted' ? 'bg-yellow-500' :
                                                    doc.status === 'Approved' ? 'bg-green-500' :
                                                        doc.status === 'Rejected' ? 'bg-red-500' : 'bg-gray-300'
                                                    }`}></div>
                                                {doc.type}
                                            </h4>
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wide ${doc.status === 'Submitted' ? 'bg-yellow-100 text-yellow-700' :
                                                doc.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                                    doc.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                                                }`}>{doc.status}</span>
                                        </div>

                                        <div className="aspect-video bg-gray-50 rounded-xl overflow-hidden mb-4 relative border border-gray-100 group-hover:border-blue-100 transition-colors">
                                            {doc.url ? (
                                                doc.url.toLowerCase().endsWith('.pdf') ? (
                                                    <div className="flex flex-col items-center justify-center h-full bg-red-50 group-hover:bg-red-100 transition-colors cursor-pointer" onClick={() => window.open(doc.url, '_blank')}>
                                                        <FileText size={48} className="text-red-500 mb-2" />
                                                        <span className="text-xs font-bold text-red-600">PDF Document</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <img src={doc.url} alt={doc.type} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                            <button
                                                                onClick={() => setViewImage(doc.url)}
                                                                className="bg-white/90 text-gray-900 px-4 py-2 rounded-lg font-medium text-sm hover:bg-white shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all"
                                                            >
                                                                View Fullscreen
                                                            </button>
                                                        </div>
                                                    </>
                                                )
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                                    <div className="p-4 bg-gray-100 rounded-full mb-2">
                                                        <Eye size={24} className="opacity-50" />
                                                    </div>
                                                    <span className="text-sm font-medium">No document uploaded</span>
                                                </div>
                                            )}
                                        </div>

                                        {doc.url && (
                                            <div className="flex justify-between items-center">
                                                <button
                                                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-blue-600 transition-colors px-3 py-2 hover:bg-blue-50 rounded-lg"
                                                    onClick={() => {
                                                        const ext = doc.url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'jpg';
                                                        handleDownload(doc.url, `${selectedRequest.clientName}_${doc.type}.${ext}`)
                                                    }}
                                                >
                                                    <Download size={14} /> Download
                                                </button>

                                                {doc.status === 'Submitted' && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-xs font-bold transition-colors"
                                                            onClick={() => handleUpdateStatus(selectedRequest._id, doc._id, 'Approved')}
                                                        >
                                                            <CheckCircle size={14} /> Approve
                                                        </button>
                                                        <button
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-bold transition-colors"
                                                            onClick={() => {
                                                                const r = prompt('Reason for rejection:');
                                                                if (r) handleUpdateStatus(selectedRequest._id, doc._id, 'Rejected', r);
                                                            }}
                                                        >
                                                            <X size={14} /> Reject
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox */}
            {viewImage && (
                <div
                    className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setViewImage(null)}
                >
                    <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
                        <X size={32} />
                    </button>
                    <img
                        src={viewImage}
                        alt="Fullscreen"
                        className="max-w-full max-h-[90vh] object-contain shadow-2xl rounded-lg animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
