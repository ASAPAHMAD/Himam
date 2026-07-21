import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  FileSpreadsheet, 
  Presentation, 
  FileCode, 
  Image as ImageIcon, 
  Trash2, 
  Sparkles, 
  MessageSquare, 
  Eye, 
  Plus, 
  Search, 
  Check, 
  AlertCircle, 
  BookOpen, 
  Tag, 
  Brain, 
  FileCheck,
  X,
  Loader2,
  ListOrdered
} from 'lucide-react';
import { apiFetch } from '../services/apiClient';

export interface KnowledgeDocument {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'word' | 'powerpoint' | 'excel' | 'image' | 'text';
  fileSize: string;
  uploadedAt: string;
  extractedText: string;
  wordCount: number;
  status: 'ready' | 'indexed' | 'analyzing';
  tags: string[];
  summary?: string;
  keyPoints?: string[];
}

interface KnowledgeLibraryProps {
  onSendToAICoach?: (prompt: string, context?: string) => void;
  setActiveTab?: (tab: string) => void;
}

const STORAGE_KEY = 'himam_knowledge_library';

export function KnowledgeLibrary({ onSendToAICoach, setActiveTab }: KnowledgeLibraryProps) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDocument | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  
  // Note Creation Modal State
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteTags, setNoteTags] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
    } catch (e) {
      console.error('Failed to save Knowledge Library to localStorage:', e);
    }
  }, [documents]);

  const detectFileType = (fileName: string, mimeType: string): KnowledgeDocument['fileType'] => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf' || mimeType.includes('pdf')) return 'pdf';
    if (['doc', 'docx'].includes(ext) || mimeType.includes('word')) return 'word';
    if (['ppt', 'pptx'].includes(ext) || mimeType.includes('presentation')) return 'powerpoint';
    if (['xls', 'xlsx', 'csv'].includes(ext) || mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'excel';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext) || mimeType.includes('image')) return 'image';
    return 'text';
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadError('');

    try {
      const newDocs: KnowledgeDocument[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileType = detectFileType(file.name, file.type);
        let extractedText = '';

        // Extract text based on file type
        if (fileType === 'text' || file.name.endsWith('.csv') || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.json')) {
          extractedText = await file.text();
        } else {
          // For binary files (PDF, Word, PPT, Images), create an indexed structural summary
          extractedText = `[Uploaded File: ${file.name}]\nFormat: ${fileType.toUpperCase()}\nSize: ${formatBytes(file.size)}\nUploaded for AI study assistant indexing.`;
        }

        const wordCount = extractedText.trim().split(/\s+/).filter(Boolean).length;

        const doc: KnowledgeDocument = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          fileName: file.name,
          fileType,
          fileSize: formatBytes(file.size),
          uploadedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          extractedText,
          wordCount,
          status: 'ready',
          tags: [fileType, 'custom-upload'],
          summary: `Indexed document containing ${wordCount > 0 ? `${wordCount} words` : 'structured study material'}. Ready for AI Coach analysis and quiz generation.`
        };

        newDocs.push(doc);
      }

      setDocuments(prev => [...newDocs, ...prev]);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to process document upload.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateNote = () => {
    if (!noteTitle.trim() || !noteContent.trim()) return;

    const wordCount = noteContent.trim().split(/\s+/).filter(Boolean).length;
    const docTags = noteTags.split(',').map(t => t.trim()).filter(Boolean);
    if (!docTags.includes('notes')) docTags.push('notes');

    const newNote: KnowledgeDocument = {
      id: `note-${Date.now()}`,
      fileName: noteTitle.trim() + '.md',
      fileType: 'text',
      fileSize: formatBytes(new Blob([noteContent]).size),
      uploadedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      extractedText: noteContent,
      wordCount,
      status: 'ready',
      tags: docTags,
      summary: noteContent.substring(0, 140) + (noteContent.length > 140 ? '...' : '')
    };

    setDocuments(prev => [newNote, ...prev]);
    setNoteTitle('');
    setNoteContent('');
    setNoteTags('');
    setShowNoteModal(false);
  };

  const handleDeleteDoc = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
    if (previewDoc?.id === id) setPreviewDoc(null);
  };

  const handleAskAICoach = (doc: KnowledgeDocument) => {
    const prompt = `I'm studying from my document "${doc.fileName}". Please provide a detailed overview and key concepts to focus on.`;
    const context = `[Document Context: ${doc.fileName}]\n${doc.extractedText.slice(0, 3000)}`;

    if (onSendToAICoach) {
      onSendToAICoach(prompt, context);
    } else if (setActiveTab) {
      setActiveTab('ai-coach');
    }
  };

  const handleGenerateSummary = async (doc: KnowledgeDocument) => {
    setIsGeneratingSummary(true);
    try {
      const response = await apiFetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Please analyze this study document "${doc.fileName}" and generate:
1. A concise 2-sentence summary.
2. 4 bullet points of essential key concepts to memorize.

Document text:
${doc.extractedText.slice(0, 4000)}`
            }
          ]
        })
      });

      if (!response.ok) throw new Error('AI analysis failed.');
      const data = await response.json();
      const aiResponse = data.response || '';

      // Update document with summary and key points
      setDocuments(prev => prev.map(d => {
        if (d.id === doc.id) {
          return {
            ...d,
            summary: aiResponse,
            status: 'indexed'
          };
        }
        return d;
      }));

      if (previewDoc?.id === doc.id) {
        setPreviewDoc(prev => prev ? { ...prev, summary: aiResponse, status: 'indexed' } : null);
      }
    } catch (e: any) {
      console.error('Summary generation error:', e);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const renderFileIcon = (fileType: KnowledgeDocument['fileType']) => {
    switch (fileType) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-400" />;
      case 'word':
        return <FileText className="w-5 h-5 text-blue-400" />;
      case 'powerpoint':
        return <Presentation className="w-5 h-5 text-orange-400" />;
      case 'excel':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
      case 'image':
        return <ImageIcon className="w-5 h-5 text-purple-400" />;
      default:
        return <FileCode className="w-5 h-5 text-amber-400" />;
    }
  };

  const allTags = Array.from(new Set(documents.flatMap(d => d.tags)));

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.extractedText.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag === 'all' || doc.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#171B24] via-[#1A202C] to-[#171B24] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] text-xs font-bold mb-2">
              <Brain className="w-3.5 h-3.5" /> Personal Knowledge Base
            </div>
            <h2 className="font-serif text-2xl font-bold text-white">Knowledge Library</h2>
            <p className="text-xs text-[#94949C] mt-1 max-w-xl">
              Upload your personal course materials, PDFs, slides, spreadsheets, images, or study notes. Your AI Coach can extract insights, generate summaries, and test your knowledge.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#B8932D] to-[#D4AF37] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg min-h-[44px] active:scale-95"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              Upload Documents
            </button>

            <button
              onClick={() => setShowNoteModal(true)}
              className="flex items-center justify-center gap-2 bg-[#171B24] hover:bg-white/5 border border-white/10 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] active:scale-95"
            >
              <Plus className="w-4 h-4 text-[#D4AF37]" />
              New Note
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={e => handleFileUpload(e.target.files)}
            />
          </div>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          handleFileUpload(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-white/10 hover:border-[#D4AF37]/40 bg-[#171B24]/20 hover:bg-[#171B24]/40 rounded-2xl p-6 text-center cursor-pointer transition-all group"
      >
        <div className="w-12 h-12 rounded-xl bg-[#171B24] border border-white/10 group-hover:border-[#D4AF37]/40 text-[#D4AF37] flex items-center justify-center mx-auto mb-3 transition-colors">
          <UploadCloud className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-white group-hover:text-[#D4AF37] transition-colors">
          Drag and drop files here, or click to browse
        </p>
        <p className="text-xs text-[#55555B] mt-1">
          Supports PDF, Word (.docx), PowerPoint (.pptx), Excel/CSV, Images, and Text notes
        </p>
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Search & Tag Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#55555B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search documents and notes..."
            className="w-full bg-[#171B24] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#55555B] focus:outline-none focus:border-[#D4AF37]/40 min-h-[44px]"
          />
        </div>

        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 no-scrollbar">
            <button
              onClick={() => setSelectedTag('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all min-h-[36px] ${
                selectedTag === 'all'
                  ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37]'
                  : 'bg-[#171B24] border border-white/5 text-[#94949C] hover:text-white'
              }`}
            >
              All Files ({documents.length})
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all min-h-[36px] capitalize ${
                  selectedTag === tag
                    ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37]'
                    : 'bg-[#171B24] border border-white/5 text-[#94949C] hover:text-white'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Document Grid */}
      {filteredDocuments.length === 0 ? (
        <div className="bg-[#171B24]/40 border border-white/5 rounded-2xl p-10 text-center">
          <BookOpen className="w-10 h-10 text-[#55555B] mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white">No documents found</h3>
          <p className="text-xs text-[#94949C] mt-1 max-w-sm mx-auto">
            {searchQuery || selectedTag !== 'all' 
              ? 'Try clearing your search filters or upload new study materials.'
              : 'Your Knowledge Library is empty. Upload your first document or create a study note to get started!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map(doc => (
            <div
              key={doc.id}
              className="bg-[#171B24] border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-[#D4AF37]/30 transition-all shadow-lg group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2.5 rounded-xl bg-[#0B0D12] border border-white/5 flex-shrink-0">
                      {renderFileIcon(doc.fileType)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-[#D4AF37] transition-colors" title={doc.fileName}>
                        {doc.fileName}
                      </h4>
                      <p className="text-[10px] text-[#55555B] flex items-center gap-2 mt-0.5">
                        <span>{doc.fileSize}</span>
                        <span>•</span>
                        <span>{doc.uploadedAt}</span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteDoc(doc.id)}
                    className="text-[#55555B] hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0 min-touch-target"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {doc.summary && (
                  <p className="text-[11px] text-[#94949C] leading-relaxed line-clamp-3 mb-3 bg-[#0B0D12]/50 p-2.5 rounded-xl border border-white/5">
                    {doc.summary}
                  </p>
                )}

                <div className="flex items-center gap-1.5 flex-wrap mb-4">
                  {doc.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[9px] font-semibold text-[#94949C] uppercase tracking-wider">
                      {tag}
                    </span>
                  ))}
                  {doc.wordCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[9px] font-semibold text-[#D4AF37]">
                      {doc.wordCount} words
                    </span>
                  )}
                </div>
              </div>

              {/* Document Actions */}
              <div className="pt-3 border-t border-white/5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPreviewDoc(doc)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-all min-h-[38px]"
                >
                  <Eye className="w-3.5 h-3.5 text-[#D4AF37]" /> View
                </button>

                <button
                  onClick={() => handleAskAICoach(doc)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-semibold transition-all min-h-[38px]"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> AI Coach
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document Detail Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#171B24] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#0B0D12]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-[#171B24] border border-white/10">
                  {renderFileIcon(previewDoc.fileType)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{previewDoc.fileName}</h3>
                  <p className="text-[10px] text-[#55555B]">{previewDoc.fileSize} • Added {previewDoc.uploadedAt}</p>
                </div>
              </div>

              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-lg text-[#94949C] hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" /> AI Summary & Concepts
                  </h4>

                  <button
                    onClick={() => handleGenerateSummary(previewDoc)}
                    disabled={isGeneratingSummary}
                    className="text-[11px] font-bold text-[#D4AF37] hover:underline flex items-center gap-1"
                  >
                    {isGeneratingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Refresh AI Analysis
                  </button>
                </div>

                <div className="bg-[#0B0D12] border border-white/5 rounded-xl p-3.5 text-xs text-[#E0E0E6] leading-relaxed whitespace-pre-wrap">
                  {previewDoc.summary || 'Click "Refresh AI Analysis" to generate an automatic summary and key concepts.'}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                  Extracted Document Content
                </h4>
                <div className="bg-[#0B0D12] border border-white/5 rounded-xl p-3.5 text-xs font-mono text-[#94949C] leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
                  {previewDoc.extractedText}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 bg-[#0B0D12] flex items-center justify-end gap-3">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94949C] hover:text-white"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleAskAICoach(previewDoc);
                  setPreviewDoc(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#B8932D] to-[#D4AF37] text-white text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Discuss with AI Coach
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Note Creation Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#171B24] border border-white/10 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#D4AF37]" /> Create Custom Study Note
              </h3>
              <button
                onClick={() => setShowNoteModal(false)}
                className="text-[#94949C] hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-white mb-1">Note Title</label>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={e => setNoteTitle(e.target.value)}
                  placeholder="e.g. Chapter 4 Data Modeling Notes"
                  className="w-full bg-[#0B0D12] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#55555B] focus:outline-none focus:border-[#D4AF37]/40 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={noteTags}
                  onChange={e => setNoteTags(e.target.value)}
                  placeholder="e.g. powerbi, formulas, review"
                  className="w-full bg-[#0B0D12] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#55555B] focus:outline-none focus:border-[#D4AF37]/40 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white mb-1">Note Content</label>
                <textarea
                  rows={6}
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  placeholder="Paste or type your study notes, formulas, or key concepts here..."
                  className="w-full bg-[#0B0D12] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-[#55555B] focus:outline-none focus:border-[#D4AF37]/40"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowNoteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#94949C] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNote}
                disabled={!noteTitle.trim() || !noteContent.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#B8932D] to-[#D4AF37] text-white text-xs font-bold disabled:opacity-40 transition-all active:scale-95 min-h-[44px]"
              >
                Save Note to Library
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
