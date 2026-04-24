import React from 'react';
import type { TranslationSettings } from './types';

// ─── Translation dictionary ───────────────────────────────────────────────────
export const translations: Record<string, Record<string, string>> = {
  hi: {
    // Nav tabs
    'Home': 'होम', 'Attendance': 'उपस्थिति', 'Progress': 'प्रगति', 'Insights': 'अंतर्दृष्टि',
    'Oakie': 'ओकी', 'Messages': 'संदेश', 'Updates': 'अपडेट', 'Settings': 'सेटिंग्स',
    // Home tab
    'Homework': 'गृहकार्य', 'Today\'s Learning': 'आज की पढ़ाई', 'Need Help?': 'मदद चाहिए?',
    'Teacher': 'शिक्षक', 'Teacher Notes': 'शिक्षक के नोट्स', 'School Announcements': 'स्कूल की सूचनाएं',
    'No pending homework — great job!': 'कोई गृहकार्य नहीं — शाबाश!',
    'No topics recorded yet for today': 'आज के लिए कोई विषय दर्ज नहीं',
    'Tap photo to preview or change': 'फोटो देखने या बदलने के लिए टैप करें',
    'Not marked': 'दर्ज नहीं', 'Not yet marked': 'अभी दर्ज नहीं',
    '✓ Present': '✓ उपस्थित', '✗ Absent': '✗ अनुपस्थित', '⏰ Late': '⏰ देर से',
    'Arrived': 'पहुंचे', 'History →': 'इतिहास →',
    'View': 'देखें', 'Journey': 'यात्रा',
    'Daily highlights and special moments recorded by': 'द्वारा दर्ज किए गए दैनिक मुख्य क्षण',
    'teacher.': 'शिक्षक।',
    // Attendance tab
    'Last 60 Days': 'पिछले 60 दिन', 'Present': 'उपस्थित', 'Late': 'देर से', 'Absent': 'अनुपस्थित',
    'Punctuality': 'समय की पाबंदी', 'on time': 'समय पर',
    // Progress tab
    'syllabus covered': 'पाठ्यक्रम पूरा', 'Milestones': 'मील के पत्थर', 'milestones achieved': 'मील के पत्थर हासिल',
    'Homework History': 'गृहकार्य इतिहास', 'done': 'पूरा', 'missed': 'छूटा',
    'No homework records yet': 'अभी कोई गृहकार्य रिकॉर्ड नहीं',
    '✓ Done': '✓ पूरा', '½ Partial': '½ आंशिक', '✗ Not submitted': '✗ जमा नहीं',
    'No homework text recorded': 'कोई गृहकार्य पाठ दर्ज नहीं',
    'No curriculum assigned yet': 'अभी कोई पाठ्यक्रम नहीं',
    'No progress data yet': 'अभी कोई प्रगति डेटा नहीं',
    // Chat tab
    'Oakie AI': 'ओकी AI', 'Ask about': 'के बारे में पूछें',
    // Messages tab
    'No messages yet': 'अभी कोई संदेश नहीं',
    'Start a conversation with your child\'s teacher': 'अपने बच्चे के शिक्षक से बात शुरू करें',
    'Send First Message': 'पहला संदेश भेजें', 'New Message': 'नया संदेश',
    'Message a Teacher': 'शिक्षक को संदेश करें', 'Select Teacher & Child': 'शिक्षक और बच्चा चुनें',
    'Message': 'संदेश', 'Send': 'भेजें', 'Cancel': 'रद्द करें',
    // Notifications tab
    'Announcements': 'सूचनाएं', 'You\'re all caught up!': 'सब कुछ पढ़ लिया!',
    'Dismiss': 'हटाएं', 'topics covered': 'विषय पढ़े',
    // Settings
    'Emergency Contacts': 'आपातकालीन संपर्क', 'Notification Preferences': 'सूचना प्राथमिकताएं',
    'Calendar Integration': 'कैलेंडर एकीकरण', 'Translation Settings': 'अनुवाद सेटिंग्स',
    'Translation': 'अनुवाद', 'Calendar': 'कैलेंडर', 'Notifications': 'सूचनाएं',
    'Manage who the school should contact in an emergency.': 'आपातकाल में स्कूल किसे संपर्क करे यह तय करें।',
    'Add contact': 'संपर्क जोड़ें', 'Close': 'बंद करें', 'Edit': 'संपादित करें', 'Delete': 'हटाएं',
    'Priority': 'प्राथमिकता', 'Save': 'सहेजें', 'Adding…': 'जोड़ रहे हैं…', 'Saving…': 'सहेज रहे हैं…',
    'Frequency': 'आवृत्ति', 'Enabled': 'सक्षम', 'Disabled': 'अक्षम',
    'Coming Soon': 'जल्द आ रहा है', 'Premium Feature': 'प्रीमियम सुविधा',
    'Premium Feature — Payment coming soon': 'प्रीमियम सुविधा — भुगतान जल्द आ रहा है',
    // Insights
    'Progress Predictions': 'प्रगति भविष्यवाणी', 'Goal Setting': 'लक्ष्य निर्धारण',
    'Performance Comparison': 'प्रदर्शन तुलना', 'Next Week Attendance': 'अगले सप्ताह की उपस्थिति',
    'End of Month Progress': 'माह के अंत में प्रगति', 'Areas Needing Attention': 'ध्यान देने योग्य क्षेत्र',
    'Academic Goals': 'शैक्षणिक लक्ष्य', 'Behavioral Goals': 'व्यवहारिक लक्ष्य',
    'Attendance Goals': 'उपस्थिति लक्ष्य',
    'Predicted attendance rate': 'अनुमानित उपस्थिति दर', 'Expected academic progress': 'अपेक्षित शैक्षणिक प्रगति',
    'Target': 'लक्ष्य', 'Current': 'वर्तमान', 'Due': 'देय',
    'Rank': 'रैंक', 'academic Goals': 'शैक्षणिक लक्ष्य', 'behavioral Goals': 'व्यवहारिक लक्ष्य',
    'attendance Goals': 'उपस्थिति लक्ष्य',
    // Sign out
    'Sign out': 'साइन आउट', 'YOUR CHILDREN': 'आपके बच्चे',
    // Enable translation
    'Enable Translation': 'अनुवाद सक्षम करें', 'Target Language': 'लक्ष्य भाषा',
    'Auto Translation': 'स्वत: अनुवाद', 'Translate app content to your language': 'ऐप सामग्री को अपनी भाषा में अनुवाद करें',
    '🌐 Translate': '🌐 अनुवाद',
  },
  te: {
    // Nav tabs
    'Home': 'హోమ్', 'Attendance': 'హాజరు', 'Progress': 'ప్రోగ్రెస్', 'Insights': 'ఇన్సైట్స్',
    'Oakie': 'ఓకీ', 'Messages': 'సందేశాలు', 'Updates': 'నవీకరణలు', 'Settings': 'సెట్టింగులు',
    // Home tab
    'Homework': 'హోంవర్క్', 'Today\'s Learning': 'నేటి అభ్యాసం', 'Need Help?': 'సహాయం కావాలా?',
    'Teacher': 'ఉపాధ్యాయుడు', 'Teacher Notes': 'ఉపాధ్యాయుని నోట్స్', 'School Announcements': 'పాఠశాల ప్రకటనలు',
    'No pending homework — great job!': 'హోంవర్క్ లేదు — చాలా బాగు!',
    'Not marked': 'గుర్తించలేదు', 'Not yet marked': 'ఇంకా గుర్తించలేదు',
    '✓ Present': '✓ హాజరు', '✗ Absent': '✗ గైర్హాజరు', '⏰ Late': '⏰ ఆలస్యం',
    // Attendance
    'Last 60 Days': 'గత 60 రోజులు', 'Present': 'హాజరు', 'Late': 'ఆలస్యం', 'Absent': 'గైర్హాజరు',
    'Punctuality': 'సమయపాలన',
    // Progress
    'syllabus covered': 'పాఠ్యక్రమం పూర్తి', 'Milestones': 'మైలురాళ్ళు',
    'Homework History': 'హోంవర్క్ చరిత్ర', 'done': 'పూర్తి', 'missed': 'మిస్',
    '✓ Done': '✓ పూర్తి', '½ Partial': '½ పాక్షిక', '✗ Not submitted': '✗ సమర్పించలేదు',
    // Settings
    'Emergency Contacts': 'అత్యవసర సంప్రదింపులు', 'Notification Preferences': 'నోటిఫికేషన్ ప్రాధాన్యతలు',
    'Calendar Integration': 'క్యాలెండర్ ఇంటిగ్రేషన్', 'Translation Settings': 'అనువాద సెట్టింగులు',
    'Translation': 'అనువాదం', 'Calendar': 'క్యాలెండర్', 'Notifications': 'నోటిఫికేషన్లు',
    'Coming Soon': 'త్వరలో వస్తుంది', 'Premium Feature': 'ప్రీమియం ఫీచర్',
    // Insights
    'Progress Predictions': 'ప్రోగ్రెస్ అంచనాలు', 'Goal Setting': 'లక్ష్య సెట్టింగ్',
    'Performance Comparison': 'పనితీరు పోలిక', 'Next Week Attendance': 'తదుపరి వారం హాజరు',
    'End of Month Progress': 'నెల ముగింపు ప్రోగ్రెస్', 'Areas Needing Attention': 'దృష్టి అవసరమైన ప్రాంతాలు',
    'Academic Goals': 'విద్యా లక్ష్యాలు', 'Behavioral Goals': 'వ్యవహార లక్ష్యాలు',
    'Attendance Goals': 'హాజరు లక్ష్యాలు',
    'Predicted attendance rate': 'అంచనా హాజరు రేటు', 'Expected academic progress': 'అంచనా విద్యా ప్రోగ్రెస్',
    'Sign out': 'సైన్ అవుట్', 'YOUR CHILDREN': 'మీ పిల్లలు',
    'Enable Translation': 'అనువాదాన్ని ప్రారంభించు', 'Target Language': 'లక్ష్య భాష',
    '🌐 Translate': '🌐 అనువాదం',
  },

  // ── Kannada ──────────────────────────────────────────────────────────────────
  kn: {
    'Home': 'ಮನೆ', 'Attendance': 'ಹಾಜರಾತಿ', 'Progress': 'ಪ್ರಗತಿ', 'Insights': 'ಒಳನೋಟಗಳು',
    'Oakie': 'ಓಕಿ', 'Messages': 'ಸಂದೇಶಗಳು', 'Updates': 'ನವೀಕರಣಗಳು', 'Settings': 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
    'Homework': 'ಮನೆಕೆಲಸ', "Today's Learning": 'ಇಂದಿನ ಕಲಿಕೆ', 'Need Help?': 'ಸಹಾಯ ಬೇಕೇ?',
    'Teacher': 'ಶಿಕ್ಷಕರು', 'Teacher Notes': 'ಶಿಕ್ಷಕರ ಟಿಪ್ಪಣಿಗಳು', 'School Announcements': 'ಶಾಲಾ ಪ್ರಕಟಣೆಗಳು',
    'No pending homework — great job!': 'ಯಾವುದೇ ಮನೆಕೆಲಸ ಇಲ್ಲ — ಅದ್ಭುತ!',
    'Not marked': 'ಗುರುತಿಸಿಲ್ಲ', 'Not yet marked': 'ಇನ್ನೂ ಗುರುತಿಸಿಲ್ಲ',
    '✓ Present': '✓ ಹಾಜರು', '✗ Absent': '✗ ಗೈರುಹಾಜರು', '⏰ Late': '⏰ ತಡ',
    'Arrived': 'ಬಂದರು', 'History →': 'ಇತಿಹಾಸ →',
    // [dup removed]
    'Last 60 Days': 'ಕಳೆದ 60 ದಿನಗಳು', 'Present': 'ಹಾಜರು', 'Late': 'ತಡ', 'Absent': 'ಗೈರುಹಾಜರು',
    'syllabus covered': 'ಪಠ್ಯಕ್ರಮ ಪೂರ್ಣ', 'Milestones': 'ಮೈಲಿಗಲ್ಲುಗಳು',
    'Homework History': 'ಮನೆಕೆಲಸ ಇತಿಹಾಸ', 'done': 'ಮುಗಿದಿದೆ', 'missed': 'ತಪ್ಪಿಸಿಕೊಂಡಿದೆ',
    '✓ Done': '✓ ಮುಗಿದಿದೆ', '½ Partial': '½ ಭಾಗಶಃ', '✗ Not submitted': '✗ ಸಲ್ಲಿಸಿಲ್ಲ',
    'Emergency Contacts': 'ತುರ್ತು ಸಂಪರ್ಕಗಳು', 'Notification Preferences': 'ಅಧಿಸೂಚನೆ ಆದ್ಯತೆಗಳು',
    'Calendar Integration': 'ಕ್ಯಾಲೆಂಡರ್ ಏಕೀಕರಣ', 'Translation Settings': 'ಅನುವಾದ ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
    'Translation': 'ಅನುವಾದ', 'Calendar': 'ಕ್ಯಾಲೆಂಡರ್', 'Notifications': 'ಅಧಿಸೂಚನೆಗಳು',
    'Coming Soon': 'ಶೀಘ್ರದಲ್ಲಿ ಬರಲಿದೆ', 'Premium Feature': 'ಪ್ರೀಮಿಯಂ ವೈಶಿಷ್ಟ್ಯ',
    'Progress Predictions': 'ಪ್ರಗತಿ ಮುನ್ಸೂಚನೆಗಳು', 'Goal Setting': 'ಗುರಿ ನಿರ್ಧಾರ',
    'Performance Comparison': 'ಕಾರ್ಯಕ್ಷಮತೆ ಹೋಲಿಕೆ', 'Next Week Attendance': 'ಮುಂದಿನ ವಾರ ಹಾಜರಾತಿ',
    'End of Month Progress': 'ತಿಂಗಳ ಕೊನೆಯ ಪ್ರಗತಿ', 'Areas Needing Attention': 'ಗಮನ ಅಗತ್ಯವಿರುವ ಕ್ಷೇತ್ರಗಳು',
    'Academic Goals': 'ಶೈಕ್ಷಣಿಕ ಗುರಿಗಳು', 'Behavioral Goals': 'ನಡವಳಿಕೆ ಗುರಿಗಳು',
    'Attendance Goals': 'ಹಾಜರಾತಿ ಗುರಿಗಳು',
    'Predicted attendance rate': 'ಅಂದಾಜು ಹಾಜರಾತಿ ದರ', 'Expected academic progress': 'ನಿರೀಕ್ಷಿತ ಶೈಕ್ಷಣಿಕ ಪ್ರಗತಿ',
    'Sign out': 'ಸೈನ್ ಔಟ್', 'YOUR CHILDREN': 'ನಿಮ್ಮ ಮಕ್ಕಳು',
    'Enable Translation': 'ಅನುವಾದ ಸಕ್ರಿಯಗೊಳಿಸಿ', 'Target Language': 'ಗುರಿ ಭಾಷೆ',
    '🌐 Translate': '🌐 ಅನುವಾದ',
  },

  // ── Tamil ─────────────────────────────────────────────────────────────────────
  ta: {
    'Home': 'முகப்பு', 'Attendance': 'வருகை', 'Progress': 'முன்னேற்றம்', 'Insights': 'நுண்ணறிவு',
    'Oakie': 'ஓக்கி', 'Messages': 'செய்திகள்', 'Updates': 'புதுப்பிப்புகள்', 'Settings': 'அமைப்புகள்',
    'Homework': 'வீட்டுப்பாடம்', "Today's Learning": 'இன்றைய கற்றல்', 'Need Help?': 'உதவி வேண்டுமா?',
    'Teacher': 'ஆசிரியர்', 'Teacher Notes': 'ஆசிரியர் குறிப்புகள்', 'School Announcements': 'பள்ளி அறிவிப்புகள்',
    'No pending homework — great job!': 'வீட்டுப்பாடம் இல்லை — சிறப்பு!',
    'Not marked': 'குறிக்கப்படவில்லை', '✓ Present': '✓ வந்துள்ளார்', '✗ Absent': '✗ வரவில்லை',
    // [dup removed]
    'Last 60 Days': 'கடந்த 60 நாட்கள்', 'Present': 'வந்துள்ளார்', 'Late': 'தாமதம்', 'Absent': 'வரவில்லை',
    'Emergency Contacts': 'அவசர தொடர்புகள்', 'Notifications': 'அறிவிப்புகள்',
    'Translation': 'மொழிபெயர்ப்பு', 'Coming Soon': 'விரைவில் வருகிறது',
    'Progress Predictions': 'முன்னேற்ற கணிப்புகள்', 'Sign out': 'வெளியேறு',
    'YOUR CHILDREN': 'உங்கள் குழந்தைகள்', '🌐 Translate': '🌐 மொழிபெயர்',
  },

  // ── Malayalam ─────────────────────────────────────────────────────────────────
  ml: {
    'Home': 'ഹോം', 'Attendance': 'ഹാജർ', 'Progress': 'പുരോഗതി', 'Insights': 'ഉൾക്കാഴ്ചകൾ',
    'Oakie': 'ഓക്കി', 'Messages': 'സന്ദേശങ്ങൾ', 'Updates': 'അപ്‌ഡേറ്റുകൾ', 'Settings': 'ക്രമീകരണങ്ങൾ',
    'Homework': 'ഗൃഹപാഠം', "Today's Learning": 'ഇന്നത്തെ പഠനം', 'Need Help?': 'സഹായം വേണോ?',
    'Teacher': 'അദ്ധ്യാപകൻ', 'Teacher Notes': 'അദ്ധ്യാപക കുറിപ്പുകൾ',
    'Not marked': 'അടയാളപ്പെടുത്തിയിട്ടില്ല', '✓ Present': '✓ ഹാജർ', '✗ Absent': '✗ ഗൈർഹാജർ',
    // [dup removed]
    'Emergency Contacts': 'അടിയന്തര ബന്ധങ്ങൾ', 'Notifications': 'അറിയിപ്പുകൾ',
    'Translation': 'വിവർത്തനം', 'Coming Soon': 'ഉടൻ വരുന്നു',
    'Sign out': 'സൈൻ ഔട്ട്', 'YOUR CHILDREN': 'നിങ്ങളുടെ കുട്ടികൾ',
    '🌐 Translate': '🌐 വിവർത്തനം',
  },

  // ── Gujarati ──────────────────────────────────────────────────────────────────
  gu: {
    'Home': 'હોમ', 'Attendance': 'હાજરી', 'Progress': 'પ્રગતિ', 'Insights': 'આંતરદૃષ્ટિ',
    'Oakie': 'ઓકી', 'Messages': 'સંદેશા', 'Updates': 'અપડેટ', 'Settings': 'સેટિંગ્સ',
    'Homework': 'ગૃહકાર્ય', "Today's Learning": 'આજનું શિક્ષણ', 'Need Help?': 'મદદ જોઈએ?',
    'Not marked': 'ચિહ્નિત નથી', '✓ Present': '✓ હાજર', '✗ Absent': '✗ ગેરહાજર',
    // [dup removed]
    'Emergency Contacts': 'કટોકટી સંપર્કો', 'Notifications': 'સૂચનાઓ',
    'Translation': 'અનુવાદ', 'Coming Soon': 'ટૂંક સમયમાં',
    'Sign out': 'સાઇન આઉટ', 'YOUR CHILDREN': 'તમારા બાળકો',
    '🌐 Translate': '🌐 અનુવાદ',
  },

  // ── Marathi ───────────────────────────────────────────────────────────────────
  mr: {
    'Home': 'मुख्यपृष्ठ', 'Attendance': 'उपस्थिती', 'Progress': 'प्रगती', 'Insights': 'अंतर्दृष्टी',
    'Oakie': 'ओकी', 'Messages': 'संदेश', 'Updates': 'अपडेट', 'Settings': 'सेटिंग्ज',
    'Homework': 'गृहपाठ', "Today's Learning": 'आजचे शिक्षण', 'Need Help?': 'मदत हवी आहे?',
    'Not marked': 'चिन्हांकित नाही', '✓ Present': '✓ उपस्थित', '✗ Absent': '✗ अनुपस्थित',
    // [dup removed]
    'Emergency Contacts': 'आपत्कालीन संपर्क', 'Notifications': 'सूचना',
    'Translation': 'भाषांतर', 'Coming Soon': 'लवकरच येत आहे',
    'Sign out': 'साइन आउट', 'YOUR CHILDREN': 'तुमची मुले',
    '🌐 Translate': '🌐 भाषांतर',
  },

  // ── Bengali ───────────────────────────────────────────────────────────────────
  bn: {
    'Home': 'হোম', 'Attendance': 'উপস্থিতি', 'Progress': 'অগ্রগতি', 'Insights': 'অন্তর্দৃষ্টি',
    'Oakie': 'ওকি', 'Messages': 'বার্তা', 'Updates': 'আপডেট', 'Settings': 'সেটিংস',
    'Homework': 'বাড়ির কাজ', "Today's Learning": 'আজকের শিক্ষা', 'Need Help?': 'সাহায্য দরকার?',
    'Not marked': 'চিহ্নিত নয়', '✓ Present': '✓ উপস্থিত', '✗ Absent': '✗ অনুপস্থিত',
    // [dup removed]
    'Emergency Contacts': 'জরুরি যোগাযোগ', 'Notifications': 'বিজ্ঞপ্তি',
    'Translation': 'অনুবাদ', 'Coming Soon': 'শীঘ্রই আসছে',
    'Sign out': 'সাইন আউট', 'YOUR CHILDREN': 'আপনার সন্তানরা',
    '🌐 Translate': '🌐 অনুবাদ',
  },

  // ── Punjabi ───────────────────────────────────────────────────────────────────
  pa: {
    'Home': 'ਹੋਮ', 'Attendance': 'ਹਾਜ਼ਰੀ', 'Progress': 'ਤਰੱਕੀ', 'Insights': 'ਸੂਝ',
    'Oakie': 'ਓਕੀ', 'Messages': 'ਸੁਨੇਹੇ', 'Updates': 'ਅਪਡੇਟ', 'Settings': 'ਸੈਟਿੰਗਾਂ',
    'Homework': 'ਘਰ ਦਾ ਕੰਮ', "Today's Learning": 'ਅੱਜ ਦੀ ਪੜ੍ਹਾਈ', 'Need Help?': 'ਮਦਦ ਚਾਹੀਦੀ ਹੈ?',
    'Not marked': 'ਦਰਜ ਨਹੀਂ', '✓ Present': '✓ ਹਾਜ਼ਰ', '✗ Absent': '✗ ਗੈਰਹਾਜ਼ਰ',
    // [dup removed]
    'Emergency Contacts': 'ਐਮਰਜੈਂਸੀ ਸੰਪਰਕ', 'Notifications': 'ਸੂਚਨਾਵਾਂ',
    'Translation': 'ਅਨੁਵਾਦ', 'Coming Soon': 'ਜਲਦੀ ਆ ਰਿਹਾ ਹੈ',
    'Sign out': 'ਸਾਈਨ ਆਊਟ', 'YOUR CHILDREN': 'ਤੁਹਾਡੇ ਬੱਚੇ',
    '🌐 Translate': '🌐 ਅਨੁਵਾਦ',
  },

  // ── Urdu ──────────────────────────────────────────────────────────────────────
  ur: {
    'Home': 'ہوم', 'Attendance': 'حاضری', 'Progress': 'ترقی', 'Insights': 'بصیرت',
    'Oakie': 'اوکی', 'Messages': 'پیغامات', 'Updates': 'اپڈیٹس', 'Settings': 'ترتیبات',
    'Homework': 'گھر کا کام', "Today's Learning": 'آج کی تعلیم', 'Need Help?': 'مدد چاہیے؟',
    'Not marked': 'نشان زد نہیں', '✓ Present': '✓ حاضر', '✗ Absent': '✗ غیر حاضر',
    // [dup removed]
    'Notifications': 'اطلاعات', 'Translation': 'ترجمہ', 'Coming Soon': 'جلد آ رہا ہے',
    'Sign out': 'سائن آؤٹ', 'YOUR CHILDREN': 'آپ کے بچے',
    '🌐 Translate': '🌐 ترجمہ',
  },

  // ── Arabic ────────────────────────────────────────────────────────────────────
  ar: {
    'Home': 'الرئيسية', 'Attendance': 'الحضور', 'Progress': 'التقدم', 'Insights': 'رؤى',
    'Oakie': 'أوكي', 'Messages': 'الرسائل', 'Updates': 'التحديثات', 'Settings': 'الإعدادات',
    'Homework': 'الواجب المنزلي', "Today's Learning": 'تعلم اليوم', 'Need Help?': 'تحتاج مساعدة؟',
    'Not marked': 'غير مسجل', '✓ Present': '✓ حاضر', '✗ Absent': '✗ غائب',
    // [dup removed]
    'Notifications': 'الإشعارات', 'Translation': 'الترجمة', 'Coming Soon': 'قريباً',
    'Sign out': 'تسجيل الخروج', 'YOUR CHILDREN': 'أطفالك',
    '🌐 Translate': '🌐 ترجمة',
  },

  // ── French ────────────────────────────────────────────────────────────────────
  fr: {
    'Home': 'Accueil', 'Attendance': 'Présence', 'Progress': 'Progrès', 'Insights': 'Aperçus',
    'Oakie': 'Oakie', 'Messages': 'Messages', 'Updates': 'Mises à jour', 'Settings': 'Paramètres',
    'Homework': 'Devoirs', "Today's Learning": "Apprentissage d'aujourd'hui", 'Need Help?': 'Besoin d\'aide?',
    'Teacher': 'Enseignant', 'Teacher Notes': 'Notes de l\'enseignant', 'School Announcements': 'Annonces scolaires',
    'No pending homework — great job!': 'Aucun devoir en attente — bravo!',
    'Not marked': 'Non marqué', '✓ Present': '✓ Présent', '✗ Absent': '✗ Absent', '⏰ Late': '⏰ En retard',
    // [dup removed]
    'Present': 'Présent', 'Late': 'En retard', 'Absent': 'Absent',
    'Emergency Contacts': 'Contacts d\'urgence', 'Notifications': 'Notifications',
    'Translation': 'Traduction', 'Coming Soon': 'Bientôt disponible',
    'Sign out': 'Se déconnecter', 'YOUR CHILDREN': 'VOS ENFANTS',
    '🌐 Translate': '🌐 Traduire',
  },

  // ── Spanish ───────────────────────────────────────────────────────────────────
  es: {
    'Home': 'Inicio', 'Attendance': 'Asistencia', 'Progress': 'Progreso', 'Insights': 'Perspectivas',
    'Oakie': 'Oakie', 'Messages': 'Mensajes', 'Updates': 'Actualizaciones', 'Settings': 'Configuración',
    'Homework': 'Tarea', "Today's Learning": 'Aprendizaje de hoy', 'Need Help?': '¿Necesitas ayuda?',
    'Not marked': 'No marcado', '✓ Present': '✓ Presente', '✗ Absent': '✗ Ausente',
    // [dup removed]
    'Emergency Contacts': 'Contactos de emergencia', 'Notifications': 'Notificaciones',
    'Translation': 'Traducción', 'Coming Soon': 'Próximamente',
    'Sign out': 'Cerrar sesión', 'YOUR CHILDREN': 'TUS HIJOS',
    '🌐 Translate': '🌐 Traducir',
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
