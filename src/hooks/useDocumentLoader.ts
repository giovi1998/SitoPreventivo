import React, { useEffect, useRef, useCallback, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppContext, AuthContext } from '../contexts';
import dataService from '../utils/dataService';
import { useToast } from './useToast';

const DOC_ID_REGEX = /^[a-zA-Z0-9_-]{1,100}$/;

export interface UseDocumentLoaderOptions {
  view: 'editor' | 'qr' | 'card' | 'logo' | 'flyer';
  documentType: 'quote' | 'qrCode' | 'businessCard' | 'logo' | 'flyer';
  contextField: 'editingQuote' | 'qrDocument' | 'cardDocument' | 'logoDocument' | 'flyerDocument';
}

export function useDocumentLoader({ view, documentType, contextField }: UseDocumentLoaderOptions) {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const ctx = useContext(AppContext) as any;
  const { addToast } = useToast();
  const lastLoadedRef = useRef<string | null>(null);

  const ctxDoc = ctx?.[contextField];
  const userEmail = user?.email || '';
  const [loading, setLoading] = React.useState(false);
  const [freshDoc, setFreshDoc] = React.useState<unknown>(null);
  const ctxRef = useRef(ctx);
  React.useEffect(() => { ctxRef.current = ctx; }, [ctx]);
  const addToastRef = useRef(addToast);
  React.useEffect(() => { addToastRef.current = addToast; }, [addToast]);
  const navigateRef = useRef(navigate);
  React.useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  const onReset = useCallback(() => {
    const setterName = `set${contextField.charAt(0).toUpperCase() + contextField.slice(1)}`;
    if (ctxRef.current?.[setterName]) {
      ctxRef.current[setterName](null);
    }
    navigateRef.current(`/app/${view}`, { replace: true });
    addToastRef.current('info', 'Documento svuotato');
  }, [contextField, view]);

  const onSaved = useCallback((doc: any) => {
    if (!doc?.id) return;
    if (docId === doc.id) return;
    navigateRef.current(`/app/${view}/${doc.id}`, { replace: true });
  }, [docId, view]);

  useEffect(() => {
    if (!docId) {
      lastLoadedRef.current = null;
      setFreshDoc(null);
      return;
    }
    if (!userEmail) return;
    // Ricarica sempre da dataService al mount / cambio docId: il ctxDoc può
    // essere una versione cache più vecchia (es. documento rigenerato dal CRM).
    if (lastLoadedRef.current === docId && freshDoc) return;
    if (!DOC_ID_REGEX.test(docId)) {
      addToastRef.current('error', 'ID documento non valido');
      navigateRef.current(`/app/${view}`, { replace: true });
      return;
    }
    lastLoadedRef.current = docId;
    const setterName = `set${contextField.charAt(0).toUpperCase() + contextField.slice(1)}`;
    setLoading(true);
    dataService.getDocument(userEmail, docId, documentType)
      .then((doc) => {
        setLoading(false);
        if (!doc) {
          addToastRef.current('error', 'Documento non trovato');
          navigateRef.current(`/app/${view}`, { replace: true });
          return;
        }
        setFreshDoc(doc);
        if (ctxRef.current?.[setterName]) {
          ctxRef.current[setterName](doc);
        }
      })
      .catch((err: Error) => {
        setLoading(false);
        addToastRef.current('error', `Errore caricamento: ${err.message}`);
        navigateRef.current(`/app/${view}`, { replace: true });
      });
  }, [docId, userEmail, view, documentType, contextField, freshDoc]);

  const initialDoc = docId
    ? ((freshDoc as { id?: string } | null)?.id === docId
        ? freshDoc
        : ctxDoc?.id === docId
          ? ctxDoc
          : null)
    : undefined;

  return { docId, initialDoc, loading, onReset, onSaved };
}
