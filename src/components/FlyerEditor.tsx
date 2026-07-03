import React from 'react';
import './QREditor.css';
import './FlyerEditor.css';
import './flyer/styles/shell.css';
import './flyer/styles/manual.css';
import './flyer/styles/ai.css';
import './flyer/styles/preview.css';
import FlyerEditorShell from './flyer/FlyerEditorShell';
import type { Flyer } from '../utils/documentSchemas';
import FlyerPreview from './flyer/FlyerPreview';

interface FlyerEditorProps {
  userEmail: string;
  initialFlyer?: Flyer;
  tier?: 'free' | 'unlocked';
}

export default function FlyerEditor({ userEmail, initialFlyer, tier = 'unlocked' }: FlyerEditorProps) {
  return <FlyerEditorShell userEmail={userEmail} initialFlyer={initialFlyer} tier={tier} />;
}

export { FlyerPreview };
