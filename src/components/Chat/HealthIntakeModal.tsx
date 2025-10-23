import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HealthIntakeQuestion } from '@/lib/healthIntake';

interface HealthIntakeModalProps {
  questions: HealthIntakeQuestion[];
  onSubmit: (answers: Record<string, string | string[]>) => void;
  onClose: () => void;
}

export default function HealthIntakeModal({ questions, onSubmit, onClose }: HealthIntakeModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [selectedMultiple, setSelectedMultiple] = useState<Set<string>>(new Set());
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);
  const [justNavigatedBack, setJustNavigatedBack] = useState(false);
  const [manualInput, setManualInput] = useState<Record<string, string>>({});

  // Show additional details input after all questions
  const isOnAdditionalDetails = currentIndex === questions.length;
  const currentQuestion = !isOnAdditionalDetails ? questions[currentIndex] : null;
  const totalSteps = questions.length + 1; // +1 for additional details
  const progress = ((currentIndex + 1) / totalSteps) * 100;
  
  // Detect multi-select: Use multiSelect flag OR detect "(Select all that apply)" in question text
  const isMultiSelect = currentQuestion?.multiSelect === true || 
    (currentQuestion?.text && /\(select all that apply\)/i.test(currentQuestion.text));
  
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;

  // Handle browser back button to go back through questions OR close modal
  useEffect(() => {
    // Push initial modal state
    window.history.pushState({ healthIntakeModal: true, questionIndex: 0 }, '');
    
    const handlePopState = (e: PopStateEvent) => {
      // If we're still in the modal, prevent default back and handle internally
      if (currentIndex > 0) {
        // Go to previous question instead of closing
        window.history.pushState({ healthIntakeModal: true, questionIndex: currentIndex - 1 }, '');
        setCurrentIndex(prev => Math.max(0, prev - 1));
      } else {
        // At first question or additional details - close modal
        onClose();
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentIndex, onClose]);

  // Load multi-select answers when question changes
  useEffect(() => {
    if (currentQuestion && isMultiSelect && answers[currentQuestion.id]) {
      setSelectedMultiple(new Set(answers[currentQuestion.id] as string[]));
    } else if (!isMultiSelect) {
      setSelectedMultiple(new Set()); // Clear for single-select questions
    }
  }, [currentIndex, currentQuestion?.id]); // Re-run when question changes

  // Auto-advance for single-select with smooth animation (but not after back navigation)
  useEffect(() => {
    if (!isMultiSelect && currentAnswer && currentIndex < questions.length && !justNavigatedBack) {
      const timer = setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
      }, 350); // Reduced delay for smoother feel
      return () => clearTimeout(timer);
    }
    // Reset the back navigation flag after effect runs
    if (justNavigatedBack) {
      setJustNavigatedBack(false);
    }
  }, [currentAnswer, isMultiSelect, currentIndex, questions.length, justNavigatedBack]);

  const handleSingleSelect = (option: string) => {
    setAnswers({ ...answers, [currentQuestion.id]: option });
  };

  const handleMultiSelect = (option: string) => {
    if (!currentQuestion) return;
    
    const newSelected = new Set(selectedMultiple);
    if (newSelected.has(option)) {
      newSelected.delete(option);
    } else {
      newSelected.add(option);
    }
    setSelectedMultiple(newSelected);
    setAnswers({ ...answers, [currentQuestion.id]: Array.from(newSelected) });
  };

  const handleNext = () => {
    // Save multi-select answers before moving
    if (currentQuestion && isMultiSelect) {
      setAnswers({ ...answers, [currentQuestion.id]: Array.from(selectedMultiple) });
    }

    if (currentIndex < questions.length) {
      setCurrentIndex(currentIndex + 1);
      // selectedMultiple will be updated by the useEffect above
    } else {
      // Submit all answers including additional details
      const finalAnswers = { ...answers };
      if (additionalDetails.trim()) {
        finalAnswers['__additional'] = additionalDetails.trim();
      }
      onSubmit(finalAnswers);
    }
  };

  const handleBack = () => {
    // Save current multi-select answers before going back
    if (currentQuestion && isMultiSelect) {
      setAnswers({ ...answers, [currentQuestion.id]: Array.from(selectedMultiple) });
    }
    
    if (currentIndex > 0) {
      setJustNavigatedBack(true); // Prevent auto-advance on single-select questions
      setCurrentIndex(currentIndex - 1);
      // Load previous multi-select answers
      const prevQuestion = questions[currentIndex - 1];
      if (prevQuestion?.multiSelect && answers[prevQuestion.id]) {
        setSelectedMultiple(new Set(answers[prevQuestion.id] as string[]));
      } else {
        setSelectedMultiple(new Set());
      }
    }
  };

  const canProceed = isOnAdditionalDetails 
    ? true // Can skip additional details
    : isMultiSelect 
    ? selectedMultiple.size > 0 || (currentQuestion && manualInput[currentQuestion.id]?.trim())
    : !!currentAnswer || (currentQuestion && manualInput[currentQuestion.id]?.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        {/* Header with progress */}
        <div className="relative p-6 pb-4 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
          
          <div className="pr-12">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Health Assessment
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {progress.toFixed(0)}% complete
            </p>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-orange-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto flex flex-col">
          {isOnAdditionalDetails ? (
            // Additional details input
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <p className="text-lg font-medium text-gray-900 dark:text-white leading-relaxed">
                Any additional symptoms, conditions, or details?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Share any other information that might help (medications, allergies, recent changes, etc.)
              </p>
              <textarea
                value={additionalDetails}
                onChange={(e) => setAdditionalDetails(e.target.value)}
                placeholder="Type here or skip to continue..."
                className="w-full h-32 px-4 py-3 text-sm rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
              />
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <p className="text-lg font-medium text-gray-900 dark:text-white leading-relaxed">
                {currentQuestion?.text}
              </p>

              {/* Options in 2-column grid for better space usage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {currentQuestion?.options?.map((option, idx) => {
                  const isSelected = isMultiSelect
                    ? selectedMultiple.has(option)
                    : currentAnswer === option;

                  return (
                    <button
                      key={idx}
                      onClick={() =>
                        isMultiSelect ? handleMultiSelect(option) : handleSingleSelect(option)
                      }
                      className={cn(
                        'text-left p-3 rounded-lg border-2 transition-all duration-200',
                        'hover:border-primary/50 hover:bg-primary/5 hover:scale-[1.02]',
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-sm scale-[1.02]'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Radio or Checkbox indicator */}
                        <div
                          className={cn(
                            'flex-shrink-0 flex items-center justify-center transition-all duration-200 mt-0.5',
                            isMultiSelect
                              ? 'w-4 h-4 rounded border-2'
                              : 'w-4 h-4 rounded-full border-2',
                            isSelected
                              ? 'border-primary bg-primary'
                              : 'border-gray-300 dark:border-gray-600'
                          )}
                        >
                          {isSelected && (
                            isMultiSelect ? (
                              <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            )
                          )}
                        </div>

                        <span
                          className={cn(
                            'text-sm transition-colors leading-snug',
                            isSelected
                              ? 'text-gray-900 dark:text-white font-medium'
                              : 'text-gray-700 dark:text-gray-300'
                          )}
                        >
                          {option}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Hint for multi-select */}
              {isMultiSelect && (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                  Select all that apply
                </p>
              )}

              {/* Manual text input option */}
              <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Or type your own answer:
                </p>
                <input
                  type="text"
                  value={currentQuestion ? (manualInput[currentQuestion.id] || '') : ''}
                  onChange={(e) => {
                    if (!currentQuestion) return;
                    const value = e.target.value;
                    setManualInput({ ...manualInput, [currentQuestion.id]: value });
                    // If user types, save it as the answer
                    if (value.trim()) {
                      setAnswers({ ...answers, [currentQuestion.id]: value.trim() });
                      // Clear option selections when typing
                      if (isMultiSelect) {
                        setSelectedMultiple(new Set());
                      }
                    }
                  }}
                  placeholder="Type your answer here..."
                  className="w-full px-4 py-2.5 text-sm rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={handleBack}
            disabled={currentIndex === 0}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              currentIndex === 0
                ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <button
            onClick={handleNext}
            disabled={!canProceed}
            className={cn(
              'flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium transition-all',
              canProceed
                ? 'bg-primary text-white hover:bg-primary/90 shadow-sm hover:shadow-md'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            )}
          >
            {isOnAdditionalDetails ? 'Submit' : 'Next'}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
