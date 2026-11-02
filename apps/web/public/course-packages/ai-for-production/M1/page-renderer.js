class PageRenderer {
    constructor() {
        this.initialized = false;
        this.renderingInProgress = false;
        this.currentPage = null;

        this.initializeWhenReady();
    }

    initializeWhenReady() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        if (this.initialized) return;

        // Setup event listeners for page changes
        this.setupEventListeners();

        this.initialized = true;
        console.log('Page renderer initialized');

        // Make this available globally
        window.pageRenderer = this;
    }

    setupEventListeners() {
        // Listen to pagination system events
        document.addEventListener('pageChanged', (event) => {
            const { toPage } = event.detail;
            this.handlePageChange(toPage);
        });

        // Listen to content loading events
        document.addEventListener('paginationSystemReady', () => {
            console.log('Page renderer ready for pagination system');
        });
    }

    handlePageChange(pageId) {
        // This is handled by the pagination system calling renderCurrentPage
        // Keeping this method for potential future use
    }

    renderCurrentPage(page) {
        if (this.renderingInProgress) {
            console.warn('Rendering already in progress, skipping');
            return;
        }

        this.renderingInProgress = true;
        this.currentPage = page;

        const contentContainer = document.getElementById('current-page-content');
        const pageContainer = document.getElementById('page-container');
        if (!contentContainer) {
            console.error('Current page content container not found');
            this.renderingInProgress = false;
            return;
        }

        // Show loading state
        this.showLoadingState(contentContainer);

        // Add page transition classes
        contentContainer.classList.add('page-transitioning');

        try {
            let content = '';

            switch (page.type) {
                case 'introduction':
                    content = this.renderIntroductionPage(page);
                    break;
                case 'sub-concept':
                    // Delegate to SubConceptRenderer
                    content = window.subConceptRenderer ?
                        window.subConceptRenderer.renderSubConceptPage(page) :
                        this.renderErrorPage('Sub-concept renderer not available');
                    break;
                case 'task':
                    content = this.renderTaskPage(page);
                    break;
                case 'final-quiz':
                    content = this.renderFinalQuizPage(page);
                    break;
                default:
                    content = this.renderErrorPage(`Unknown page type: ${page.type}`);
            }

            // Render content after a small delay for smooth transition
            setTimeout(() => {
                contentContainer.innerHTML = content;
                contentContainer.classList.remove('page-transitioning');
                contentContainer.classList.add('page-transition-complete');

                // Scroll to top of page container when new page renders
                if (pageContainer) {
                    pageContainer.scrollTop = 0;
                }

                // Initialize page-specific functionality
                this.initializePageFunctionality(page);

                // Dispatch page rendered event
                document.dispatchEvent(new CustomEvent('pageRendered', {
                    detail: { pageId: page.id, pageType: page.type }
                }));

                this.renderingInProgress = false;
            }, 150);

        } catch (error) {
            console.error('Error rendering page:', error);
            contentContainer.innerHTML = this.renderErrorPage(error.message);
            contentContainer.classList.remove('page-transitioning');
            this.renderingInProgress = false;
        }
    }

    showLoadingState(container) {
        container.innerHTML = `
            <div class="page-loading">
                <div class="page-loading-spinner"></div>
                <p class="mt-4 text-gray-600">Loading content...</p>
            </div>
        `;
    }

    renderIntroductionPage(page) {
        const { topic, learningObjectives } = page.data;
        const content = topic?.content || {};


        return `
            <div class="introduction-page page-content" data-page-type="introduction">
                <!-- Hero Section with Task Statement - No Card Wrapper -->
                <div class="mb-16">
                    <div class="text-center mb-16">
                        <h1 class="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-8 leading-tight">
                            ${content.task_statement || topic.title || 'Welcome to Your Course'}
                        </h1>
                        <p class="text-2xl text-gray-600 max-w-5xl mx-auto mb-16 leading-relaxed">
                            ${topic.description || 'Begin your learning journey with this comprehensive course designed to help you master new skills and concepts.'}
                        </p>
                    </div>

                    <!-- Hero Visual -->
                    ${content.hero_image ? `
                    <div class="relative mb-16">
                        <img src="${content.hero_image.src}" alt="${content.hero_image.alt}"
                             class="hero-image-full transition-transform duration-700 hover:scale-105"
                             loading="lazy">
                        ${content.hero_image.caption ? `
                        <div class="mt-4 bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-medium mx-4">
                            <p class="text-gray-800 font-medium text-center">${content.hero_image.caption}</p>
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}
                </div>

                <!-- Learning Objectives Section -->
                ${learningObjectives && learningObjectives.length > 0 ? `
                    <section id="legacyLearningObjectives" class="bg-white border-b border-gray-100 rounded-2xl p-6 sm:p-8 mb-8 shadow-soft">
                        <div class="text-center mb-8">
                            <h2 class="text-3xl font-bold text-gray-900 mb-4">Learning Objectives</h2>
                            <p class="text-lg text-gray-600 max-w-3xl mx-auto">What you'll achieve by completing this topic</p>
                        </div>

                        <div class="flex flex-wrap justify-center gap-4">
                            ${learningObjectives.map(objective => `
                                <div class="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.75rem)] max-w-sm bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                                    <div class="flex items-start gap-3">
                                        <i class="fa-solid fa-circle-check text-nebula-500 text-lg mt-0.5 flex-shrink-0"></i>
                                        <p class="text-gray-800 font-medium leading-relaxed flex-1">${objective}</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </section>
                ` : ''}

                <!-- Getting Started -->
                <div class="getting-started text-center rounded-2xl p-10 shadow-lg"
                     style="background: linear-gradient(135deg, #ffffff 0%, #e0f2fe 50%, #ddd6fe 100%);">
                    <h3 class="text-2xl font-bold text-gray-900 mb-6 flex items-center justify-center">
                        <i class="fas fa-route text-nebula-500 mr-4 text-2xl"></i>
                        Ready to Start Learning?
                    </h3>
                    <p class="text-lg text-gray-700 mb-10 max-w-2xl mx-auto">
                        Complete each concept and its quiz to unlock the next section of your learning journey.
                    </p>

                    <!-- Get Started Button - Triggers Fullscreen -->
                    <button onclick="window.fullscreenManager ? window.fullscreenManager.onGetStartedClick() : window.navigateNextPage()"
                            class="group inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-nebula-600 to-teal-600 text-white rounded-xl font-semibold hover:from-nebula-700 hover:to-teal-700 transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:scale-105 hover:-translate-y-1">
                        <span>Get Started</span>
                        <svg class="w-6 h-6 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    // renderSubConceptPage method has been extracted to sub-concept-renderer.js

    renderTaskPage(page) {
        const { task } = page.data;
        const currentPageIndex = page.index;
        const totalPages = window.paginationSystem?.totalPages || 1;

        // Check if task is locked
        if (page.locked) {
            return this.renderLockedTaskPage(task);
        }

        // Find prerequisite concept for unlock status
        const prerequisiteConcept = this.findPrerequisiteConcept(task);

        // Use TaskRenderer for complete task rendering
        const taskContent = window.taskRenderer ?
            window.taskRenderer.renderTask(task, task.steps, prerequisiteConcept) :
            this.renderErrorPage('Task renderer not available');

        return `
            <div class="task-page page-content" data-page-type="task" data-task-id="${task.id}">
                ${taskContent}

                <!-- Page Navigation -->
                <div class="page-navigation mt-8 pt-6 border-t border-gray-200">
                    <div class="flex justify-between items-center">
                        <!-- Previous Button -->
                        <button onclick="window.navigatePreviousPage()" class="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors duration-200 hover:bg-gray-50 rounded-lg">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 17l-5-5m0 0l5-5m-5 5h12"></path>
                            </svg>
                            Previous
                        </button>

                        <!-- Next Button -->
                        <button onclick="window.navigateNextPage()" class="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-nebula-500 to-teal-600 text-white font-medium rounded-lg hover:from-nebula-600 hover:to-teal-700 transition-all duration-200 shadow-soft hover:shadow-medium">
                            Next
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderLockedTaskPage(task) {
        // Find prerequisite concept for the message
        let prerequisiteTitle = 'prerequisite concept';
        if (task.unlock_after) {
            const prerequisiteConcept = this.findPrerequisiteConcept(task);
            if (prerequisiteConcept) {
                prerequisiteTitle = prerequisiteConcept.title;
            }
        }

        return `
            <div class="task-page page-content" data-page-type="task" data-task-id="${task.id}">
                <div class="task-card locked bg-white rounded-3xl shadow-medium border border-gray-200 opacity-60 overflow-hidden">
                    <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-6 border-b border-gray-200">
                        <div class="flex items-center space-x-4">
                            <div class="w-12 h-12 bg-gradient-to-r from-gray-400 to-gray-500 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-medium">
                                <i class="fas fa-lock"></i>
                            </div>
                            <div class="flex-1">
                                <h4 class="text-xl font-bold text-gray-900">${task.title}</h4>
                                <p class="text-gray-600 mt-1">Complete "${prerequisiteTitle}" to unlock this task</p>
                            </div>
                            <div class="flex items-center">
                                <span class="text-gray-500 font-semibold">
                                    <i class="fas fa-lock mr-2"></i>Locked
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="p-8 text-center text-gray-500">
                        <i class="fas fa-lock text-4xl mb-4"></i>
                        <p class="text-lg font-medium mb-2">This task is locked</p>
                        <p class="text-sm">Complete the prerequisite concept to unlock this task and continue your learning journey.</p>
                    </div>
                </div>
            </div>
        `;
    }

    findPrerequisiteConcept(task) {
        // Find the concept that unlocks this task
        if (!task.unlock_after) return null;

        return window.templateData.concepts.find(c => c.id === task.unlock_after);
    }

    renderFinalQuizPage(page) {
        const { quiz } = page.data;

        return `
            <div class="final-quiz-page page-content" data-page-type="final-quiz" style="height: 100%; display: flex; flex-direction: column;">
                <!-- Simple Header -->
                <div class="final-quiz-header px-6 py-4 border-b border-gray-200 bg-white">
                    <h1 class="final-quiz-title text-xl font-bold text-gray-900">Final Assessment</h1>
                    <p class="final-quiz-description text-sm text-gray-600">
                        Test your knowledge of all the concepts covered in this course.
                        ${quiz ? `This quiz contains ${quiz.questions ? quiz.questions.length : 0} questions.` : ''}
                    </p>
                </div>

                <!-- Quiz Content - takes full remaining height -->
                <div class="final-quiz-content flex-1" style="overflow: hidden;">
                    <!-- Use the original quiz system structure with proper scrolling -->
                    <section class="bg-gradient-to-br from-gray-50 to-white h-full" style="overflow-y: auto;">
                        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                            <!-- Quiz Progress Bar -->
                            <div class="mb-6">
                                <div class="bg-gray-200 h-2 rounded-full overflow-hidden">
                                    <div id="quizProgressBar" class="bg-gradient-to-r from-nebula-500 to-nebula-purple-500 h-full transition-all duration-500"
                                         style="width: 0%"></div>
                                </div>
                                <div class="flex justify-between items-center mt-2">
                                    <span class="text-sm font-medium text-gray-600">
                                        Question <span id="quizProgressText">1 of 1</span>
                                    </span>
                                    <span class="text-sm font-medium text-gray-600">
                                        Score: <span id="currentScore">0</span>
                                    </span>
                                </div>
                            </div>

                            <!-- Question Navigation Dots -->
                            <div class="flex justify-center space-x-2 mb-6" id="quizQuestionDots">
                                <!-- Dots will be added dynamically -->
                            </div>

                            <!-- Quiz Question Container -->
                            <div id="quizQuestionContainer" class="bg-white rounded-2xl shadow-soft border border-gray-100 p-8 mb-6">
                                <!-- Quiz content will be rendered here by quiz-system.js -->
                                <div class="text-center py-8">
                                    <div class="page-loading-spinner mx-auto mb-4"></div>
                                    <p class="text-gray-600">Loading quiz questions...</p>
                                </div>
                            </div>

                            <!-- Quiz Results (Hidden initially) -->
                            <div id="quizResults" class="hidden quiz-results">
                                <div class="text-center relative z-10">
                                    <div class="w-20 h-20 bg-gradient-to-r from-nebula-500 to-nebula-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <i class="fas fa-trophy text-white text-3xl"></i>
                                    </div>
                                    <h3 class="text-2xl font-bold text-white mb-2">Quiz Completed!</h3>
                                    <p class="text-white mb-4 opacity-90">Your final score is:</p>
                                    <div class="quiz-score-display">
                                        <span id="finalScore">0</span>
                                    </div>
                                </div>
                                <div class="flex justify-center space-x-4">
                                    <button id="retryQuizBtn" onclick="retryQuiz()"
                                            class="hidden retry-quiz-btn flex items-center space-x-2">
                                        <i class="fas fa-redo"></i>
                                        <span>Retry Quiz</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Navigation is now inline within quizQuestionContainer -->
                        </div>
                    </section>
                </div>

                <!-- Page Navigation (Only Previous for Final Assessment) - Fixed at bottom -->
                <div class="page-navigation px-6 py-3 border-t border-gray-200 bg-white">
                    <div class="flex justify-between items-center">
                        <!-- Previous Button -->
                        <button onclick="window.navigatePreviousPage()" class="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors duration-200 hover:bg-gray-50 rounded-lg">
                            <i class="fas fa-arrow-left"></i>
                            Back to Course
                        </button>

                        <!-- No Next Button for Final Assessment -->
                        <div></div>
                    </div>
                </div>
            </div>
        `;
    }

    renderErrorPage(message) {
        return `
            <div class="page-error page-content">
                <div class="page-error-icon">⚠️</div>
                <h2 class="text-2xl font-semibold text-red-600 mb-4">Content Loading Error</h2>
                <p class="text-gray-600 mb-6">${message}</p>
                <p class="text-sm text-gray-500">Use the navigation controls at the bottom of the screen to continue.</p>
            </div>
        `;
    }

    initializePageFunctionality(page) {
        this.updatePipContextForPage(page);

        switch (page.type) {
            case 'task':
                this.initializeTaskPage(page);
                break;
            case 'final-quiz':
                this.initializeFinalQuizPage(page);
                break;
            case 'sub-concept':
                // Delegate to SubConceptRenderer
                if (window.subConceptRenderer) {
                    window.subConceptRenderer.initializeSubConceptPage(page);
                } else {
                    console.error('SubConceptRenderer not available for initialization');
                }
                break;
        }

        // Focus management for accessibility
        this.managePageFocus();
    }

    updatePipContextForPage(page) {
        if (!window.pipManager) return;

        // PiP auto-trigger should only be armed on task pages.
        if (!page || page.type !== 'task') {
            window.pipManager.clearTaskContext(true);
            return;
        }

        const task = page.data && page.data.task;
        if (!task || !task.id) {
            window.pipManager.clearTaskContext(true);
            return;
        }

        const pipSteps = (window.pipStepsRegistry && window.pipStepsRegistry[task.id]) || [];
        if (!Array.isArray(pipSteps) || pipSteps.length === 0) {
            // Do not retain stale task context when current task has no PiP content.
            window.pipManager.clearTaskContext(true);
            return;
        }

        const preferredStepIndex = window.pipManager.currentTaskId === task.id
            ? Math.min(window.pipManager.currentStepIndex || 0, pipSteps.length - 1)
            : 0;

        window.pipManager.setTaskContext(task.id, pipSteps, preferredStepIndex, task.title || 'Task Instructions');
    }

    initializeTaskPage(page) {
        const { task } = page.data;

        // Task is already fully rendered, delegate to TaskRenderer for dynamic components
        if (window.taskRenderer) {
            setTimeout(() => {
                try {
                    // Initialize dynamic components
                    window.taskRenderer.initializeImageCarousels();
                    window.taskRenderer.initializeVideoPlayers();
                    window.taskRenderer.initializeCodeHighlighting();
                    window.taskRenderer.setupTaskEventListeners(task);
                    window.taskRenderer.initializeTaskUploadState(task.id);
                } catch (error) {
                    console.error('Error initializing task components:', error);
                }
            }, 100);
        } else {
            console.warn('TaskRenderer not available');
        }
    }

    initializeFinalQuizPage(page) {
        const { quiz } = page.data;
        console.log('🎯 Initializing final quiz page with quiz:', quiz ? 'Found quiz data' : 'No quiz data');

        // Initialize final quiz using the existing quiz system
        if (window.initializeQuiz && typeof window.initializeQuiz === 'function') {
            setTimeout(() => {
                try {
                    // Initialize quiz system with quiz data from page data
                    window.initializeQuiz(quiz);
                } catch (error) {
                    console.error('Error initializing final quiz:', error);
                    this.showQuizError(error.message);
                }
            }, 100);
        } else {
            console.error('Quiz system not available - window.initializeQuiz not found');
            this.showQuizError('Quiz system not loaded');
        }
    }

    showQuizError(message) {
        const container = document.getElementById('quizQuestionContainer');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <i class="fas fa-exclamation-circle text-5xl text-red-500 mb-4"></i>
                    <h3 class="text-xl font-semibold text-gray-900 mb-2">Quiz Error</h3>
                    <p class="text-gray-600">${message}</p>
                </div>
            `;
        }
    }

    initializeSubConceptPage(page) {
        const { hasQuiz, concept, isLastSubConcept } = page.data;

        // Initialize embedded quiz if present and not already initialized
        if (hasQuiz && concept.quiz && isLastSubConcept) {
            setTimeout(() => {
                try {
                    // First, make the quiz section visible (like the old toggleConceptQuiz did)
                    const quizSection = document.getElementById(`quiz-section-${concept.id}`);
                    if (quizSection) {
                        console.log('🎯 Page renderer: Making quiz section visible for:', concept.id);
                        quizSection.classList.remove('hidden');
                        quizSection.style.display = 'block';
                        quizSection.style.visibility = 'visible';
                        quizSection.style.opacity = '1';
                        quizSection.style.height = 'auto';
                        quizSection.style.minHeight = '400px';
                        quizSection.style.width = '100%';
                        quizSection.style.overflow = 'visible';
                        quizSection.style.position = 'relative';
                        quizSection.style.zIndex = '1000';

                        // Force content area to expand
                        const contentDiv = document.getElementById(`quiz-content-${concept.id}`);
                        if (contentDiv) {
                            contentDiv.style.display = 'block';
                            contentDiv.style.height = 'auto';
                            contentDiv.style.minHeight = '300px';
                            contentDiv.style.width = '100%';
                        }

                        console.log('🎯 Quiz section made visible, now loading quiz...');

                        // Then load the quiz using the correct function
                        if (window.loadConceptQuiz && typeof window.loadConceptQuiz === 'function') {
                            window.loadConceptQuiz(concept.id);
                        } else {
                            console.warn('loadConceptQuiz function not available');
                        }
                    } else {
                        console.error('Quiz section not found for concept:', concept.id);
                    }
                } catch (error) {
                    console.error('Error initializing quiz for sub-concept page:', error);
                }
            }, 300);

            // Listen for quiz completion to enable Next button
            const handleQuizCompletion = (event) => {
                if (event.detail.conceptId === concept.id && event.detail.passed) {
                    // Update the Next button to enabled state
                    const pageNavigation = document.querySelector('.page-navigation');
                    if (pageNavigation) {
                        const nextButtonContainer = pageNavigation.querySelector('.flex.justify-between > div:last-child');
                        if (nextButtonContainer && nextButtonContainer.classList.contains('cursor-not-allowed')) {
                            // Replace disabled button with enabled Next button
                            nextButtonContainer.outerHTML = `
                                <button onclick="window.navigateNextPage()" class="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-nebula-500 to-teal-600 text-white font-medium rounded-lg hover:from-nebula-600 hover:to-teal-700 transition-all duration-200 shadow-soft hover:shadow-medium">
                                    Next
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                                    </svg>
                                </button>
                            `;
                        }
                    }
                }
            };

            // Add event listener for quiz completion
            document.addEventListener('conceptQuizCompleted', handleQuizCompletion);

            // Clean up event listener when page changes
            const cleanup = () => {
                document.removeEventListener('conceptQuizCompleted', handleQuizCompletion);
            };
            document.addEventListener('pageChanged', cleanup, { once: true });
        }

        // Voice widget initialization is now handled by toggle functionality
        // Don't initialize automatically - let the user choose the mode
        console.log(`PageRenderer: Sub-concept ${page.data.subConcept.id} ready for mode selection`);

        // Set up retry event listener for voice widget
        document.addEventListener('retryVoiceWidget', (event) => {
            const { subConceptId } = event.detail;
            if (page.data.subConcept && page.data.subConcept.id === subConceptId) {
                // Re-initialize the voice widget
                this.initializeSubConceptVoiceWidget(page.data.subConcept);
            }
        });
    }

    // Helper method to initialize voice widget for a sub-concept
    async initializeSubConceptVoiceWidget(subConcept) {
        // Check for either voicebot_context or bot_context (voicebot_context takes priority)
        const voicebotContext = subConcept.voicebot_context || null;
        const botContext = subConcept.bot_context || null;

        if (!subConcept || (!voicebotContext && !botContext) || !window.voiceWidgetManager) {
            return false;
        }

        try {
            console.log(`PageRenderer: Re-initializing voice widget for sub-concept ${subConcept.id}`);

            // Reset the container
            const container = document.getElementById(`voice-bot-container-${subConcept.id}`);
            if (container) {
                container.innerHTML = `
                    <div class="voice-widget-loading">
                        <div class="flex flex-col items-center justify-center py-8">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                            <p class="text-sm text-gray-600">Loading voice assistant...</p>
                        </div>
                    </div>
                `;
            }

            // Initialize the voice widget with voicebot_context (4th param) and title (5th param)
            const success = await window.voiceWidgetManager.initializeWidget(
                subConcept.id,
                botContext,
                `#voice-bot-container-${subConcept.id}`,
                voicebotContext,  // Voice-specific context (takes priority if provided)
                subConcept.title  // Topic title for personalized greeting
            );

            if (success && container) {
                // Remove loading indicator
                const loadingDiv = container.querySelector('.voice-widget-loading');
                if (loadingDiv) {
                    loadingDiv.remove();
                }
            }

            return success;
        } catch (error) {
            console.error('PageRenderer: Error re-initializing voice widget:', error);
            return false;
        }
    }

    managePageFocus() {
        // Set focus to the main content for screen readers
        const mainContent = document.getElementById('current-page-content');
        if (mainContent) {
            // Remove focus from any interactive elements
            const activeElement = document.activeElement;
            if (activeElement && activeElement !== document.body) {
                activeElement.blur();
            }

            // Set focus to the main content area (but not show visible focus)
            mainContent.setAttribute('tabindex', '-1');

            mainContent.scrollIntoView({ block: 'start', behavior: 'instant' });

            mainContent.focus({ preventScroll: true });

            // Remove tabindex after focus is set
            setTimeout(() => {
                mainContent.removeAttribute('tabindex');
            }, 100);
        }

        // Don't auto-focus on buttons to prevent unwanted scrolling
        // Only focus if user explicitly interacts or if it's an interactive task page

        // Find the first focusable element within the page content
        const firstFocusable = mainContent?.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        // Only set focus to primary button if it's visible in viewport without scrolling
        const primaryButton = mainContent?.querySelector('.pagination-button:not(.secondary)');
        if (primaryButton && !primaryButton.disabled) {
            // Check if button is already in viewport
            const rect = primaryButton.getBoundingClientRect();
            const isInViewport = rect.top >= 0 && rect.top <= window.innerHeight;

            if (isInViewport) {
                setTimeout(() => {
                    primaryButton.focus({ preventScroll: true });
                }, 200);
            }
        }
    }

    // Public API methods
    getCurrentPage() {
        return this.currentPage;
    }

    isRendering() {
        return this.renderingInProgress;
    }

    forceReRender() {
        if (this.currentPage) {
            this.renderCurrentPage(this.currentPage);
        }
    }
}

// Voice Assistant Functions - Replaced with Voice Widget Manager
// Old iframe-based voice assistant functions have been removed
// Voice widgets are now managed by VoiceWidgetManager class

// Global functions for sub-concept functionality have been extracted to sub-concept-renderer.js
// This includes: toggleLearningMode, announceToScreenReader, initializeVoiceWidgetForListenMode

// Initialize page renderer when this script loads
window.pageRenderer = new PageRenderer();

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PageRenderer;
}
