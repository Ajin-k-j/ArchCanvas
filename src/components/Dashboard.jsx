import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { Plus, FolderOpen, LogOut, Crown, Trash2, Clock, X, TerminalSquare } from 'lucide-react';

export default function Dashboard({ onClose, onSelectDesign }) {
  const { currentUser, userData, logout, refreshUserData } = useAuth();
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadDesigns = useCallback(async () => {
    setLoading(true);
    try {
      const q = query( // Removed orderBy to avoid missing Index error
        collection(db, 'designs'), 
        where('ownerId', '==', currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const loadedDesigns = [];
      querySnapshot.forEach((doc) => {
        loadedDesigns.push({ id: doc.id, ...doc.data() });
      });
      // Sort in-memory locally because we only query by equality on ownerId
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
    if(window.confirm('Are you sure you want to delete this design?')) {
      try {
        await deleteDoc(doc(db, 'designs', id));
        
        // Exact count calculation to prevent any desync
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
      {/* Background Overlay to catch outside clicks */}
      <div 
        className="fixed inset-0 bg-transparent z-[140] cursor-pointer" 
        onClick={onClose} 
      />
      <div className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white/95 backdrop-blur-xl shadow-[-20px_0_40px_rgba(0,0,0,0.1)] z-[150] border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300 rounded-l-3xl">
        <div className="p-6 border-b border-slate-100 flex justify-between items-start pt-8">
          <div>
             <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Your Dashboard</h2>
             <p className="text-slate-500 text-sm mt-1">{currentUser.email}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* Subscription Status Card */}
          <div className={`mb-8 p-5 rounded-2xl border ${userData?.isPremium ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100' : 'bg-slate-50 border-slate-200'}`}>
             <div className="flex items-center gap-3 mb-2">
               <div className={`p-2 rounded-xl ${userData?.isPremium ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                  <Crown size={20} />
               </div>
               <div>
                 <h3 className="font-semibold text-slate-800">
                   {userData?.isPremium ? 'Premium Plan' : 'Free Plan'}
                 </h3>
                 <p className="text-xs text-slate-500">
                   {userData?.isPremium ? 'Unlimited designs' : `${designs.length} / 3 designs used`}
                 </p>
               </div>
             </div>
             
             {!userData?.isPremium && (
               <div className="mt-4">
                 <div className="w-full bg-slate-200 rounded-full h-1.5 mb-3">
                   <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(designs.length / 3) * 100}%` }}></div>
                 </div>
                 <button className="w-full py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                   <Crown size={16} /> Upgrade to Premium
                 </button>
               </div>
             )}
          </div>

          {/* Action Buttons */}
          <div className="mb-8">
              <button 
                onClick={handleCreateNew}
                className="w-full py-4 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all group"
              >
                <div className="p-3 bg-white rounded-full shadow-sm mb-2 group-hover:scale-110 transition-transform">
                  <Plus size={24} />
                </div>
                <span className="font-medium">Create New Design</span>
              </button>
          </div>

          {/* Recent Designs */}
          <div>
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <FolderOpen size={18} className="text-slate-400" /> Recent Designs
            </h3>

            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
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
