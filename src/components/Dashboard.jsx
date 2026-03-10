import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { Plus, FolderOpen, LogOut, Crown, Trash2, Clock, X, TerminalSquare, Mail, Sparkles } from 'lucide-react';

export default function Dashboard({ onClose, onSelectDesign }) {
  const { currentUser, userData, logout, refreshUserData } = useAuth();
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const navigate = useNavigate();

  const loadDesigns = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'designs'), 
        where('ownerId', '==', currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const loadedDesigns = [];
      querySnapshot.forEach((d) => {
        loadedDesigns.push({ id: d.id, ...d.data() });
      });
      loadedDesigns.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setDesigns(loadedDesigns);
    } catch (error) {
      console.error("Error loading designs:", error);
    }
    setLoading(false);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadDesigns();
    }
  }, [currentUser, loadDesigns]);

  const handleCreateNew = () => {
    onSelectDesign(null); 
    onClose();
    navigate('/');
  };

  const handleOpenDesign = (id) => {
    onClose();
    onSelectDesign(id);
    navigate(`/design/${id}`);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this design?')) {
      try {
        await deleteDoc(doc(db, 'designs', id));
        if (!userData?.isPremium) {
          const q = query(collection(db, 'designs'), where('ownerId', '==', currentUser.uid));
          const snapshot = await getDocs(q);
          const actualCount = snapshot.size;
          const userRef = doc(db, 'users', currentUser.uid);
          await setDoc(userRef, { designCount: actualCount }, { merge: true });
        }
        await refreshUserData();
        loadDesigns();
      } catch (error) {
        console.error("Error deleting design", error);
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    onClose();
    navigate('/');
  };

  if (!currentUser) return null;

  return (
    <>
      {/* Background Overlay */}
      <div 
        className="fixed inset-0 bg-transparent z-[140] cursor-pointer" 
        onClick={onClose} 
      />

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowUpgradeModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full z-10 animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
            >
              <X size={16} />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mb-5 shadow-lg shadow-orange-200">
                <Crown size={28} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Upgrade to Premium</h2>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                We are currently integrating payments. Contact our admin directly to get <strong>Premium access</strong> right away!
              </p>
              <a
                href="mailto:thinkerbytes.live@gmail.com?subject=Premium Access Request - ArchCanvas"
                className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-2xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-orange-100"
              >
                <Mail size={18} /> thinkerbytes.live@gmail.com
              </a>
              <p className="text-slate-400 text-xs mt-4">Click to open your mail client</p>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white/95 backdrop-blur-xl shadow-[-20px_0_40px_rgba(0,0,0,0.1)] z-[150] border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300 rounded-l-3xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-start pt-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Your Dashboard</h2>
              {userData?.isPremium && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-bold rounded-full shadow-sm">
                  <Sparkles size={10} /> PRO
                </span>
              )}
            </div>
            <p className="text-slate-500 text-sm">{currentUser.email}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* Subscription Status Card */}
          <div className={`mb-8 p-5 rounded-2xl border ${userData?.isPremium ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-xl ${userData?.isPremium ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
                <Crown size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">
                  {userData?.isPremium ? '✨ Premium Plan' : 'Free Plan'}
                </h3>
                <p className="text-xs text-slate-500">
                  {userData?.isPremium ? 'Unlimited designs — enjoy!' : `${designs.length} / 3 designs used`}
                </p>
              </div>
            </div>
            
            {!userData?.isPremium && (
              <div className="mt-4">
                <div className="w-full bg-slate-200 rounded-full h-1.5 mb-3">
                  <div 
                    className={`h-1.5 rounded-full transition-all ${designs.length >= 3 ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min((designs.length / 3) * 100, 100)}%` }}
                  ></div>
                </div>
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="w-full py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md shadow-orange-100"
                >
                  <Crown size={16} /> Upgrade to Premium
                </button>
              </div>
            )}
          </div>

          {/* Recent Designs */}
          <div className="mb-6">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <FolderOpen size={18} className="text-slate-400" /> Recent Designs
            </h3>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-xl"></div>
                ))}
              </div>
            ) : designs.length === 0 ? (
              <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-slate-100">
                <TerminalSquare size={32} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium text-sm">No saved designs yet.</p>
                <p className="text-slate-400 text-xs mt-1">Create one to get started!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {designs.map(design => (
                  <div 
                    key={design.id}
                    onClick={() => handleOpenDesign(design.id)}
                    className="group p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex justify-between items-center"
                  >
                    <div className="overflow-hidden">
                      <h4 className="font-medium text-slate-800 truncate mb-1">{design.title || 'Untitled Design'}</h4>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock size={12} />
                        {design.updatedAt ? new Date(design.updatedAt.toDate()).toLocaleDateString() : 'Just now'}
                      </p>
                    </div>
                    <button 
                      onClick={(e) => handleDelete(e, design.id)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create New Design — below recent designs */}
          <button 
            onClick={handleCreateNew}
            className="w-full py-4 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center gap-3 text-slate-500 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all group"
          >
            <div className="p-1.5 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
              <Plus size={18} />
            </div>
            <span className="font-medium">Create New Design</span>
          </button>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 rounded-bl-3xl">
          <button 
            onClick={handleLogout}
            className="w-full py-3 flex items-center justify-center gap-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
