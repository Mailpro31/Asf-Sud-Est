import React, { useEffect, useState, useRef } from 'react';
import { formatBytes } from '../lib/utils';
import { 
  X, 
  Download, 
  Trash2, 
  Calendar, 
  User, 
  HardDrive, 
  Info, 
  FileText, 
  Play,
  RotateCw,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Edit,
  Save
} from 'lucide-react';
import { collection, query, orderBy, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { DossierFile } from '../types';
import { StatusBadge } from './ui';
import { STATUS_META, STATUS_ORDER } from '../lib/status';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: DossierFile | null;
  onDelete?: (file: DossierFile) => void;
  orgName?: string;
  isAdmin?: boolean;
}

export default function FilePreviewModal({
  isOpen,
  onClose,
  file,
  onDelete,
  orgName = "Organisme",
  isAdmin = false
}: FilePreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string>('');
  const [isEditingText, setIsEditingText] = useState(false);
  const [savingText, setSavingText] = useState(false);

  // PDF Preview states
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [pdfZoom, setPdfZoom] = useState(1.0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any | null>(null);

  // DOCX Word Preview states
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);
  const docxContainerRef = useRef<HTMLDivElement | null>(null);

  // Premium Image Preview states
  const [imageZoom, setImageZoom] = useState(1.0);
  const [imageRotation, setImageRotation] = useState(0);

  // Real-time local status inside modal
  const [localStatus, setLocalStatus] = useState<string>('Pending');

  useEffect(() => {
    if (file) {
      setLocalStatus(file.submissionStatus || 'Pending');
    }
  }, [file]);

  const handleUpdateLocalStatus = async (newStatus: string) => {
    if (!file) return;
    setLocalStatus(newStatus);
    try {
      await updateDoc(doc(db, 'files', file.id), {
        submissionStatus: newStatus
      });
    } catch (err) {
      console.error("Error setting status inside preview:", err);
    }
  };

  // Sélecteur de statut unifié sur la source de vérité STATUS_META.
  const STATUS_OPTIONS = STATUS_ORDER.map((value) => ({
    value,
    label: STATUS_META[value].label,
    dot: STATUS_META[value].dot,
  }));

  const isPdf = file ? (file.type === 'application/pdf' || file.name.endsWith('.pdf')) : false;
  const isDocx = file ? (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') : false;
  const isDoc = file ? (file.name.endsWith('.doc') || file.type === 'application/msword') : false;

  // Helper inside to convert data URL to Uint8Array safely
  const dataURLtoUint8Array = (dataUrlString: string): Uint8Array | null => {
    try {
      const arr = dataUrlString.split(',');
      const base64 = arr[1] || arr[0];
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } catch (e) {
      console.error('Error parsing base64 string to Uint8Array', e);
      return null;
    }
  };

  // Helper dynamic script loader for pdf.js via unpkg/cdnjs
  const loadPdfJS = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pdfjsLib) {
        resolve((window as any).pdfjsLib);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
      script.onload = () => {
        const libs = (window as any).pdfjsLib;
        if (libs) {
          libs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
          resolve(libs);
        } else {
          reject(new Error('pdfjsLib is undefined'));
        }
      };
      script.onerror = (err) => reject(err);
      document.body.appendChild(script);
    });
  };

  // Parse bytes

  // Helper to convert base64 data URL to a native Blob URL
  const dataURLtoBlob = (dataUrlString: string) => {
    try {
      const arr = dataUrlString.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : '';
      const bstr = atob(arr[1] || arr[0]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch (e) {
      console.error('Error parsing data URL to blob', e);
      return null;
    }
  };

  // Modern unicode UTF-8 safe base64 decoding
  function decodeBase64Text(base64DataUrl: string) {
    try {
      const parts = base64DataUrl.split(',');
      const base64 = parts[1] || parts[0];
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    } catch (e) {
      console.error('Base64 decode error:', e);
      return '';
    }
  }

  // Modern unicode UTF-8 safe base64 encoding
  function encodeBase64Text(text: string) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `data:${file?.type || 'text/plain'};base64,` + btoa(binary);
  }

  useEffect(() => {
    if (!isOpen || !file) {
      setDataUrl(null);
      setTextContent('');
      setIsEditingText(false);
      setImageZoom(1.0);
      setImageRotation(0);
      return;
    }

    let currentObjectUrl: string | null = null;

    const loadFileData = async () => {
      setLoading(true);
      try {
        let rawDataUrl: string | null = null;
        if (file.storagePath === 'firestore_fallback' && file.fallbackDataUrl) {
          rawDataUrl = file.fallbackDataUrl;
          if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.json') || file.name.endsWith('.csv') || file.name.endsWith('.md')) {
            const text = decodeBase64Text(file.fallbackDataUrl);
            setTextContent(text);
          }
        } else if (file.storagePath === 'firestore_fallback_chunked') {
          // Stitch from chunks
          const chunksRef = collection(db, 'files', file.id, 'chunks');
          const q = query(chunksRef, orderBy('index', 'asc'));
          const querySnapshot = await getDocs(q);
          const chunksData: string[] = [];
          querySnapshot.forEach((docSnap) => {
            chunksData.push(docSnap.data().data);
          });
          const fullBase64 = chunksData.join('');
          rawDataUrl = fullBase64;
          if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.json') || file.name.endsWith('.csv') || file.name.endsWith('.md')) {
            const text = decodeBase64Text(fullBase64);
            setTextContent(text);
          }
        } else if (file.storagePath && file.storagePath !== 'firestore_fallback') {
          // Fichier stocké nativement dans Firebase Storage : on récupère une URL
          // de téléchargement consultable (image/PDF/vidéo/audio en aperçu direct).
          try {
            rawDataUrl = await getDownloadURL(ref(storage, file.storagePath));
            if (file.type.startsWith('text/') || /\.(txt|json|csv|md)$/i.test(file.name)) {
              try {
                const resp = await fetch(rawDataUrl);
                setTextContent(await resp.text());
              } catch { /* aperçu texte indisponible */ }
            }
          } catch (e) {
            console.warn('getDownloadURL a échoué, repli sur la donnée locale :', e);
            rawDataUrl = file.fallbackDataUrl || null;
          }
        } else {
          rawDataUrl = file.fallbackDataUrl || null;
        }

        if (rawDataUrl) {
          if (rawDataUrl.startsWith('data:')) {
            const blob = dataURLtoBlob(rawDataUrl);
            if (blob) {
              currentObjectUrl = URL.createObjectURL(blob);
              setDataUrl(currentObjectUrl);
            } else {
              setDataUrl(rawDataUrl);
            }
          } else {
            setDataUrl(rawDataUrl);
          }
        }
      } catch (err) {
        console.error('Error compiling file preview:', err);
      } finally {
        setLoading(false);
      }
    };

    loadFileData();

    return () => {
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [isOpen, file]);

  // Load PDF document when dataUrl is resolved
  useEffect(() => {
    if (!isOpen || !file || !isPdf || !dataUrl) {
      setPdfDoc(null);
      setPageNum(1);
      setNumPages(0);
      setPdfError(null);
      return;
    }

    let active = true;

    const loadPdfDoc = async () => {
      try {
        setPdfLoading(true);
        setPdfError(null);

        const response = await fetch(dataUrl);
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const pdfjs = await loadPdfJS();
        if (!active) return;

        const loadingTask = pdfjs.getDocument({ data: uint8Array });
        const docObj = await loadingTask.promise;
        
        if (active) {
          setPdfDoc(docObj);
          setNumPages(docObj.numPages);
          setPageNum(1);
        }
      } catch (err: any) {
        console.error('Error loading PDF document:', err);
        if (active) {
          setPdfError('Impossible de charger l\'aperçu du PDF. Veuillez le télécharger directement.');
        }
      } finally {
        if (active) {
          setPdfLoading(false);
        }
      }
    };

    loadPdfDoc();

    return () => {
      active = false;
    };
  }, [isOpen, file, isPdf, dataUrl]);

  // Load and render Word .docx when dataUrl is resolved
  useEffect(() => {
    if (!isOpen || !file || !isDocx || !dataUrl) {
      setDocxError(null);
      setDocxLoading(false);
      return;
    }

    let active = true;

    const renderWordDoc = async () => {
      try {
        setDocxLoading(true);
        setDocxError(null);

        // Fetch ArrayBuffer of the file
        const response = await fetch(dataUrl);
        const arrayBuffer = await response.arrayBuffer();

        if (!active) return;
        
        // Wait for docxContainerRef to be available in DOM (react cycle)
        setTimeout(async () => {
          if (!active || !docxContainerRef.current) return;
          try {
            docxContainerRef.current.innerHTML = '';
            const docx = await import('docx-preview');
            await docx.renderAsync(arrayBuffer, docxContainerRef.current, undefined, {
              className: "docx-preview-rendered",
              inWrapper: false,
              ignoreHeight: true,
              ignoreWidth: false
            });
          } catch (renderErr: any) {
            console.error('Error in docx-preview render:', renderErr);
            if (active) {
              setDocxError('Impossible de charger la prévisualisation de ce document Word.');
            }
          } finally {
            if (active) {
              setDocxLoading(false);
            }
          }
        }, 50);

      } catch (err: any) {
        console.error('Error loading Word document:', err);
        if (active) {
          setDocxError('Impossible d\'extraire les données du document Word.');
          setDocxLoading(false);
        }
      }
    };

    renderWordDoc();

    return () => {
      active = false;
    };
  }, [isOpen, file, isDocx, dataUrl]);

  // Render PDF Page onto Canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let active = true;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {
            // safe ignore
          }
        }

        const page = await pdfDoc.getPage(pageNum);
        if (!active || !canvasRef.current) return;

        const viewport = page.getViewport({ scale: pdfZoom });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.height = viewport.height * dpr;
        canvas.width = viewport.width * dpr;
        canvas.style.height = `${viewport.height}px`;
        canvas.style.width = `${viewport.width}px`;

        context.scale(dpr, dpr);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Error rendering PDF page:', err);
        }
      }
    };

    renderPage();

    return () => {
      active = false;
    };
  }, [pdfDoc, pageNum, pdfZoom]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = file?.name || 'document';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveTextChanges = async () => {
    if (!file) return;
    setSavingText(true);
    try {
      const newBase64 = encodeBase64Text(textContent);
      const newSize = new TextEncoder().encode(textContent).length;

      if (file.storagePath === 'firestore_fallback_chunked') {
        const chunksRef = collection(db, 'files', file.id, 'chunks');
        const oldChunksSnap = await getDocs(chunksRef);
        const deletePromises = oldChunksSnap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);

        const chunkSize = 500 * 1024;
        const uploadPromises = [];
        let chunkIndex = 0;
        for (let offset = 0; offset < newBase64.length; offset += chunkSize) {
          const chunkData = newBase64.substring(offset, offset + chunkSize);
          uploadPromises.push(
            updateDoc(doc(db, 'files', file.id), { updatedAt: Date.now() })
          );
        }
        await updateDoc(doc(db, 'files', file.id), {
          fallbackDataUrl: null,
          size: newSize,
          uploadDate: Date.now()
        });
        
        if (newBase64.length < 1000 * 1024) {
          await updateDoc(doc(db, 'files', file.id), {
            fallbackDataUrl: newBase64,
            storagePath: 'firestore_fallback',
            size: newSize,
            uploadDate: Date.now()
          });
        }
      } else {
        await updateDoc(doc(db, 'files', file.id), {
          fallbackDataUrl: newBase64,
          size: newSize,
          uploadDate: Date.now()
        });
      }
      setIsEditingText(false);
    } catch (e) {
      console.error('Error saving edited file:', e);
      alert("Échec de l'enregistrement des modifications.");
    } finally {
      setSavingText(false);
    }
  };

  if (!isOpen || !file) return null;

  const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
  const isText = file.type.startsWith('text/') || /\.(txt|json|csv|md)$/i.test(file.name);
  const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(file.name);
  const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|ogv)$/i.test(file.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 bg-slate-900/70 dark:bg-slate-950/80 backdrop-blur-md transition-opacity">
      <div 
        className="relative w-full max-w-[95vw] h-[92vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header bar */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0">
          <div className="flex items-center gap-3 min-w-0 text-left">
            <div className="p-2.5 bg-azur-light dark:bg-azur/10 text-azur dark:text-azur-pastel rounded-xl">
              <FileText className="w-5.5 h-5.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black font-display text-deep dark:text-slate-100 truncate pr-5" title={file.name}>
                {file.name}
              </h3>
              <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                Type : {file.type.split('/').pop()?.toUpperCase()}
              </p>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-transparent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace body */}
        <div className="flex-grow flex-1 overflow-hidden flex flex-col lg:flex-row p-6 gap-6 bg-slate-100/30 dark:bg-slate-950/20">
          
          {/* Main Preview Screen (Left) */}
          <div className="flex-1 h-full flex flex-col justify-center items-center bg-slate-950 rounded-2xl border border-slate-900 p-4 overflow-hidden relative shadow-inner">
            
            {loading ? (
              <div className="flex flex-col items-center gap-3 text-slate-300">
                <RotateCw className="w-8 h-8 text-azur animate-spin" />
                <span className="text-xs font-bold">Chargement de l'aperçu en cours...</span>
              </div>
            ) : !dataUrl ? (
              <div className="text-center p-6 flex flex-col items-center gap-2 text-slate-400">
                <Info className="w-10 h-10 text-slate-500" />
                <p className="text-xs font-semibold">Aucun aperçu direct n'est disponible pour ce fichier.</p>
                <p className="text-[11px] text-slate-500">Veuillez télécharger le document original pour consulter son contenu.</p>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col justify-between overflow-hidden">
                {/* Image Previews */}
                {isImage && (
                  <div className="w-full h-full flex flex-col justify-between overflow-hidden">
                    {/* Controls Bar for Images */}
                    <div className="flex items-center justify-between w-full bg-slate-900 border border-slate-800 p-2 rounded-xl mb-3 gap-2 select-none shrink-0 text-white">
                      
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setImageZoom(1.0);
                            setImageRotation(0);
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                        >
                          Réinitialiser
                        </button>
                        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline uppercase">
                          Rotation : {imageRotation}° • Zoom: {Math.round(imageZoom * 100)}%
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setImageRotation(r => (r + 90) % 360)}
                        className="px-3 py-1.5 bg-slate-800 text-azur-pastel border border-slate-700 hover:bg-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                        title="Faire pivoter de 90°"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Pivoter</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setImageZoom(z => Math.max(0.4, z - 0.2))}
                          disabled={imageZoom <= 0.5}
                          className="p-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-700 disabled:opacity-40 cursor-pointer text-xs"
                          title="Zoom arrière"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[11px] font-semibold text-slate-300 font-mono select-none w-10 text-center">
                          {Math.round(imageZoom * 105)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setImageZoom(z => Math.min(5.0, z + 0.2))}
                          disabled={imageZoom >= 4.8}
                          className="p-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-700 disabled:opacity-40 cursor-pointer text-xs"
                          title="Zoom avant"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex-grow w-full overflow-auto flex items-center justify-center bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-inner relative select-none">
                      <div 
                        className="transition-transform duration-100 ease-out flex items-center justify-center select-none" 
                        style={{ transform: `scale(${imageZoom}) rotate(${imageRotation}deg)` }}
                      >
                        <img 
                          src={dataUrl} 
                          alt={file.name} 
                          className="max-w-[95%] max-h-[64vh] object-contain rounded-lg shadow-2xl border border-slate-800 bg-black"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* PDF Previews */}
                {isPdf && (
                  <div className="w-full h-full flex flex-col justify-between overflow-hidden">
                    {/* Controls Bar */}
                    <div className="flex items-center justify-between w-full bg-slate-900 border border-slate-800 p-2 rounded-xl mb-3 gap-2 select-none shrink-0 text-white">
                      
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPageNum(p => Math.max(1, p - 1))}
                          disabled={pageNum <= 1 || pdfLoading}
                          className="p-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-700 disabled:opacity-40 cursor-pointer text-xs"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-bold text-slate-300 select-none min-w-[70px] text-center font-mono">
                          {pageNum} / {numPages || '?'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPageNum(p => Math.min(numPages, p + 1))}
                          disabled={pageNum >= numPages || pdfLoading}
                          className="p-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-700 disabled:opacity-40 cursor-pointer text-xs"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPdfZoom(z => Math.max(0.5, z - 0.2))}
                          disabled={pdfLoading || pdfZoom <= 0.6}
                          className="p-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-700 disabled:opacity-40 cursor-pointer text-xs"
                          title="Zoom arrière"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[11px] font-semibold text-slate-300 font-mono select-none w-10 text-center">
                          {Math.round(pdfZoom * 100)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setPdfZoom(z => Math.min(4.0, z + 0.2))}
                          disabled={pdfLoading || pdfZoom >= 3.8}
                          className="p-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-700 disabled:opacity-40 cursor-pointer text-xs"
                          title="Zoom avant"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex-grow w-full overflow-auto flex justify-center bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-inner relative">
                      {pdfLoading && (
                        <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-950/70 z-10 gap-2 text-white">
                          <RotateCw className="w-6 h-6 text-azur-pastel animate-spin" />
                          <span className="text-[11px] font-bold">Rendu PDF en cours...</span>
                        </div>
                      )}
                      
                      {pdfError ? (
                        <div className="flex flex-col items-center justify-center text-center p-6 gap-2 text-slate-400">
                          <Info className="w-7 h-7 text-rose-500" />
                          <p className="text-xs font-bold text-white">{pdfError}</p>
                          <p className="text-[10px] text-slate-500">Ce fichier PDF ne peut pas être rendu directement.</p>
                        </div>
                      ) : (
                        <div className="shadow-2xl border border-slate-950 rounded bg-white shrink-0 self-start">
                          <canvas ref={canvasRef} className="max-w-full" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Audio Previews */}
                {isAudio && (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-slate-300 bg-slate-900 border border-slate-800 rounded-xl p-8">
                    <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center animate-pulse">
                      <Play className="w-6 h-6 fill-current ml-0.5" />
                    </div>
                    <span className="text-xs font-bold">Aperçu du fichier audio</span>
                    <audio src={dataUrl} controls className="w-full max-w-sm" />
                  </div>
                )}

                {/* Video Previews */}
                {isVideo && (
                  <div className="w-full h-full flex items-center justify-center bg-black rounded-lg overflow-hidden border border-slate-800">
                    <video 
                      src={dataUrl} 
                      controls 
                      className="max-w-full max-h-[64vh] rounded-lg shadow-md bg-black"
                    />
                  </div>
                )}

                {/* Text Previews */}
                {isText && (
                  <div className="w-full h-full flex flex-col text-[#cfd4da]">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-3 text-xs shrink-0 text-white">
                      <span className="text-slate-400 font-mono">Éditeur en ligne (UTF-8)</span>
                      {!isEditingText && (
                        <button 
                          onClick={() => setIsEditingText(true)}
                          className="flex items-center gap-1 text-azur-pastel hover:text-azur bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-lg font-bold border border-slate-700 cursor-pointer"
                        >
                          <Edit className="w-3 h-3" /> Éditer le texte
                        </button>
                      )}
                    </div>

                    {isEditingText ? (
                      <div className="flex-grow flex flex-col gap-2 overflow-hidden h-[50vh]">
                        <textarea
                          value={textContent}
                          onChange={(e) => setTextContent(e.target.value)}
                          className="flex-1 border border-slate-800 p-4 rounded-xl text-sm font-mono focus:ring-1 focus:ring-azur focus:outline-none bg-slate-950 text-slate-100"
                        />
                        <div className="flex justify-end gap-2 shrink-0">
                          <button 
                            type="button"
                            onClick={() => { setIsEditingText(false); }}
                            className="bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer hover:bg-slate-700"
                          >
                            Annuler
                          </button>
                          <button 
                            type="button"
                            disabled={savingText}
                            onClick={handleSaveTextChanges}
                            className="bg-azur hover:bg-azur-hover text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {savingText ? 'Mise à jour...' : 'Sauvegarder'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-grow overflow-auto">
                        <pre className="whitespace-pre-wrap font-mono text-xs text-emerald-400 bg-slate-950 p-4 rounded-xl border border-slate-800 h-full max-h-[64vh] overflow-y-auto text-left shadow-inner">
                          {textContent || "(Vide)"}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* DOCX Word Previews */}
                {isDocx && (
                  <div className="w-full h-full flex flex-col justify-between overflow-hidden">
                    {/* Controls Bar for Word Documents */}
                    <div className="flex items-center justify-between w-full bg-slate-900 border border-slate-800 p-2 rounded-xl mb-3 gap-2 select-none shrink-0 text-white">
                      <div className="flex items-center gap-1.5 p-1">
                        <span className="text-xs font-bold text-slate-300">
                          Aperçu Word (.docx) • Clavier & mise en page native
                        </span>
                      </div>
                      {docxLoading && (
                        <div className="flex items-center gap-2 text-azur-pastel">
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-[10px] uppercase font-bold">Rendu en cours...</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-grow w-full overflow-auto flex justify-center bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-inner relative">
                      {docxLoading && (
                        <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-950/70 z-10 gap-2 text-white">
                          <RotateCw className="w-6 h-6 text-azur-pastel animate-spin" />
                          <span className="text-[11px] font-bold">Rendu du document...</span>
                        </div>
                      )}
                      
                      {docxError ? (
                        <div className="flex flex-col items-center justify-center text-center p-6 gap-2 text-slate-400">
                          <Info className="w-7 h-7 text-rose-500" />
                          <p className="text-xs font-bold text-white">{docxError}</p>
                          <p className="text-[10px] text-slate-500">Veuillez télécharger le document pour le lire hors ligne.</p>
                        </div>
                      ) : (
                        <div className="shadow-2xl border border-slate-950 rounded bg-white shrink-0 self-start w-full max-w-[800px] overflow-x-auto text-left p-4 sm:p-8 md:p-12 text-black">
                          <div ref={docxContainerRef} className="docx-rendered-element" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Legacy DOC Word Previews */}
                {isDoc && (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-slate-300 bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-2xl mx-auto my-auto text-center">
                    <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center">
                      <FileText className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white mb-1">Aperçu indisponible pour le format .doc</h3>
                      <p className="text-xs text-slate-400 max-w-sm">
                        La prévisualisation en ligne directe n'est supportée que pour le format Word moderne <strong>.docx</strong>.
                      </p>
                      <p className="text-[11px] text-slate-500 mt-2 max-w-sm leading-relaxed">
                        Pour un aperçu interactif, veuillez convertir votre fichier au format .docx puis l'importer de nouveau, ou le télécharger directement pour le lire localement.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="px-4 py-2 bg-azur hover:bg-azur-hover text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm mt-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Télécharger le document .doc</span>
                    </button>
                  </div>
                )}

                {/* General Fallback for unrecognized formats */}
                {!isImage && !isPdf && !isAudio && !isVideo && !isText && !isDocx && !isDoc && (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-slate-300 bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-sm mx-auto my-auto text-center shadow-lg">
                    <div className="w-12 h-12 bg-slate-800 text-slate-400 rounded-full flex items-center justify-center">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white mb-1">Aperçu direct non disponible</h3>
                      <p className="text-xs text-slate-400">
                        Ce type de fichier ({file.type || 'Fichier'}) n'est pas pris en charge par le visualiseur web.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="px-4 py-2 bg-azur hover:bg-azur-hover text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm mt-1"
                    >
                      <Download className="w-4.5 h-4.5" />
                      <span>Télécharger le fichier</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar Metrics Sheet (Right 30%) */}
          <div className="w-full lg:w-80 shrink-0 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 pt-6 lg:pt-0 lg:pl-6 basis-80 overflow-y-auto">
            <div className="flex flex-col gap-5 text-left">
              
              {/* ADMIN ACTION PANEL - VALIDER LE DOSSIER */}
              {isAdmin && (
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="text-left">
                    <span className="text-[10px] font-black uppercase tracking-wider text-azur dark:text-azur-pastel">👩‍✈️ Décision Conforme / Vol</span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-0.5">Changez le statut réglementaire :</span>
                  </div>

                  <div className="space-y-1.5">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleUpdateLocalStatus(opt.value)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-between cursor-pointer ${
                          localStatus === opt.value
                            ? 'bg-white dark:bg-slate-900 border-azur dark:border-azur shadow-sm ring-2 ring-azur/15'
                            : 'bg-transparent border-transparent text-slate-600 hover:bg-white/40 dark:hover:bg-slate-900/50 dark:text-slate-400'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${opt.dot} ${localStatus === opt.value ? 'animate-pulse' : ''}`} />
                          <span className={localStatus === opt.value ? 'font-black' : ''}>{opt.label}</span>
                        </span>
                        {localStatus === opt.value && <span className="text-[10px] font-bold text-azur dark:text-azur-pastel">✓ Actif</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <span className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-400 uppercase flex items-center gap-1.5 mb-2 text-left">
                  <Info className="w-3.5 h-3.5 text-azur" /> Informations du Vol
                </span>

                {/* Status Card */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-left">
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Statut</p>
                  <StatusBadge status={localStatus as any} />
                </div>

                {/* Size Card */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3 text-left">
                  <HardDrive className="w-4 h-4 text-azur shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Taille</p>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100 dark:text-slate-100">{formatBytes(file.size)}</p>
                  </div>
                </div>

                {/* Uploader Card */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3 text-left">
                  <User className="w-4 h-4 text-azur shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] text-slate-400 font-bold uppercase font-sans">Auteur de l'envoi</p>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100 dark:text-slate-100 truncate pr-2">
                      {file.uploadedBy === 'admin' ? "Administrateur" : orgName}
                    </p>
                  </div>
                </div>

                {/* Upload Date Card */}
                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3 text-left">
                  <Calendar className="w-4 h-4 text-azur shrink-0" />
                  <div className="min-w-0 text-left">
                    <p className="text-[9px] text-slate-400 dark:text-slate-400 font-bold uppercase">Importé le</p>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100 dark:text-slate-100">
                      {new Date(file.uploadDate).toLocaleDateString()}
                    </p>
                    <span className="text-[9px] text-slate-400 font-mono font-bold block mt-0.5">
                      {new Date(file.uploadDate).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-col gap-2 shrink-0">
              <button
                onClick={handleDownload}
                disabled={!dataUrl}
                className="btn-asf w-full shrink-0"
              >
                <Download className="w-4.5 h-4.5" />
                Télécharger original
              </button>

              {onDelete && (
                <button
                  onClick={() => onDelete(file)}
                  className="btn-danger w-full shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </button>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
