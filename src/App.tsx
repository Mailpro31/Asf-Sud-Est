/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { FeedbackProvider } from './hooks/useFeedback';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import LandingPage from './components/LandingPage';

function MainApp() {
  const { user, organization, loading, error, signOut } = useAuth();
  const [view, setView] = useState<'landing' | 'login' | 'register'>('landing');

  if (error) {
    let friendlyMessage = "Une erreur est survenue lors de la synchronisation de votre profil. Veuillez vérifier votre connexion Internet ou contacter un administrateur.";
    let debugDetails = error;
    try {
      if (error.includes('Missing or insufficient permissions.')) {
        friendlyMessage = "Problème d'accès de sécurité : votre compte ne dispose pas des rôles requis ou de la validation nécessaire dans le système.";
      } else {
        const parsed = JSON.parse(error);
        if (parsed.error && parsed.error.includes("Missing or insufficient permissions.")) {
          friendlyMessage = "Accès refusé : vous n'êtes pas autorisé à récupérer le profil de cette organisation. Veuillez vérifier votre statut d'administrateur ou votre rôle.";
          debugDetails = `Chemin : ${parsed.path || 'N/A'}\nID Utilisateur : ${parsed.authInfo?.userId || 'N/A'}\nEmail : ${parsed.authInfo?.email || 'N/A'}`;
        }
      }
    } catch (e) {}

    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-800 font-sans p-6 overflow-y-auto">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-xs text-center">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold font-display text-deep mb-2">Erreur de Connexion</h2>
          <p className="text-sm text-slate-600 mb-6">{friendlyMessage}</p>
          
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-[11px] font-mono text-left text-slate-500 max-h-36 overflow-y-auto mb-6 whitespace-pre-wrap">
            {debugDetails}
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => window.location.reload()}
              className="btn-asf w-full cursor-pointer"
            >
              Réessayer la Connexion
            </button>
            <button
              onClick={() => signOut()}
              className="btn-secondary w-full cursor-pointer"
            >
              Se Déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-500 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-azur border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">Chargement du Portail Aviation Sans Frontières...</span>
        </div>
      </div>
    );
  }

  if (user) {
    if (!organization) {
      // Just fallback loading until organization is auto-created or fetched
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-500 font-sans">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-azur border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium">Synchronisation du profil...</span>
          </div>
        </div>
      );
    }
    if (organization.role === 'super_admin' || organization.role === 'admin' || organization.role === 'admin_delegation') {
      return <AdminPanel />;
    }
    return <Dashboard />;
  }

  if (view === 'landing') {
    return (
      <LandingPage
        onNavigateLogin={() => setView('login')}
        onNavigateRegister={() => setView('register')}
      />
    );
  }

  return view === 'login' ? (
    <Login 
      onNavigateRegister={() => setView('register')} 
      onNavigateHome={() => setView('landing')}
    />
  ) : (
    <Register 
      onNavigateLogin={() => setView('login')} 
      onNavigateHome={() => setView('landing')}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FeedbackProvider>
          <MainApp />
        </FeedbackProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}


