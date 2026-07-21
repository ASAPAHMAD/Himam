import React, { useState } from 'react';
import { ArrowLeft, Shield, FileText, Search, Download, HelpCircle, Check, Globe, Cookie, Sparkles } from 'lucide-react';
import { TERMS_AND_CONDITIONS, PRIVACY_POLICY, COOKIE_POLICY, AI_DISCLAIMER, LegalDocument } from '../data/legal';

interface LegalHubProps {
  initialTab?: 'terms' | 'privacy' | 'cookie' | 'ai';
  onBack: () => void;
  defaultLanguage?: 'en' | 'ar';
}

export default function LegalHub({ initialTab = 'terms', onBack, defaultLanguage = 'en' }: LegalHubProps) {
  const [activeDoc, setActiveDoc] = useState<'terms' | 'privacy' | 'cookie' | 'ai'>(initialTab);
  const [lang, setLang] = useState<'en' | 'ar'>(defaultLanguage);
  const [searchQuery, setSearchQuery] = useState('');

  const doc: LegalDocument = (() => {
    switch (activeDoc) {
      case 'terms': return TERMS_AND_CONDITIONS[lang];
      case 'privacy': return PRIVACY_POLICY[lang];
      case 'cookie': return COOKIE_POLICY[lang];
      case 'ai': return AI_DISCLAIMER[lang];
    }
  })();
  
  const isRtl = lang === 'ar';

  // Filter sections based on search query
  const filteredSections = doc.sections.filter(section => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      section.title.toLowerCase().includes(query) ||
      section.content.toLowerCase().includes(query)
    );
  });

  const handleDownload = () => {
    const textContent = `${doc.title}\n${doc.lastUpdated}\n\n` + 
      doc.sections.map(s => `${s.title}\n\n${s.content}\n`).join('\n---\n\n');
    
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeDoc}_policy_${lang}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getDocIcon = () => {
    switch (activeDoc) {
      case 'terms': return <FileText className="w-8 h-8 text-[#D4AF37]" />;
      case 'privacy': return <Shield className="w-8 h-8 text-[#D4AF37]" />;
      case 'cookie': return <Cookie className="w-8 h-8 text-[#D4AF37]" />;
      case 'ai': return <Sparkles className="w-8 h-8 text-[#D4AF37]" />;
    }
  };

  return (
    <main className="min-h-screen bg-transparent text-[#E0E0E6] p-5 sm:p-8" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation & Breadcrumb */}
        <div className="flex items-center justify-between">
          <button 
            onClick={onBack} 
            className="text-sm text-[#D4AF37] font-semibold inline-flex items-center gap-2 hover:opacity-80 transition-all cursor-pointer bg-transparent border-0"
          >
            <ArrowLeft className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
            <span>{isRtl ? 'العودة للمنظومة' : 'Back to Dashboard'}</span>
          </button>

          {/* Quick Language Toggle */}
          <div className="bg-[#171B24]/80 backdrop-blur border border-white/5 p-1 rounded-xl flex gap-1">
            <button
              onClick={() => setLang('en')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all border-0 cursor-pointer ${
                lang === 'en' 
                  ? 'bg-[#D4AF37] text-black shadow' 
                  : 'text-[#94949C] hover:text-white bg-transparent'
              }`}
            >
              🇺🇸 EN
            </button>
            <button
              onClick={() => setLang('ar')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all border-0 cursor-pointer ${
                lang === 'ar' 
                  ? 'bg-[#D4AF37] text-black shadow font-serif' 
                  : 'text-[#94949C] hover:text-white bg-transparent'
              }`}
            >
              🇸🇦 AR
            </button>
          </div>
        </div>

        {/* Hero Banner Header */}
        <header className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-[#171B24] via-[#11141C] to-[#0B0D12] p-6 sm:p-8 shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-[#D4AF37]/10 rounded-xl border border-[#D4AF37]/20 flex-shrink-0">
                {getDocIcon()}
              </div>
              <div className="space-y-1">
                <p className="text-[10px] tracking-[0.2em] uppercase font-bold text-[#D4AF37]">
                  {isRtl ? 'الوثائق القانونية الرسمية' : 'OFFICIAL LEGAL POLICIES'}
                </p>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {doc.title}
                </h1>
                <p className="text-xs text-[#94949C]">
                  {doc.lastUpdated}
                </p>
              </div>
            </div>
          </div>

          {/* Document Switcher Toolbar inside banner (Multi-Tab Carousel) */}
          <div className="mt-6 flex flex-wrap gap-2 border-t border-white/5 pt-4">
            <button
              onClick={() => { setActiveDoc('terms'); setSearchQuery(''); }}
              className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                activeDoc === 'terms'
                  ? 'bg-[#D4AF37]/10 border-[#D4AF37]/40 text-[#D4AF37]'
                  : 'bg-[#11141C] border-white/5 text-[#94949C] hover:text-white'
              }`}
            >
              {isRtl ? 'الشروط والأحكام' : 'Terms & Conditions'}
            </button>
            <button
              onClick={() => { setActiveDoc('privacy'); setSearchQuery(''); }}
              className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                activeDoc === 'privacy'
                  ? 'bg-[#D4AF37]/10 border-[#D4AF37]/40 text-[#D4AF37]'
                  : 'bg-[#11141C] border-white/5 text-[#94949C] hover:text-white'
              }`}
            >
              {isRtl ? 'سياسة الخصوصية' : 'Privacy Policy'}
            </button>
            <button
              onClick={() => { setActiveDoc('cookie'); setSearchQuery(''); }}
              className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                activeDoc === 'cookie'
                  ? 'bg-[#D4AF37]/10 border-[#D4AF37]/40 text-[#D4AF37]'
                  : 'bg-[#11141C] border-white/5 text-[#94949C] hover:text-white'
              }`}
            >
              {isRtl ? 'سياسة الكوكيز' : 'Cookie Policy'}
            </button>
            <button
              onClick={() => { setActiveDoc('ai'); setSearchQuery(''); }}
              className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                activeDoc === 'ai'
                  ? 'bg-[#D4AF37]/10 border-[#D4AF37]/40 text-[#D4AF37]'
                  : 'bg-[#11141C] border-white/5 text-[#94949C] hover:text-white'
              }`}
            >
              {isRtl ? 'إخلاء مسؤولية الذكاء الاصطناعي' : 'AI Disclaimer'}
            </button>
          </div>
        </header>


        {/* Search & Export Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className={`absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 w-4 h-4 text-[#55555B]`} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isRtl ? 'ابحث في نصوص الاتفاقية...' : 'Search within document articles...'}
              className={`w-full bg-[#171B24] border border-white/5 rounded-xl ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 text-xs text-[#E0E0E6] focus:border-[#D4AF37]/30 transition-all placeholder-[#55555B]`}
            />
          </div>
          
          <button
            onClick={handleDownload}
            className="px-4 py-3 bg-[#171B24] border border-white/5 hover:border-[#D4AF37]/20 text-[#D4AF37] text-xs font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 transition-all active:scale-98 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{isRtl ? 'تحميل بصيغة نصية TXT' : 'Download as Plain Text'}</span>
          </button>
        </div>

        {/* Main Document Content */}
        <div className="bg-[#171B24] border border-white/5 rounded-2xl p-6 space-y-6 shadow-xl relative min-h-[400px]">
          {filteredSections.length > 0 ? (
            <div className="space-y-8 divide-y divide-white/5">
              {filteredSections.map((section, idx) => (
                <article 
                  key={section.title} 
                  className={`pt-6 first:pt-0 space-y-3 ${
                    isRtl ? 'text-right' : 'text-left'
                  }`}
                >
                  <h3 className="font-serif text-lg font-bold text-white tracking-tight flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-gradient-to-b from-[#D4AF37] to-[#E6C35C]/30 rounded-full flex-shrink-0"></span>
                    {section.title}
                  </h3>
                  <div className="text-xs sm:text-sm text-[#94949C] leading-relaxed whitespace-pre-line font-normal tracking-wide">
                    {section.content}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <Search className="w-10 h-10 text-[#55555B]" />
              <p className="text-sm font-semibold text-white">
                {isRtl ? 'لم يتم العثور على نتائج مطابقة' : 'No matching clauses found'}
              </p>
              <p className="text-xs text-[#55555B]">
                {isRtl ? 'حاول استخدام كلمات مفتاحية أخرى في مربع البحث.' : 'Try refining your search keywords above.'}
              </p>
            </div>
          )}
        </div>

        {/* Regulatory Governance Note */}
        <footer className="bg-[#171B24]/40 border border-white/5 rounded-2xl p-5 flex items-start gap-4 select-none">
          <HelpCircle className="w-5 h-5 text-[#D4AF37] mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-white">
              {isRtl ? 'حوكمة التطبيق والتوافق النظامي' : 'Regulatory Standards & Governance'}
            </h4>
            <p className="text-[11px] text-[#94949C] leading-relaxed">
              {isRtl 
                ? 'تخضع هذه الشروط والسياسات مباشرة لأنظمة حماية البيانات الشخصية الصادرة عن الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا) بالمملكة العربية السعودية، وتتوافق بالكامل مع متطلبات النشر الدولية للمتاجر.'
                : 'These policies strictly conform with the Saudi Personal Data Protection Law (PDPL) governed by SDAIA, ensuring complete integrity, transparent processing, and absolute user control over academic trajectories.'}
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
