import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { AntenneGroup, Organization } from '../types';
import { localDb } from '../lib/localDb';

export const DEFAULT_DELEGATIONS = [
  { id: 'france', name: 'Aviation Sans Frontières France' }
];

export const DEFAULT_ANTENNES: Record<string, { id: string; name: string; x?: number; y?: number }[]> = {
  'france': [
    { id: 'nantes', name: 'Nantes', x: 26, y: 28 },
    { id: 'paris', name: 'Paris - Île de France', x: 49, y: 15 },
    { id: 'toulouse', name: 'Toulouse', x: 42, y: 72 },
    { id: 'marseille', name: 'Marseille', x: 69, y: 74 },
    { id: 'lyon', name: 'Lyon', x: 63, y: 44 },
    { id: 'bordeaux', name: 'Bordeaux', x: 29, y: 55 },
    { id: 'lille', name: 'Lille', x: 54, y: 3 },
    { id: 'strasbourg', name: 'Strasbourg', x: 86, y: 16 },
  ],
};

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshOrganization: () => Promise<void>;
  clearError: () => void;
  delegations: { id: string; name: string }[];
  antennes: Record<string, { id: string; name: string; x?: number; y?: number }[]>;
  antenneGroups: AntenneGroup[];
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  organization: null,
  loading: true,
  error: null,
  signOut: async () => {},
  refreshOrganization: async () => {},
  clearError: () => {},
  delegations: DEFAULT_DELEGATIONS,
  antennes: DEFAULT_ANTENNES,
  antenneGroups: [],
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [delegations, setDelegations] = useState<{ id: string; name: string }[]>(DEFAULT_DELEGATIONS);
  const [antennes, setAntennes] = useState<Record<string, { id: string; name: string }[]>>(DEFAULT_ANTENNES);
  const [antenneGroups, setAntenneGroups] = useState<AntenneGroup[]>([]);


  const fetchOrg = async (uid: string, email?: string | null, displayName?: string | null) => {
    const isSandbox = localDb.isSandboxActive();
    const isAdminUser = email ? email.toLowerCase() === (import.meta as any).env.VITE_ADMIN_EMAIL?.toLowerCase() : false;
    
    // Check for any locally saved wizard-flow registration info (to bypass race conditions/Google defaults)
    let pendingReg: any = null;
    try {
      const stored = localStorage.getItem('asf_pending_registration');
      if (stored) {
        pendingReg = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Could not read pending registration in fetchOrg", e);
    }

    const defaultName = pendingReg?.name || displayName || (isAdminUser ? 'Aviation Sans Frontières - Direction' : 'Compagnie Partenaire');
    const defaultContact = pendingReg?.contactName || displayName || (isAdminUser ? 'Personnel Aviation Sans Frontières' : 'Contact');
    const defaultEmail = pendingReg?.email || email || '';
    const defaultPhone = pendingReg?.phone || '';
    const delegationId = pendingReg?.delegation_id || (isAdminUser ? '' : 'france');
    const antenneId = pendingReg?.antenne_id || '';

    if (isSandbox) {
      console.log("Using Local Storage Sandbox organization data...");
      const localOrgs = localDb.getOrganizations();
      let found = localOrgs.find(o => o.id === uid);
      if (!found) {
        found = {
          id: uid,
          name: defaultName,
          contactName: defaultContact,
          email: defaultEmail,
          phone: defaultPhone,
          submissionStatus: isAdminUser ? 'Validated' : 'Pending',
          role: isAdminUser ? 'super_admin' : 'organization',
          delegation_id: delegationId,
          antenne_id: antenneId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        localDb.saveOrganization(found);
      } else if (isAdminUser && found.role !== 'super_admin' && found.role !== 'admin') {
        found.role = 'super_admin';
        found.updatedAt = Date.now();
        localDb.saveOrganization(found);
      }
      setOrganization(found);
      return;
    }

    try {
      const docRef = doc(db, 'organizations', uid);
      let docSnap;
      try {
        docSnap = await getDoc(docRef);
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        if (errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('limit exceeded') || errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('insufficient')) {
          console.warn("Firestore Quota reached during fetchOrg! Activating local sandbox mode.");
          localDb.setSandboxActive(true);
          await fetchOrg(uid, email, displayName);
          return;
        } else {
          throw err;
        }
      }

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (isAdminUser && data.role !== 'super_admin' && data.role !== 'admin') {
          const updated = { ...data, role: 'super_admin' as const, updatedAt: Date.now() };
          await setDoc(docRef, updated);
          setOrganization({ id: docSnap.id, ...updated } as Organization);
        } else {
          setOrganization({ id: docSnap.id, ...data } as Organization);
        }
      } else {
        const newOrgData = {
          name: defaultName,
          contactName: defaultContact,
          email: defaultEmail,
          phone: defaultPhone,
          submissionStatus: isAdminUser ? 'Validated' : 'Pending',
          role: isAdminUser ? 'super_admin' : 'organization',
          delegation_id: delegationId,
          antenne_id: antenneId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        try {
          await setDoc(docRef, newOrgData);
          setOrganization({ id: uid, ...newOrgData } as Organization);
        } catch (err: any) {
          console.error('Failed to auto-create profile:', err);
          const errMsg = err?.message || String(err);
          if (errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('limit exceeded')) {
            localDb.setSandboxActive(true);
            await fetchOrg(uid, email, displayName);
          } else {
            setOrganization(null);
            handleFirestoreError(err, OperationType.WRITE, `organizations/${uid}`);
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching org:', error);
      const errMsg = error?.message || String(error);
      if (errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('limit exceeded') || errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('insufficient')) {
        localDb.setSandboxActive(true);
        const localOrgs = localDb.getOrganizations();
        let found = localOrgs.find(o => o.id === uid);
        if (!found) {
          found = {
            id: uid,
            name: defaultName,
            contactName: defaultContact,
            email: defaultEmail,
            phone: defaultPhone,
            submissionStatus: isAdminUser ? 'Validated' : 'Pending',
            role: isAdminUser ? 'super_admin' : 'organization',
            delegation_id: delegationId,
            antenne_id: antenneId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          localDb.saveOrganization(found);
        }
        setOrganization(found);
      } else {
        setOrganization(null);
        handleFirestoreError(error, OperationType.GET, `organizations/${uid}`);
      }
    }
  };

  const refreshOrganization = async () => {
    if (user) {
      await fetchOrg(user.uid, user.email, user.displayName);
    }
  };

  const clearError = () => setError(null);

  useEffect(() => {
    let unsubOrgDoc = () => {};

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setError(null);
      setUser(currentUser);
      unsubOrgDoc(); // Clear previous listener if any

      if (currentUser) {
        const isAdminUser = (currentUser.email ? currentUser.email.toLowerCase() === (import.meta as any).env.VITE_ADMIN_EMAIL?.toLowerCase() : false);
        
        if (localDb.isSandboxActive()) {
          await fetchOrg(currentUser.uid, currentUser.email, currentUser.displayName);
          setLoading(false);
        } else {
          try {
            const docRef = doc(db, 'organizations', currentUser.uid);
            unsubOrgDoc = onSnapshot(docRef, async (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data();
                if (isAdminUser && data.role !== 'super_admin' && data.role !== 'admin') {
                  const updated = { ...data, role: 'super_admin' as const, updatedAt: Date.now() };
                  await setDoc(docRef, updated);
                  setOrganization({ id: docSnap.id, ...updated } as Organization);
                } else {
                  setOrganization({ id: docSnap.id, ...data } as Organization);
                }
              } else {
                await fetchOrg(currentUser.uid, currentUser.email, currentUser.displayName);
              }
              setLoading(false);
            }, async (err) => {
              console.warn("Real-time organization subscription failed:", err);
              await fetchOrg(currentUser.uid, currentUser.email, currentUser.displayName);
              setLoading(false);
            });
          } catch (err) {
            console.error("Setting up organization listener failed:", err);
            await fetchOrg(currentUser.uid, currentUser.email, currentUser.displayName);
            setLoading(false);
          }
        }
      } else {
        setOrganization(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      unsubOrgDoc();
    };
  }, []);

  // Listen to 'localdb-update' so sandbox changes (like validating an org, changing role, delegation or antenne) propagate instantly!
  useEffect(() => {
    const handleLocalDbUpdate = () => {
      if (user && localDb.isSandboxActive()) {
        const localOrgs = localDb.getOrganizations();
        const found = localOrgs.find(o => o.id === user.uid);
        if (found) {
          setOrganization(found);
        }
      }
    };

    window.addEventListener('localdb-update', handleLocalDbUpdate);
    return () => window.removeEventListener('localdb-update', handleLocalDbUpdate);
  }, [user]);

  useEffect(() => {
    let unsubDelegations = () => {};
    let unsubAntennes = () => {};

    const loadLocalDelegations = () => {
      const list = localDb.getDelegations();
      setDelegations(list);
    };

    const loadLocalAntennes = () => {
      const map = localDb.getAntennes();
      setAntennes(map);
    };

    if (localDb.isSandboxActive()) {
      loadLocalDelegations();
      loadLocalAntennes();
    } else {
      try {
        unsubDelegations = onSnapshot(collection(db, 'delegations'), (snapshot) => {
          const list = [...DEFAULT_DELEGATIONS];
          snapshot.forEach((doc) => {
            const data = doc.data();
            const id = doc.id;
            if (!list.some(d => d.id === id)) {
              list.push({ id, name: data.name });
            } else {
              const idx = list.findIndex(d => d.id === id);
              if (idx !== -1) {
                list[idx] = { id, name: data.name };
              }
            }
          });
          list.sort((a, b) => a.name.localeCompare(b.name));
          setDelegations(list);
        }, (err) => {
          console.error("Error loading delegations from db, activating local fallback:", err);
          localDb.setSandboxActive(true);
          loadLocalDelegations();
          loadLocalAntennes();
        });
      } catch (e) {
        console.error("Snapshot error for delegations, fallback to local:", e);
        localDb.setSandboxActive(true);
        loadLocalDelegations();
        loadLocalAntennes();
      }

      try {
        unsubAntennes = onSnapshot(collection(db, 'antennes'), (snapshot) => {
          const map = { ...DEFAULT_ANTENNES };
          Object.keys(map).forEach(key => {
            map[key] = [...map[key]];
          });

          snapshot.forEach((doc) => {
            const data = doc.data();
            const id = doc.id;
            const delegationId = data.delegation_id || 'france';
            if (delegationId) {
              if (!map[delegationId]) {
                map[delegationId] = [];
              }
              if (data.deleted) {
                map[delegationId] = map[delegationId].filter(a => a.id !== id);
                Object.keys(map).forEach(key => {
                  map[key] = map[key].filter(a => a.id !== id);
                });
                return;
              }
              const item = { id, name: data.name, x: data.x, y: data.y };
              if (!map[delegationId].some(a => a.id === id)) {
                map[delegationId].push(item);
              } else {
                const idx = map[delegationId].findIndex(a => a.id === id);
                if (idx !== -1) {
                  map[delegationId][idx] = { 
                    id, 
                    name: data.name, 
                    x: data.x !== undefined ? data.x : map[delegationId][idx].x,
                    y: data.y !== undefined ? data.y : map[delegationId][idx].y
                  };
                }
              }
            }
          });

          Object.keys(map).forEach(key => {
            map[key].sort((a, b) => a.name.localeCompare(b.name));
          });

          setAntennes(map);
        }, (err) => {
          console.error("Error loading antennes from db, activating local fallback:", err);
          localDb.setSandboxActive(true);
          loadLocalDelegations();
          loadLocalAntennes();
        });
      } catch (e) {
        console.error("Snapshot error for antennes, fallback to local:", e);
        localDb.setSandboxActive(true);
        loadLocalDelegations();
        loadLocalAntennes();
      }
    }

    return () => {
      unsubDelegations();
      unsubAntennes();
    };
  }, []);

  // Real-time loading of antenne groups (super admin feature). Public read.
  useEffect(() => {
    let unsubGroups = () => {};

    const loadLocalGroups = () => setAntenneGroups(localDb.getGroups());

    if (localDb.isSandboxActive()) {
      loadLocalGroups();
      const handleLocalDbUpdate = () => {
        if (localDb.isSandboxActive()) loadLocalGroups();
      };
      window.addEventListener('localdb-update', handleLocalDbUpdate);
      return () => window.removeEventListener('localdb-update', handleLocalDbUpdate);
    }

    try {
      unsubGroups = onSnapshot(collection(db, 'antenne_groups'), (snapshot) => {
        const list: AntenneGroup[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            name: data.name,
            color: data.color || undefined,
            antenneIds: Array.isArray(data.antenneIds) ? data.antenneIds : [],
            createdAt: data.createdAt || 0,
            updatedAt: data.updatedAt || 0,
          });
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setAntenneGroups(list);
      }, (err) => {
        console.error("Error loading antenne groups, activating local fallback:", err);
        localDb.setSandboxActive(true);
        loadLocalGroups();
      });
    } catch (e) {
      console.error("Snapshot error for antenne groups, fallback to local:", e);
      localDb.setSandboxActive(true);
      loadLocalGroups();
    }

    return () => unsubGroups();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setError(null);
  };

  return (
    <AuthContext.Provider value={{ user, organization, loading, error, signOut, refreshOrganization, clearError, delegations, antennes, antenneGroups }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
