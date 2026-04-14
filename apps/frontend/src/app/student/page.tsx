/**
 * Student Portal Entry Point
 * Re-exports the refactored StudentPage component from features
 */

export { default } from '@/features/student';
    setLoading(true);
    try {
      const me = await apiGet<{ name: string; section_label: string; class_name: string }>('/api/v1/student/me', token!);
      setStudentName(me.name);
      setSectionLabel(me.section_label);
      setClassName(me.class_name);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Invalid') || msg.includes('expired') || msg.includes('Missing')) {
        clearStudentToken(); router.push('/student/login'); return;
      }
      if (msg.includes('disabled')) {
        clearStudentToken(); router.push('/student/login'); return;
      }
    } finally { setLoading(false); }
    loadFeed(today());
    loadAssignedTests();
  }

  async function loadFeed(date: string) {
    setFeedLoading(true);
    try {
      const data = await apiGet<FeedDay>(`/api/v1/student/feed?date=${date}`, token!);
      setFeed(data);
    } catch { setFeed(null); }
    finally { setFeedLoading(false); }
  }

  async function loadHomework() {
    if (hwHistory.length > 0) return;
    setHwLoading(true);
    try {
      const data = await apiGet<HomeworkRecord[]>('/api/v1/student/homework/history', token!);
      setHwHistory(data);
    } catch { setHwHistory([]); }
    finally { setHwLoading(false); }
  }

  async function loadAssignedTests() {
    try {
      const data = await apiGet<AssignedTest[]>('/api/v1/student/quiz/assigned', token!);
      setAssignedTests(data);
    } catch { /* ignore */ }
  }

  async function loadProgress() {
    if (progress) return;
    setProgressLoading(true);
    try {
      const data = await apiGet<ProgressStats>('/api/v1/student/quiz/results', token!);
      setProgress(data);
    } catch { setProgress(null); }
    finally { setProgressLoading(false); }
  }

  function changeDate(delta: number) {
    const maxFuture = addDays(today(), 5);
    const next = addDays(feedDate, delta);
    if (next > maxFuture) return;
    setFeedDate(next);
    loadFeed(next);
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatLoading || text.length > 400) return;
    setChatInput('');
    setChatMsgs(prev => [...prev, { role: 'user', text, ts: Date.now() }]);
    setChatLoading(true);
    try {
      const resp = await apiPost<{ response: string }>('/api/v1/ai/student-query', { text }, token!);
      setChatMsgs(prev => [...prev, { role: 'ai', text: resp.response, ts: Date.now() }]);
    } catch {
      setChatMsgs(prev => [...prev, { role: 'ai', text: 'Oakie is unavailable right now. Please try again shortly.', ts: Date.now() }]);
    } finally { setChatLoading(false); }
  }

  async function loadQuizTopics() {
    if (!quizSubject || !quizFrom || !quizTo) return;
    setQuizLoading(true); setQuizError('');
    try {
      const data = await apiGet<QuizTopic[]>(`/api/v1/student/quiz/topics?subject=${encodeURIComponent(quizSubject)}&from=${quizFrom}&to=${quizTo}`, token!);
      setQuizTopics(data);
      setSelectedTopics(data.map(t => t.chunk_id));
      setQuizStep('topics');
    } catch (err: unknown) { setQuizError(err instanceof Error ? err.message : 'Failed to load topics'); }
    finally { setQuizLoading(false); }
  }

  async function generateQuiz() {
    if (selectedTopics.length === 0 || selectedQTypes.length === 0) return;
    setQuizLoading(true); setQuizError('');
    try {
      const res = await apiPost<{ quiz_id: string; questions: QuizQuestion[] }>('/api/v1/student/quiz/generate', {
        chunk_ids: selectedTopics,
        q_types: selectedQTypes,
      }, token!);
      setQuizId(res.quiz_id);
      setQuizQuestions(res.questions);
      setQuizAnswers({});
      setQuizStep('taking');
    } catch (err: unknown) { setQuizError(err instanceof Error ? err.message : 'Failed to generate quiz'); }
    finally { setQuizLoading(false); }
  }

  async function startAssignedTest(test: AssignedTest) {
    setQuizLoading(true); setQuizError('');
    try {
      const res = await apiPost<{ quiz_id: string; questions: QuizQuestion[] }>(`/api/v1/student/quiz/${test.quiz_id}/start`, {}, token!);
      setQuizId(res.quiz_id);
      setQuizQuestions(res.questions);
      setQuizAnswers({});
      setActiveTestId(test.quiz_id);
      setTestTimer(test.time_limit_minutes * 60);
      setQuizStep('taking');
    } catch (err: unknown) { setQuizError(err instanceof Error ? err.message : 'Failed to start test'); }
    finally { setQuizLoading(false); }
  }

  async function submitQuiz(auto = false) {
    if (timerRef.current) clearInterval(timerRef.current);
    setQuizLoading(true);
    try {
      const answers = quizQuestions.map(q => ({ question_id: q.id, answer: quizAnswers[q.id] ?? '' }));
      const res = await apiPost<{ results: QuizResult[] }>(`/api/v1/student/quiz/${quizId}/submit`, { answers }, token!);
      setQuizResults(res.results);
      setQuizStep('results');
      setActiveTestId(null);
      setProgress(null); // invalidate cache
    } catch (err: unknown) { setQuizError(err instanceof Error ? err.message : 'Failed to submit'); }
    finally { setQuizLoading(false); }
  }

  function resetQuiz() {
    setQuizStep('idle');
    setQuizSubject('');
    setQuizFrom('');
    setQuizTo(today());
    setQuizTopics([]);
    setSelectedTopics([]);
    setSelectedQTypes(['fill_blank', '1_mark']);
    setQuizQuestions([]);
    setQuizAnswers({});
    setQuizId('');
    setQuizResults([]);
    setQuizError('');
    setActiveTestId(null);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function handleTabChange(t: Tab) {
    if (activeTestId && t !== 'quiz') {
      alert('⚠ You have an active test. Please complete or submit it before navigating away.');
      return;
    }
    setTab(t);
    if (t === 'homework') loadHomework();
    if (t === 'progress') loadProgress();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #0f2417 0%, #1e5c3a 100%)' }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-white/40 animate-spin mx-auto mb-3" />
          <p className="text-white/60 text-sm">Loading your portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 flex-col z-40"
        style={{ background: 'linear-gradient(180deg, #0f2417 0%, #1a3c2e 100%)' }}>
        <div className="px-6 py-5 border-b border-white/10">
          <OakitLogo size="sm" variant="light" />
          <p className="text-white/40 text-xs mt-1">Student Portal</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {TABS.map(({ id, Icon, label }) => (
            <button key={id} onClick={() => handleTabChange(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                tab === id ? 'bg-white/15 text-white' : 'text-white/55 hover:bg-white/8 hover:text-white/85'
              }`}>
              <Icon size={18} className="shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {tab === id && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
            </button>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-white/10">
          <div className="px-3 py-2 mb-1">
            <p className="text-white text-xs font-semibold truncate">{studentName}</p>
            <p className="text-white/40 text-[10px]">{className} · {sectionLabel}</p>
          </div>
          <button onClick={() => { clearStudentToken(); router.push('/student/login'); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors text-sm">
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">

        {/* Mobile header */}
        <header className="lg:hidden text-white px-4 pt-8 pb-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0f2417 0%, #1e5c3a 100%)' }}>
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between mb-1">
            <OakitLogo size="sm" variant="light" />
            <button onClick={() => { clearStudentToken(); router.push('/student/login'); }}
              className="text-white/50 hover:text-white/80 text-xs transition-colors">
              Sign out
            </button>
          </div>
          <div className="relative z-10 mt-2">
            <p className="text-white font-bold text-base">{studentName}</p>
            <p className="text-white/50 text-xs">{className} · Section {sectionLabel}</p>
          </div>
        </header>

        {/* Tab content */}
        <main className="flex-1 overflow-y-auto pb-24 lg:pb-8">
          <div className="p-4 lg:p-6 max-w-3xl mx-auto">
            {tab === 'today' && (
              <TodayTab
                feedDate={feedDate}
                feed={feed}
                loading={feedLoading}
                onPrev={() => changeDate(-1)}
                onNext={() => changeDate(1)}
                maxDate={addDays(today(), 5)}
              />
            )}
            {tab === 'homework' && (
              <HomeworkTab records={hwHistory} loading={hwLoading} onRefresh={() => { setHwHistory([]); loadHomework(); }} />
            )}
            {tab === 'ask' && (
              <AskOakieTab
                msgs={chatMsgs}
                input={chatInput}
                loading={chatLoading}
                disabled={!!activeTestId}
                onInput={setChatInput}
                onSend={sendChat}
                endRef={chatEndRef}
              />
            )}
            {tab === 'quiz' && (
              <QuizTab
                step={quizStep}
                subject={quizSubject}
                quizFrom={quizFrom}
                quizTo={quizTo}
                topics={quizTopics}
                selectedTopics={selectedTopics}
                selectedQTypes={selectedQTypes}
                questions={quizQuestions}
                answers={quizAnswers}
                results={quizResults}
                loading={quizLoading}
                error={quizError}
                assignedTests={assignedTests}
                activeTestId={activeTestId}
                testTimer={testTimer}
                onSubjectChange={setQuizSubject}
                onFromChange={setQuizFrom}
                onToChange={setQuizTo}
                onLoadTopics={loadQuizTopics}
                onToggleTopic={id => setSelectedTopics(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                onToggleQType={id => setSelectedQTypes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                onGenerate={generateQuiz}
                onAnswerChange={(qid, val) => setQuizAnswers(prev => ({ ...prev, [qid]: val }))}
                onSubmit={() => submitQuiz(false)}
                onReset={resetQuiz}
                onStartAssigned={startAssignedTest}
                onStepChange={setQuizStep}
              />
            )}
            {tab === 'progress' && (
              <ProgressTab data={progress} loading={progressLoading} onRefresh={() => { setProgress(null); loadProgress(); }} />
            )}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 z-50 flex items-center justify-around px-1"
          style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))', paddingTop: '8px', boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' }}>
          {TABS.map(({ id, Icon, label }) => {
            const isActive = tab === id;
            return (
              <button key={id} onClick={() => handleTabChange(id)}
                className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[48px] min-h-[44px] transition-colors ${isActive ? 'text-emerald-600' : 'text-neutral-400'}`}>
                <Icon size={20} className={isActive ? 'scale-110 transition-transform' : ''} />
                <span className={`text-[9px] font-semibold ${isActive ? 'text-emerald-600' : 'text-neutral-400'}`}>{label}</span>
                {isActive && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// ─── Today Tab ─────────────────────────────────────────────────────────────────
function TodayTab({ feedDate, feed, loading, onPrev, onNext, maxDate }: {
  feedDate: string; feed: FeedDay | null; loading: boolean;
  onPrev: () => void; onNext: () => void; maxDate: string;
}) {
  const isToday = feedDate === today();
  const isFuture = feedDate > today();
  const atMax = feedDate >= maxDate;

  // Group topics by subject
  const bySubject: Record<string, TopicCard[]> = {};
  (feed?.topics ?? []).forEach(t => {
    if (!bySubject[t.subject]) bySubject[t.subject] = [];
    bySubject[t.subject].push(t);
  });

  return (
    <div className="space-y-4">
      {/* Date navigator */}
      <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-neutral-100">
        <button onClick={onPrev}
          className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors">
          <ChevronLeft size={18} className="text-neutral-600" />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-neutral-800">{dayLabel(feedDate)}</p>
          <p className="text-xs text-neutral-400">{fmtDate(feedDate)}</p>
        </div>
        <button onClick={onNext} disabled={atMax}
          className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors disabled:opacity-30">
          <ChevronRight size={18} className="text-neutral-600" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-7 h-7 text-neutral-300 animate-spin" />
        </div>
      )}

      {!loading && isFuture && feedDate > addDays(today(), 5) && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-center">
          <p className="text-amber-700 text-sm font-medium">Topics for this date are not yet available.</p>
        </div>
      )}

      {!loading && !isFuture && feed?.topics.length === 0 && (
        <div className="bg-neutral-50 border border-neutral-100 rounded-2xl p-8 text-center">
          <p className="text-3xl mb-2">📚</p>
          <p className="text-neutral-500 text-sm">Nothing was covered on this date.</p>
        </div>
      )}

      {!loading && Object.keys(bySubject).length > 0 && (
        <div className="space-y-3">
          {Object.entries(bySubject).map(([subject, topics]) => (
            <div key={subject} className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
              <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">{subject}</p>
              </div>
              <div className="divide-y divide-neutral-50">
                {topics.map(t => (
                  <div key={t.chunk_id} className="px-4 py-3">
                    <p className="text-sm font-semibold text-neutral-800">{t.topic_name}</p>
                    {t.notes && <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{t.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Homework card */}
      {!loading && feed?.homework && (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
            <BookOpen size={14} className="text-blue-600" />
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Homework</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">{feed.homework.formatted_text}</p>
          </div>
        </div>
      )}

      {!loading && !feed?.homework && feed?.topics && feed.topics.length > 0 && (
        <div className="bg-neutral-50 rounded-2xl px-4 py-3 border border-neutral-100">
          <p className="text-xs text-neutral-400 text-center">No homework for this date.</p>
        </div>
      )}
    </div>
  );
}

// ─── Homework Tab ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  completed:     { label: 'Completed',     color: 'bg-emerald-100 text-emerald-700', icon: '✓' },
  partial:       { label: 'Partial',       color: 'bg-amber-100 text-amber-700',     icon: '~' },
  not_submitted: { label: 'Not Submitted', color: 'bg-red-100 text-red-600',         icon: '✗' },
};

function HomeworkTab({ records, loading, onRefresh }: {
  records: HomeworkRecord[]; loading: boolean; onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-neutral-800">Homework History</h2>
        <button onClick={onRefresh}
          className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors">
          <RefreshCw size={14} className="text-neutral-500" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-7 h-7 text-neutral-300 animate-spin" />
        </div>
      )}

      {!loading && records.length === 0 && (
        <div className="bg-neutral-50 rounded-2xl p-8 text-center border border-neutral-100">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-neutral-500 text-sm">No homework records for the last 30 days.</p>
        </div>
      )}

      {!loading && records.length > 0 && (
        <div className="space-y-2">
          {records.map((r, i) => {
            const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.not_submitted;
            return (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-neutral-100 px-4 py-3 flex items-start gap-3">
                <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${cfg.color}`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs text-neutral-400">{fmtDate(r.homework_date)}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  {r.homework_text && <p className="text-sm text-neutral-700 leading-relaxed">{r.homework_text}</p>}
                  {r.teacher_note && <p className="text-xs text-neutral-400 mt-1 italic">Note: {r.teacher_note}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Ask Oakie Tab ─────────────────────────────────────────────────────────────
function AskOakieTab({ msgs, input, loading, disabled, onInput, onSend, endRef }: {
  msgs: ChatMsg[]; input: string; loading: boolean; disabled: boolean;
  onInput: (v: string) => void; onSend: () => void; endRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="flex flex-col h-[calc(100vh-220px)] lg:h-[calc(100vh-120px)]">
      {disabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-3 text-xs text-amber-700 font-medium">
          ⚠ Ask Oakie is disabled during an active test.
        </div>
      )}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'ai' && (
              <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mr-2 mt-0.5">O</div>
            )}
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-emerald-600 text-white rounded-br-sm'
                : 'bg-white border border-neutral-100 text-neutral-800 rounded-bl-sm shadow-sm'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mr-2 mt-0.5">O</div>
            <div className="bg-white border border-neutral-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <Loader2 size={16} className="text-neutral-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 pt-3 border-t border-neutral-100">
        <input
          value={input}
          onChange={e => onInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder={disabled ? 'Disabled during test' : 'Ask about a topic you studied…'}
          disabled={disabled || loading}
          maxLength={400}
          className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:bg-neutral-50 disabled:text-neutral-400"
        />
        <button onClick={onSend} disabled={disabled || loading || !input.trim()}
          className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center text-white transition-colors disabled:opacity-40">
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Quiz Tab ──────────────────────────────────────────────────────────────────
function QuizTab({
  step, subject, quizFrom, quizTo, topics, selectedTopics, selectedQTypes,
  questions, answers, results, loading, error, assignedTests, activeTestId, testTimer,
  onSubjectChange, onFromChange, onToChange, onLoadTopics, onToggleTopic, onToggleQType,
  onGenerate, onAnswerChange, onSubmit, onReset, onStartAssigned, onStepChange,
}: {
  step: QuizStep; subject: string; quizFrom: string; quizTo: string;
  topics: QuizTopic[]; selectedTopics: string[]; selectedQTypes: string[];
  questions: QuizQuestion[]; answers: Record<string, string>;
  results: QuizResult[]; loading: boolean; error: string;
  assignedTests: AssignedTest[]; activeTestId: string | null; testTimer: number;
  onSubjectChange: (v: string) => void; onFromChange: (v: string) => void; onToChange: (v: string) => void;
  onLoadTopics: () => void; onToggleTopic: (id: string) => void; onToggleQType: (id: string) => void;
  onGenerate: () => void; onAnswerChange: (qid: string, val: string) => void;
  onSubmit: () => void; onReset: () => void; onStartAssigned: (t: AssignedTest) => void;
  onStepChange: (s: QuizStep) => void;
}) {
  const totalMarks = results.reduce((s, r) => s + r.marks, 0);
  const scoredMarks = results.reduce((s, r) => s + r.marks_awarded, 0);
  const scorePct = totalMarks > 0 ? Math.round((scoredMarks / totalMarks) * 100) : 0;
  const weakSubjects = results.filter(r => !r.is_correct);

  const timerMins = Math.floor(testTimer / 60);
  const timerSecs = testTimer % 60;
  const timerColor = testTimer < 120 ? 'text-red-600' : 'text-neutral-700';

  if (step === 'taking') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-neutral-100">
          <p className="text-sm font-bold text-neutral-800">
            {activeTestId ? '📋 Assigned Test' : '✏️ Self Test'}
          </p>
          {activeTestId && (
            <div className={`flex items-center gap-1.5 text-sm font-bold ${timerColor}`}>
              <Clock size={14} />
              {String(timerMins).padStart(2, '0')}:{String(timerSecs).padStart(2, '0')}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="text-sm font-semibold text-neutral-800 leading-relaxed">
                  <span className="text-neutral-400 mr-1">Q{idx + 1}.</span>{q.question}
                </p>
                <span className="shrink-0 text-[10px] font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
                  {q.marks}m
                </span>
              </div>
              {(q.q_type === 'fill_blank' || q.q_type === '1_mark') ? (
                <input
                  value={answers[q.id] ?? ''}
                  onChange={e => onAnswerChange(q.id, e.target.value)}
                  placeholder="Your answer…"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              ) : (
                <textarea
                  value={answers[q.id] ?? ''}
                  onChange={e => onAnswerChange(q.id, e.target.value)}
                  placeholder="Write your answer…"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
                />
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

        <button onClick={onSubmit} disabled={loading}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Submitting…' : 'Submit Quiz'}
        </button>
      </div>
    );
  }

  if (step === 'results') {
    return (
      <div className="space-y-4">
        {/* Score card */}
        <div className={`rounded-2xl p-5 text-center ${scorePct >= 50 ? 'bg-emerald-600' : 'bg-red-500'}`}>
          <p className="text-white/70 text-xs font-medium mb-1">Your Score</p>
          <p className="text-white text-4xl font-black">{scoredMarks}/{totalMarks}</p>
          <p className="text-white/80 text-sm mt-1">{scorePct}%</p>
        </div>

        {scorePct < 50 && weakSubjects.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <p className="text-amber-800 text-sm font-semibold mb-1">💡 You may want to revise these topics:</p>
            <ul className="text-xs text-amber-700 space-y-0.5 list-disc pl-4">
              {weakSubjects.slice(0, 3).map((r, i) => <li key={i}>{r.question.slice(0, 60)}…</li>)}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className={`bg-white rounded-2xl shadow-sm border px-4 py-3 ${r.is_correct ? 'border-emerald-100' : 'border-red-100'}`}>
              <div className="flex items-start gap-2 mb-2">
                {r.is_correct
                  ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                  : <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />}
                <p className="text-sm text-neutral-800 leading-relaxed flex-1">{r.question}</p>
                <span className="shrink-0 text-xs font-bold text-neutral-500">{r.marks_awarded}/{r.marks}</span>
              </div>
              {!r.is_correct && (
                <div className="ml-6 space-y-1">
                  <p className="text-xs text-neutral-500">Your answer: <span className="text-neutral-700">{r.student_answer || '(blank)'}</span></p>
                  <p className="text-xs text-emerald-700">Correct: <span className="font-medium">{r.correct_answer}</span></p>
                  {r.ai_feedback && <p className="text-xs text-neutral-400 italic">{r.ai_feedback}</p>}
                </div>
              )}
            </div>
          ))}
        </div>

        <button onClick={onReset}
          className="w-full py-3 border border-neutral-200 text-neutral-700 font-semibold rounded-xl text-sm hover:bg-neutral-50 transition-colors">
          Take Another Quiz
        </button>
      </div>
    );
  }

  // Idle / flow steps
  return (
    <div className="space-y-4">
      {/* Assigned tests */}
      {assignedTests.filter(t => t.status !== 'completed').length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Assigned Tests</p>
          </div>
          <div className="divide-y divide-neutral-50">
            {assignedTests.filter(t => t.status !== 'completed').map(t => (
              <div key={t.quiz_id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{t.subject}</p>
                  <p className="text-xs text-neutral-400">
                    <Clock size={10} className="inline mr-1" />{t.time_limit_minutes} min · Due {fmtDate(t.due_date)}
                  </p>
                </div>
                <button onClick={() => onStartAssigned(t)} disabled={loading}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50">
                  Start
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Self-test flow */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100">
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Self Test</p>
        </div>
        <div className="p-4 space-y-4">

          {/* Step: subject + date range */}
          {(step === 'idle' || step === 'subject' || step === 'daterange') && (
            <>
              <div>
                <label className="text-xs font-medium text-neutral-500 mb-1 block">Subject</label>
                <input value={subject} onChange={e => onSubjectChange(e.target.value)}
                  placeholder="e.g. Mathematics"
                  className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-500 mb-1 block">From</label>
                  <input type="date" value={quizFrom} onChange={e => onFromChange(e.target.value)} max={today()}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-500 mb-1 block">To</label>
                  <input type="date" value={quizTo} onChange={e => onToChange(e.target.value)} max={today()}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                </div>
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
              <button onClick={onLoadTopics} disabled={loading || !subject || !quizFrom || !quizTo}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                {loading ? 'Loading topics…' : 'Find Topics →'}
              </button>
            </>
          )}

          {/* Step: confirm topics */}
          {step === 'topics' && (
            <>
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-2">Select topics to include ({selectedTopics.length}/{topics.length})</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {topics.map(t => (
                    <label key={t.chunk_id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-neutral-50 cursor-pointer">
                      <input type="checkbox" checked={selectedTopics.includes(t.chunk_id)}
                        onChange={() => onToggleTopic(t.chunk_id)}
                        className="w-4 h-4 rounded accent-emerald-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-neutral-800 truncate">{t.topic_name}</p>
                        <p className="text-[10px] text-neutral-400">{fmtDate(t.covered_date)}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {topics.length === 0 && (
                <p className="text-sm text-neutral-500 text-center py-2">No topics found for this subject and date range.</p>
              )}
              <div className="flex gap-2">
                <button onClick={onReset}
                  className="flex-1 py-2.5 border border-neutral-200 text-neutral-600 font-semibold rounded-xl text-sm hover:bg-neutral-50 transition-colors">
                  Back
                </button>
                <button onClick={() => onStepChange('qtypes')} disabled={selectedTopics.length === 0}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-40">
                  Next →
                </button>
              </div>
            </>
          )}

          {/* Step: question types */}
          {step === 'qtypes' && (
            <>
              <div>
                <p className="text-xs font-medium text-neutral-500 mb-2">Select question types</p>
                <div className="grid grid-cols-2 gap-2">
                  {Q_TYPES.map(qt => (
                    <label key={qt.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                      selectedQTypes.includes(qt.id) ? 'border-emerald-500 bg-emerald-50' : 'border-neutral-200 hover:border-neutral-300'
                    }`}>
                      <input type="checkbox" checked={selectedQTypes.includes(qt.id)}
                        onChange={() => onToggleQType(qt.id)}
                        className="w-4 h-4 rounded accent-emerald-600" />
                      <span className="text-sm text-neutral-700">{qt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => onStepChange('topics')}
                  className="flex-1 py-2.5 border border-neutral-200 text-neutral-600 font-semibold rounded-xl text-sm hover:bg-neutral-50 transition-colors">
                  Back
                </button>
                <button onClick={onGenerate} disabled={loading || selectedQTypes.length === 0}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                  {loading ? 'Generating…' : 'Generate Quiz'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Progress Tab ──────────────────────────────────────────────────────────────
function ProgressTab({ data, loading, onRefresh }: {
  data: ProgressStats | null; loading: boolean; onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-neutral-800">My Progress</h2>
        <button onClick={onRefresh}
          className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors">
          <RefreshCw size={14} className="text-neutral-500" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-7 h-7 text-neutral-300 animate-spin" />
        </div>
      )}

      {!loading && !data && (
        <div className="bg-neutral-50 rounded-2xl p-8 text-center border border-neutral-100">
          <p className="text-3xl mb-2">🏆</p>
          <p className="text-neutral-500 text-sm">Complete at least one quiz to see your progress.</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4 text-center">
              <p className="text-xs text-neutral-400 mb-1">Total Quizzes</p>
              <p className="text-3xl font-black text-neutral-800">{data.total_quizzes}</p>
            </div>
            <div className={`rounded-2xl shadow-sm border p-4 text-center ${data.average_score_pct >= 50 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
              <p className="text-xs text-neutral-400 mb-1">Average Score</p>
              <p className={`text-3xl font-black ${data.average_score_pct >= 50 ? 'text-emerald-700' : 'text-red-600'}`}>
                {data.average_score_pct}%
              </p>
            </div>
          </div>

          {/* Subject breakdown */}
          {data.subject_breakdown.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-50 flex items-center gap-2">
                <BarChart2 size={14} className="text-neutral-400" />
                <p className="text-xs font-bold text-neutral-600 uppercase tracking-wide">Subject Breakdown</p>
              </div>
              <div className="divide-y divide-neutral-50">
                {data.subject_breakdown.map((s, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-semibold text-neutral-800">{s.subject}</p>
                      <span className={`text-xs font-bold ${s.avg_pct >= 50 ? 'text-emerald-600' : 'text-red-500'}`}>{s.avg_pct}%</span>
                    </div>
                    <div className="w-full bg-neutral-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full transition-all ${s.avg_pct >= 50 ? 'bg-emerald-500' : 'bg-red-400'}`}
                        style={{ width: `${s.avg_pct}%` }} />
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1">{s.quiz_count} quiz{s.quiz_count !== 1 ? 'zes' : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weak areas */}
          {data.weak_areas.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-100">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Needs Revision</p>
              </div>
              <div className="divide-y divide-amber-100">
                {data.weak_areas.map((w, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-amber-900">{w.subject}</p>
                      {w.chapter && <p className="text-xs text-amber-600">{w.chapter}</p>}
                    </div>
                    <span className="text-xs font-bold text-red-500">{w.avg_pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent quizzes */}
          {data.recent_quizzes.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-50">
                <p className="text-xs font-bold text-neutral-600 uppercase tracking-wide">Recent Quizzes</p>
              </div>
              <div className="divide-y divide-neutral-50">
                {data.recent_quizzes.map((q, i) => {
                  const pct = q.total_marks > 0 ? Math.round((q.scored_marks / q.total_marks) * 100) : 0;
                  return (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-neutral-800">{q.subject}</p>
                        <p className="text-xs text-neutral-400">{fmtDate(q.created_at)} · {q.q_count} questions</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${pct >= 50 ? 'text-emerald-600' : 'text-red-500'}`}>{q.scored_marks}/{q.total_marks}</p>
                        <p className="text-[10px] text-neutral-400">{pct}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
