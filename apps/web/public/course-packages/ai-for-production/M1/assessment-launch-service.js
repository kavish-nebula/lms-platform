class AssessmentLaunchService {
    constructor() {
        this.packageKey = 'va-pk-a7f3b9c1e4d28605f4a1b3c7d9e2f5a8';
        this.isChecking = false;
        this.isLaunching = false;
        this.pendingStatusRefresh = false;
        this.pageElements = null;

        this.handleWindowFocus = this.handleWindowFocus.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

        window.addEventListener('focus', this.handleWindowFocus);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    ensureAssessmentState() {
        if (!window.learningPathState) {
            window.learningPathState = {};
        }

        if (!window.learningPathState.assessment) {
            window.learningPathState.assessment = {
                canLaunch: null,
                attemptsUsed: 0,
                maxAttempts: null,
                finalSubmissionExists: false,
                latestStatus: null,
                lastCheckedAt: null,
                lastLaunchAt: null,
                lastLaunchExpiresAt: null,
                completedAt: null,
                lastMessage: '',
                lastError: ''
            };
        }

        return window.learningPathState.assessment;
    }

    getState() {
        return this.ensureAssessmentState();
    }

    updateState(partial = {}, { persist = true, dispatch = true } = {}) {
        const currentState = this.ensureAssessmentState();
        const nextState = { ...currentState, ...partial };
        window.learningPathState.assessment = nextState;

        if (persist && typeof window.saveLearningPathState === 'function') {
            window.saveLearningPathState();
        }

        if (dispatch) {
            document.dispatchEvent(new CustomEvent('assessmentStatusUpdated', {
                detail: { ...nextState }
            }));
        }

        this.updatePageUI();
        return nextState;
    }

    getApiBaseUrl() {
        const raw = window.templateConfig?.servicesApiBaseUrl || '';
        return raw.trim().replace(/\/$/, '');
    }

    getHeaders({ includeJson = false } = {}) {
        const headers = {
            Accept: 'application/json',
            'X-Package-Key': this.packageKey
        };

        if (includeJson) {
            headers['Content-Type'] = 'application/json';
        }

        return headers;
    }

    getLearnerId() {
        if (window.chatService?.getLearnerId) {
            return window.chatService.getLearnerId(window.learnerData);
        }

        const learnerId = String(window.scormLearnerData?.id || window.learnerData?.id || 'anonymous').trim();
        return learnerId || 'anonymous';
    }

    getLearnerName() {
        if (window.chatService?.getLearnerName) {
            return window.chatService.getLearnerName(window.learnerData);
        }

        const learnerName = String(window.scormLearnerData?.name || window.learnerData?.name || '').trim();
        return learnerName || null;
    }

    getCourseId() {
        if (window.chatService?.getCourseId) {
            return window.chatService.getCourseId();
        }

        return String(window.templateData?.courseId || window.templateData?.id || 'unknown-course').trim();
    }

    getModuleId() {
        if (window.chatService?.getModuleId) {
            return window.chatService.getModuleId();
        }

        const topicId = String(window.templateData?.id || '').trim();
        const match = /^([A-Za-z]+)-M(\d+)-T(\d+(?:\.\d+)?)$/.exec(topicId);
        return String(match ? `M${match[2]}` : 'unknown-module').trim();
    }

    getSubtopicId() {
        if (window.chatService?.getSubtopicId) {
            return window.chatService.getSubtopicId();
        }

        return String(
            window.templateData?.id ||
            window.templateData?.title ||
            'unknown-subtopic'
        ).trim();
    }

    getAssessmentContext() {
        const assessmentContext = window.templateData?.content?.assessment_context;
        if (!assessmentContext || typeof assessmentContext !== 'object') {
            return null;
        }

        const topics = Array.isArray(assessmentContext.topics)
            ? assessmentContext.topics.map((topic) => ({
                topic: typeof topic?.topic === 'string' ? topic.topic : '',
                type: typeof topic?.type === 'string' ? topic.type : 'tool',
                importance: typeof topic?.importance === 'string' ? topic.importance : 'medium',
                coverage_notes: typeof topic?.coverage_notes === 'string' ? topic.coverage_notes : ''
            }))
            : [];

        return {
            learner_field: typeof assessmentContext.learner_field === 'string' ? assessmentContext.learner_field : '',
            learner_role: typeof assessmentContext.learner_role === 'string' ? assessmentContext.learner_role : '',
            assessment_goal: typeof assessmentContext.assessment_goal === 'string' ? assessmentContext.assessment_goal : '',
            topics
        };
    }

    hasValidAssessmentContext() {
        const assessmentContext = this.getAssessmentContext();
        return Boolean(
            assessmentContext
            && assessmentContext.enabled !== false
            && typeof assessmentContext.learner_field === 'string'
            && assessmentContext.learner_field.trim()
            && Array.isArray(assessmentContext.topics)
            && assessmentContext.topics.length > 0
        );
    }

    buildStatusQuery() {
        return new URLSearchParams({
            learner_id: this.getLearnerId(),
            course_id: this.getCourseId(),
            module_id: this.getModuleId(),
            subtopic_id: this.getSubtopicId()
        });
    }

    buildLaunchPayload() {
        return {
            learner_id: this.getLearnerId(),
            learner_name: this.getLearnerName(),
            course_id: this.getCourseId(),
            module_id: this.getModuleId(),
            subtopic_id: this.getSubtopicId(),
            assessment_context: this.getAssessmentContext()
        };
    }

    humanizeStatus(value) {
        if (!value) {
            return 'Not started';
        }

        return String(value)
            .replace(/_/g, ' ')
            .replace(/\b\w/g, match => match.toUpperCase());
    }

    getLaunchMessage(statusData) {
        if (statusData?.final_submission_exists) {
            return 'Assessment submitted.';
        }

        if (statusData?.can_launch === false) {
            return 'This assessment is not available right now.';
        }

        return 'Assessment is ready to launch.';
    }

    async parseErrorResponse(response, fallbackMessage) {
        try {
            const data = await response.json();
            if (Array.isArray(data?.detail) && data.detail.length > 0) {
                return data.detail
                    .map((item) => {
                        if (typeof item === 'string') {
                            return item;
                        }

                        if (!item || typeof item !== 'object') {
                            return null;
                        }

                        const location = Array.isArray(item.loc) ? item.loc.join('.') : null;
                        const message = typeof item.msg === 'string' ? item.msg : null;

                        if (location && message) {
                            return `${location}: ${message}`;
                        }

                        return message || null;
                    })
                    .filter(Boolean)
                    .join('; ') || fallbackMessage;
            }

            if (typeof data?.detail === 'string') {
                return data.detail;
            }

            if (typeof data?.error === 'string') {
                return data.error;
            }

            if (typeof data?.message === 'string') {
                return data.message;
            }

            return fallbackMessage;
        } catch (error) {
            return fallbackMessage;
        }
    }

    async checkStatus({ persist = true, silent = false } = {}) {
        const apiBaseUrl = this.getApiBaseUrl();
        if (!apiBaseUrl) {
            throw new Error('Services API base URL is not configured.');
        }

        this.isChecking = true;
        this.updatePageUI();

        try {
            const response = await fetch(
                `${apiBaseUrl}/api/assessment/status?${this.buildStatusQuery().toString()}`,
                {
                    method: 'GET',
                    headers: this.getHeaders()
                }
            );

            if (!response.ok) {
                const message = await this.parseErrorResponse(response, 'Unable to check assessment status.');
                throw new Error(message);
            }

            const statusData = await response.json();
            const existingState = this.getState();
            const nowIso = new Date().toISOString();
            const nextState = this.updateState({
                canLaunch: statusData.can_launch === true,
                attemptsUsed: Number(statusData.attempts_used || 0),
                maxAttempts: Number.isFinite(statusData.max_attempts) ? statusData.max_attempts : null,
                finalSubmissionExists: Boolean(statusData.final_submission_exists),
                latestStatus: statusData.latest_status || null,
                lastCheckedAt: nowIso,
                completedAt: statusData.final_submission_exists
                    ? (existingState.completedAt || nowIso)
                    : existingState.completedAt,
                lastMessage: this.getLaunchMessage(statusData),
                lastError: ''
            }, { persist, dispatch: true });

            if (nextState.finalSubmissionExists) {
                this.pendingStatusRefresh = false;
                if (!silent && window.showNotification) {
                    window.showNotification('Assessment submitted.', 'success');
                }
            }

            return statusData;
        } catch (error) {
            this.updateState({
                lastError: error.message || 'Unable to check assessment status.',
                lastMessage: ''
            }, { persist, dispatch: true });
            throw error;
        } finally {
            this.isChecking = false;
            this.updatePageUI();
        }
    }

    buildLaunchUrl(assessmentAppUrl, token) {
        if (!assessmentAppUrl) {
            throw new Error('Assessment frontend URL is missing from backend response.');
        }

        const base = assessmentAppUrl.replace(/\/+$/, '');
        return `${base}/launch?t=${encodeURIComponent(token)}`;
    }

    async launchAssessment() {
        const apiBaseUrl = this.getApiBaseUrl();
        if (!apiBaseUrl) {
            throw new Error('Services API base URL is not configured.');
        }

        if (!this.hasValidAssessmentContext()) {
            throw new Error('Assessment context is missing required fields.');
        }

        const launchWindow = window.open('', '_blank');
        if (!launchWindow) {
            throw new Error('Popup window was blocked. Please allow popups and try again.');
        }

        this.isLaunching = true;
        this.updatePageUI();

        try {
            launchWindow.document.write(`
                <title>Launching Assessment</title>
                <body style="font-family: Inter, system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; color: #0f172a;">
                    <div style="text-align: center; max-width: 420px; padding: 24px;">
                        <div style="width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 999px; background: linear-gradient(135deg, #4A9B8E, #6B4C93);"></div>
                        <h1 style="font-size: 20px; margin: 0 0 8px;">Launching Voice Assessment</h1>
                        <p style="margin: 0; line-height: 1.5; color: #475569;">Please wait while the assessment session is prepared.</p>
                    </div>
                </body>
            `);
            launchWindow.document.close();

            const statusData = await this.checkStatus({ persist: true, silent: true });
            if (statusData.can_launch !== true) {
                launchWindow.close();
                const message = this.getLaunchMessage(statusData);
                if (window.showNotification) {
                    window.showNotification(message, 'warning');
                }
                return { launched: false, reason: message, status: statusData };
            }

            const response = await fetch(`${apiBaseUrl}/api/assessment/launch-token`, {
                method: 'POST',
                headers: this.getHeaders({ includeJson: true }),
                body: JSON.stringify(this.buildLaunchPayload())
            });

            if (!response.ok) {
                const message = await this.parseErrorResponse(response, 'Unable to start the assessment. Please try again.');
                throw new Error(message);
            }

            const launchData = await response.json();
            const launchUrl = this.buildLaunchUrl(launchData.assessment_app_url, launchData.launch_token);
            launchWindow.location.replace(launchUrl);
            launchWindow.focus();

            this.pendingStatusRefresh = true;
            this.updateState({
                lastLaunchAt: new Date().toISOString(),
                lastLaunchExpiresAt: launchData.expires_at || null,
                lastMessage: 'Voice assessment opened in a new tab.',
                lastError: ''
            }, { persist: true, dispatch: true });

            if (window.showNotification) {
                window.showNotification('Voice assessment opened in a new tab.', 'success');
            }

            return { launched: true, data: launchData, launchUrl };
        } catch (error) {
            try {
                if (launchWindow && !launchWindow.closed) {
                    launchWindow.close();
                }
            } catch (closeError) {
            }

            this.updateState({
                lastError: error.message || 'Unable to start the assessment. Please try again.',
                lastMessage: ''
            }, { persist: true, dispatch: true });

            throw error;
        } finally {
            this.isLaunching = false;
            this.updatePageUI();
        }
    }

    handleWindowFocus() {
        if (this.pendingStatusRefresh) {
            this.checkStatus({ persist: true, silent: true }).catch((error) => {
                console.warn('AssessmentLaunchService: Focus status refresh failed:', error.message);
            });
        }
    }

    handleVisibilityChange() {
        if (document.visibilityState === 'visible' && this.pendingStatusRefresh) {
            this.checkStatus({ persist: true, silent: true }).catch((error) => {
                console.warn('AssessmentLaunchService: Visibility status refresh failed:', error.message);
            });
        }
    }

    getStatusBadgeClasses(state) {
        if (state.finalSubmissionExists) {
            return 'bg-green-100 text-green-700 border border-green-200';
        }

        if (state.canLaunch) {
            return 'bg-blue-100 text-blue-700 border border-blue-200';
        }

        return 'bg-amber-100 text-amber-700 border border-amber-200';
    }

    updatePageUI() {
        if (!this.pageElements?.root || !document.body.contains(this.pageElements.root)) {
            return;
        }

        const state = this.getState();
        const hasValidContext = this.hasValidAssessmentContext();

        if (this.pageElements.statusBadge) {
            this.pageElements.statusBadge.className = `inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${this.getStatusBadgeClasses(state)}`;
            const attemptsCompleted = state.attemptsUsed != null
                && state.maxAttempts != null
                && state.maxAttempts > 0
                && state.attemptsUsed >= state.maxAttempts;

            this.pageElements.statusBadge.textContent = state.finalSubmissionExists
                ? 'Submitted'
                : attemptsCompleted
                    ? 'Attempts Completed'
                    : state.canLaunch
                        ? 'Ready to Launch'
                        : 'Unavailable';
        }

        if (this.pageElements.attemptsUsed) {
            this.pageElements.attemptsUsed.textContent = String(state.attemptsUsed ?? 0);
        }

        if (this.pageElements.maxAttempts) {
            this.pageElements.maxAttempts.textContent = state.maxAttempts ?? '--';
        }

        if (this.pageElements.latestStatus) {
            this.pageElements.latestStatus.textContent = this.humanizeStatus(state.latestStatus);
        }

        if (this.pageElements.lastCheckedAt) {
            const value = state.lastCheckedAt
                ? new Date(state.lastCheckedAt).toLocaleString()
                : 'Not checked yet';
            this.pageElements.lastCheckedAt.textContent = value;
        }

        if (this.pageElements.message) {
            const message = state.lastError || state.lastMessage || 'Start the voice assessment in a new tab, then return here and refresh the status if needed.';
            this.pageElements.message.textContent = message;
            this.pageElements.message.className = `text-sm ${state.lastError ? 'text-red-600' : 'text-gray-600'}`;
        }

        if (this.pageElements.startButton) {
            this.pageElements.startButton.disabled = this.isLaunching || this.isChecking || !hasValidContext || state.finalSubmissionExists || state.canLaunch !== true;
            const startLabel = this.isLaunching
                ? 'Launching...'
                : state.finalSubmissionExists
                    ? 'Assessment Submitted'
                    : 'Start Voice Assessment';
            this.pageElements.startButton.innerHTML = `<i class="fas fa-microphone"></i><span>${startLabel}</span>`;
        }

        if (this.pageElements.refreshButton) {
            this.pageElements.refreshButton.disabled = this.isLaunching || this.isChecking;
            const refreshLabel = this.isChecking ? 'Checking...' : 'Check Assessment Status';
            this.pageElements.refreshButton.innerHTML = `<i class="fas fa-rotate-right"></i><span>${refreshLabel}</span>`;
        }

        if (this.pageElements.contextWarning) {
            this.pageElements.contextWarning.classList.toggle('hidden', hasValidContext);
        }
    }

    mountPage(rootElement) {
        if (!rootElement) {
            return;
        }

        this.pageElements = {
            root: rootElement,
            statusBadge: rootElement.querySelector('[data-assessment-status-badge]'),
            attemptsUsed: rootElement.querySelector('[data-assessment-attempts-used]'),
            maxAttempts: rootElement.querySelector('[data-assessment-max-attempts]'),
            latestStatus: rootElement.querySelector('[data-assessment-latest-status]'),
            lastCheckedAt: rootElement.querySelector('[data-assessment-last-checked]'),
            message: rootElement.querySelector('[data-assessment-message]'),
            startButton: rootElement.querySelector('[data-assessment-start]'),
            refreshButton: rootElement.querySelector('[data-assessment-refresh]'),
            contextWarning: rootElement.querySelector('[data-assessment-context-warning]')
        };

        if (this.pageElements.startButton) {
            this.pageElements.startButton.onclick = async () => {
                try {
                    await this.launchAssessment();
                } catch (error) {
                    if (window.showNotification) {
                        window.showNotification(error.message || 'Unable to start the assessment. Please try again.', 'error');
                    }
                }
            };
        }

        if (this.pageElements.refreshButton) {
            this.pageElements.refreshButton.onclick = async () => {
                try {
                    await this.checkStatus({ persist: true, silent: false });
                } catch (error) {
                    if (window.showNotification) {
                        window.showNotification(error.message || 'Unable to check assessment status.', 'error');
                    }
                }
            };
        }

        this.updatePageUI();
        this.checkStatus({ persist: true, silent: true }).catch((error) => {
            console.warn('AssessmentLaunchService: Initial status check failed:', error.message);
        });
    }

    isAssessmentCompleted() {
        return Boolean(this.getState().finalSubmissionExists);
    }
}

window.assessmentLaunchService = new AssessmentLaunchService();

console.log('AssessmentLaunchService loaded successfully');
