import React, { useState, useEffect } from 'react';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, getDocs, addDoc, query, where, doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { LogoASF } from './LandingPage';
import { ShieldCheck, Upload, Loader2, AlertCircle, CheckCircle2, ChevronRight, CornerDownRight, ArrowLeft } from 'lucide-react';

interface PublicUploadFormProps {
  onNavigateHome: () => void;
}

interface Delegation {
  id: string;
  name: string;
}

interface Antenne {
  id: string;
  name: string;
  delegation_id: string;
}

export default function PublicUploadForm({ onNavigateHome }: PublicUploadFormProps) {
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [antennes, setAntennes] = useState<Antenne[]>([]);
  const [filteredAntennes, setFilteredAntennes] = useState<Antenne[]>([]);
  
  const [selectedDelegation, setSelectedDelegation] = useState('');
  const [selectedAntenne, setSelectedAntenne] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  
  const [documentName, setDocumentName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ docId: string; url: string } | null>(null);

  // Default seed list to populate the Firestore database if it is empty
  const defaultDelegations: Delegation[] = [
    { id: 'ouest', name: 'Délégation Ouest' },
    { id: 'occitanie', name: 'Délégation Occitanie Toulouse' },
    { id: 'sud-est', name: 'Délégation Sud-Est' },
    { id: 'antilles', name: 'Délégation Antilles' },
  ];

  const defaultAntennes: Antenne[] = [];

  // 1. Initial Seeding and Fetching
  useEffect(() => {
    const initData = async () => {
      try {
        // Try getting delegations from Firestore
        const delCol = collection(db, 'delegations');
        let delSnap = await getDocs(delCol);
        
        // If empty, let's write default list in database
        if (delSnap.empty) {
          for (const del of defaultDelegations) {
            await setDoc(doc(db, 'delegations', del.id), { name: del.name });
          }
          delSnap = await getDocs(delCol);
        }
        
        const fetchedDel: Delegation[] = [];
        delSnap.forEach(doc => {
          fetchedDel.push({ id: doc.id, ...doc.data() } as Delegation);
        });
        setDelegations(fetchedDel);

        // Try getting antennas from Firestore
        const antCol = collection(db, 'antennes');
        let antSnap = await getDocs(antCol);

        if (antSnap.empty) {
          for (const ant of defaultAntennes) {
            await setDoc(doc(db, 'antennes', ant.id), { 
              name: ant.name, 
              delegation_id: ant.delegation_id 
            });
          }
          antSnap = await getDocs(antCol);
        }

        const fetchedAnt: Antenne[] = [];
        antSnap.forEach(doc => {
          fetchedAnt.push({ id: doc.id, ...doc.data() } as Antenne);
        });
        setAntennes(fetchedAnt);

        // 2. Magic Link Check from URL parameters (e.g., ?antenne_id=toulouse)
        const params = new URLSearchParams(window.location.search);
        const urlAntenneId = params.get('antenne_id');
        
        if (urlAntenneId) {
          const matchedAnt = fetchedAnt.find(a => a.id === urlAntenneId);
          if (matchedAnt) {
            setSelectedDelegation(matchedAnt.delegation_id);
            setSelectedAntenne(matchedAnt.id);
            setIsLocked(true);
          }
        }
      } catch (err) {
        console.error('Error fetching structural data:', err);
      }
    };

    initData();
  }, []);

  // 3. Dynamic Filter: Update Antennes when Delegation selection changes
  useEffect(() => {
    if (selectedDelegation) {
      const filtered = antennes.filter(ant => ant.delegation_id === selectedDelegation);
      setFilteredAntennes(filtered);
      
      // If the current selected antenna is not in the filtered selection, reset it unless locked
      if (!isLocked && selectedAntenne && !filtered.some(ant => ant.id === selectedAntenne)) {
        setSelectedAntenne('');
      }
    } else {
      setFilteredAntennes([]);
      if (!isLocked) {
        setSelectedAntenne('');
      }
    }
  }, [selectedDelegation, antennes, isLocked]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!documentName) {
        // Strip file extension to prefill document name beautifully
        const nameWithoutExt = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;
        setDocumentName(nameWithoutExt);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDelegation || !selectedAntenne || !file || !documentName.trim()) {
      setErrorMessage('Veuillez remplir tous les champs et sélectionner un fichier.');
      return;
    }

    setStatus('loading');
    setErrorMessage('');
    setSuccessInfo(null);
    setUploadProgress(0);

    try {
      // Step A: Upload to Firebase Storage
      const storagePath = `public_uploads/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(progress);
        }, 
        (error) => {
          console.error("Storage upload error:", error);
          setStatus('error');
          setErrorMessage("Échec du téléversement du fichier : " + error.message);
        }, 
        async () => {
          // Upload complete, get downlaod URL
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Step B: Create Firestore document in '/files' collection with status 'Pending'
          const fileData = {
            orgId: 'public', // Set as public as requested
            name: documentName.trim(),
            size: file.size,
            type: file.type || 'application/octet-stream',
            storagePath: storagePath,
            fallbackDataUrl: downloadUrl,
            uploadDate: Date.now(),
            delegation_id: selectedDelegation,
            antenne_id: selectedAntenne,
            submissionStatus: 'Pending', // Initialized as Pending (En attente) as requested
            uploadedBy: 'user' as const
          };

          try {
            const docRef = await addDoc(collection(db, 'files'), fileData);
            setStatus('success');
            setSuccessInfo({ docId: docRef.id, url: downloadUrl });
            setFile(null);
            setDocumentName('');
            setUploadProgress(null);
          } catch (fireErr) {
            console.error("Firestore save error:", fireErr);
            setStatus('error');
            setErrorMessage("Erreur lors de l'enregistrement des métadonnées du fichier.");
            handleFirestoreError(fireErr, OperationType.CREATE, 'files');
          }
        }
      );

    } catch (err: any) {
      console.error("Submission failed:", err);
      setStatus('error');
      setErrorMessage(err.message || String(err));
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-center items-center bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      
      {/* Back button */}
      <button 
        onClick={onNavigateHome}
        className="absolute top-6 left-6 flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#1b98c4] transition-colors cursor-pointer bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-3xs"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Retour à l'accueil
      </button>

      <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200/80 shadow-xl p-6 md:p-10 space-y-8 mt-12 md:mt-0">
        
        {/* Header */}
        <div className="text-center flex flex-col items-center space-y-3">
          <LogoASF className="w-16 h-16 transition-transform hover:scale-105 duration-300" variant="color" />
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 font-display">
              Dépôt Public de Documents
            </h1>
            <p className="text-xs text-slate-400 font-mono uppercase tracking-wider mt-1">
              Aviation Sans Frontières — Portail de Téléversement Anonyme
            </p>
          </div>
          <div className="bg-[#1b98c4]/15 border border-[#1b98c4]/20 rounded-xl px-4 py-2.5 max-w-md">
            <p className="text-[11px] text-slate-650 leading-relaxed text-left flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[#1b98c4] shrink-0 mt-0.5" />
              <span>
                Ce formulaire sécurisé vous permet de soumettre officiellement des fichiers réglementaires ou des justificatifs de vol sans être connecté. Ils seront assignés en attente de vérification.
              </span>
            </p>
          </div>
        </div>

        {/* State Alerts */}
        {status === 'success' && successInfo && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex flex-col items-start gap-2 text-left">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <h3 className="text-sm font-bold text-emerald-900">Document soumis avec succès !</h3>
            </div>
            <p className="text-xs text-emerald-700">
              Votre document a été correctement réceptionné et assigné avec le statut <span className="font-bold underline">En attente</span>. Les coordinateurs d'Aviation Sans Frontières vont l'analyser.
            </p>
            <div className="text-[10px] font-mono text-emerald-600 bg-emerald-100/40 px-2.5 py-1 rounded-md mt-1 w-full truncate">
              ID Document : {successInfo.docId}
            </div>
            <button 
              onClick={() => { setStatus('idle'); setSuccessInfo(null); }}
              className="mt-2 text-xs font-bold text-emerald-800 hover:underline cursor-pointer"
            >
              Soumettre un autre document
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-start gap-2.5 text-left">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-rose-900">Une erreur s'est produite</h3>
              <p className="text-xs text-rose-700 mt-1">{errorMessage}</p>
              <button 
                onClick={() => setStatus('idle')}
                className="mt-2 text-xs font-bold text-rose-800 hover:underline cursor-pointer"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}

        {/* Form */}
        {status !== 'success' && (
          <form onSubmit={handleSubmit} className="space-y-6 text-left">
            
            {/* Delegation Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold tracking-wide text-slate-700 uppercase" htmlFor="delegation-select">
                Délégation Principale
              </label>
              <select
                id="delegation-select"
                disabled={isLocked || status === 'loading'}
                value={selectedDelegation}
                onChange={(e) => setSelectedDelegation(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1b98c4]/20 focus:border-[#1b98c4] transition-all text-sm outline-hidden cursor-pointer"
                required
              >
                <option value="">-- Sélectionner une Délégation --</option>
                {delegations.map(del => (
                  <option key={del.id} value={del.id}>{del.name}</option>
                ))}
              </select>
              {isLocked && (
                <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                  🔒 Sélection verrouillée par lien de l'antenne.
                </p>
              )}
            </div>

            {/* Antenne / Local branch dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold tracking-wide text-slate-700 uppercase" htmlFor="antenne-select">
                Antenne Locale / Ville
              </label>
              <select
                id="antenne-select"
                disabled={isLocked || !selectedDelegation || status === 'loading'}
                value={selectedAntenne}
                onChange={(e) => setSelectedAntenne(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1b98c4]/20 focus:border-[#1b98c4] transition-all text-sm outline-hidden cursor-pointer"
                required
              >
                <option value="">
                  {!selectedDelegation 
                    ? "Veuillez d'abord sélectionner une Délégation" 
                    : "-- Choisir une Antenne --"}
                </option>
                {filteredAntennes.map(ant => (
                  <option key={ant.id} value={ant.id}>{ant.name}</option>
                ))}
              </select>
            </div>

            {/* File metadata input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold tracking-wide text-slate-700 uppercase" htmlFor="document-name">
                Nom descriptif du document
              </label>
              <input
                type="text"
                id="document-name"
                disabled={status === 'loading'}
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                placeholder="Ex : Attestation d'Assurance Vol, Certificat médical..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1b98c4]/20 focus:border-[#1b98c4] transition-all text-sm outline-hidden"
                required
              />
            </div>

            {/* File Picker input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold tracking-wide text-slate-700 uppercase">
                Fichier à téléverser
              </label>
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 hover:border-[#1b98c4]/50 transition-colors bg-slate-50 text-center relative group">
                <input
                  type="file"
                  onChange={handleFileChange}
                  disabled={status === 'loading'}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-[#1b98c4]/10 text-[#1b98c4] flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-xs">
                    {file ? (
                      <span className="font-bold text-[#1b98c4]">{file.name}</span>
                    ) : (
                      <span className="text-slate-650">Cliquez ou glissez-déposez votre fichier ici</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">PDF, JPG, PNG, DOCX jusqu'à 10 Mo</p>
                </div>
              </div>
            </div>

            {/* Loading progress / Submission indicator */}
            {status === 'loading' && (
              <div className="space-y-2 bg-slate-50 p-4 rounded-xl border">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin text-[#1b98c4]" /> Envoi du fichier sur Firebase Storage...</span>
                  <span className="text-slate-500">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#1b98c4] h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full px-5 py-3.5 bg-[#1b98c4] hover:bg-[#1682a8] disabled:bg-slate-350 text-white text-sm font-bold rounded-xl shadow-md shadow-[#1b98c4]/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {status === 'loading' ? (
                <>Téléversement en cours...</>
              ) : (
                <>Soumettre le document réglementaire <ChevronRight className="w-4 h-4" /></>
              )}
            </button>

          </form>
        )}
      </div>
    </div>
  );
}
