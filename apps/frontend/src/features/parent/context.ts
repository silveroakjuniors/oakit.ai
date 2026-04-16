import React from 'react';
import type { TranslationSettings } from './types';

// ─── Translation dictionary ───────────────────────────────────────────────────
export const translations: Record<string, Record<string, string>> = {
  hi: {
    'Home': 'होम', 'Attendance': 'उपस्थिति', 'Progress': 'प्रगति', 'Insights': 'अंतर्दृष्टि',
    'Oakie': 'ओकी', 'Messages': 'संदेश', 'Updates': 'अपडेट', 'Settings': 'सेटिंग्स',
    'Emergency Contacts': 'आपातकालीन संपर्क', 'Notification Preferences': 'सूचना प्राथमिकताएं',
    'Calendar Integration': 'कैलेंडर एकीकरण', 'Translation Settings': 'अनुवाद सेटिंग्स',
    'Progress Predictions': 'प्रगति भविष्यवाणी', 'Goal Setting': 'लक्ष्य निर्धारण',
    'Performance Comparison': 'प्रदर्शन तुलना', 'Next Week Attendance': 'अगले सप्ताह की उपस्थिति',
    'End of Month Progress': 'माह के अंत में प्रगति', 'Areas Needing Attention': 'ध्यान देने योग्य क्षेत्र',
    'Academic Goals': 'शैक्षणिक लक्ष्य', 'Behavioral Goals': 'व्यवहारिक लक्ष्य',
    'Attendance Goals': 'उपस्थिति लक्ष्य', 'Enable Translation': 'अनुवाद सक्षम करें',
    'Target Language': 'लक्ष्य भाषा', 'Auto Translation': 'स्वत: अनुवाद',
    'Notifications': 'सूचनाएं',
  },
  te: {
    'Home': 'హోమ్', 'Attendance': 'హాజరు', 'Progress': 'ప్రోగ్రెస్', 'Insights': 'ఇన్సైట్స్',
    'Oakie': 'ఓకీ', 'Messages': 'సందేశాలు', 'Updates': 'నవీకరణలు', 'Settings': 'సెట్టింగులు',
    'Emergency Contacts': 'అత్యవసర సంప్రదింపులు', 'Notification Preferences': 'నోటిఫికేషన్ ప్రాధాన్యతలు',
    'Calendar Integration': 'క్యాలెండర్ ఇంటిగ్రేషన్', 'Translation Settings': 'అనువాద సెట్టింగులు',
    'Progress Predictions': 'ప్రోగ్రెస్ అంచనాలు', 'Goal Setting': 'లక్ష్య సెట్టింగ్',
    'Performance Comparison': 'పనితీరు పోలిక', 'Next Week Attendance': 'తదుపరి వారం హాజరు',
    'End of Month Progress': 'నెల ముగింపు ప్రోగ్రెస్', 'Areas Needing Attention': 'దృష్టి అవసరమైన ప్రాంతాలు',
    'Academic Goals': 'విద్యా లక్ష్యాలు', 'Behavioral Goals': 'వ్యవహార లక్ష్యాలు',
    'Attendance Goals': 'హాజరు లక్ష్యాలు', 'Enable Translation': 'అనువాదాన్ని ప్రారంభించు',
    'Target Language': 'లక్ష్య భాష', 'Auto Translation': 'స్వయంచాలక అనువాదం',
    'Notifications': 'నోటిఫికేషన్లు',
  },
};

// ─── Context ──────────────────────────────────────────────────────────────────
export const TranslationContext = React.createContext<{
  t: (key: string, defaultText?: string) => string;
  settings: TranslationSettings;
}>({
  t: (key, defaultText) => defaultText || key,
  settings: { enabled: false, targetLanguage: 'en', autoTranslate: false, supportedLanguages: [] },
});

export function useTranslation() {
  return React.useContext(TranslationContext);
}

export function defaultChat(name?: string) {
  return [{ role: 'ai' as const, text: `Hi! I'm Oakie 🌳 Ask me anything about ${name ? name.split(' ')[0] : 'your child'} — what they studied today, attendance, or progress.`, ts: 0 }];
}
