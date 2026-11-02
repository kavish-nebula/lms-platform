/**
 * MARKED.JS v5 IMPLEMENTATION - SIMPLE, RELIABLE, NO FRILLS
 * Replaces complex custom parser with mature, stable markdown library
 */
class MarkdownRenderer {
    constructor() {
        this.initialized = true;
        this.isReady = true;
        this.markedConfigured = false;

        // Code block chrome (copy button + readable colours) works everywhere
        // markdown is rendered, so it is owned by the renderer itself rather
        // than by any one page stylesheet
        this.injectCodeBlockStyles();
        this.setupCodeCopyDelegation();

        // Wait for marked to be available (CDN loading)
        this.initializeWhenMarkedReady();
    }

    initializeWhenMarkedReady() {
        if (typeof marked !== 'undefined') {
            this.setupMarked();
        } else {
            // Poll for marked to be available
            const checkInterval = setInterval(() => {
                if (typeof marked !== 'undefined') {
                    clearInterval(checkInterval);
                    this.setupMarked();
                }
            }, 100);

            // Fail after 5 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                if (typeof marked === 'undefined') {
                    console.error('Marked.js failed to load from CDN');
                }
            }, 5000);
        }
    }

    setupMarked() {
        try {
            if (this.markedConfigured) {
                return;
            }

            const renderer = new marked.Renderer();
            const defaultLinkRenderer = renderer.link.bind(renderer);

            renderer.link = (href, title, text) => {
                const linkHref = typeof href === 'string' ? href : '';
                const renderedLink = defaultLinkRenderer(href, title, text);

                if (!this.isExternalUrl(linkHref)) {
                    return renderedLink;
                }

                return this.addLinkAttributes(renderedLink);
            };

            // Fenced code blocks get a copy button and an explicit language
            // class. The language class matters even when the author wrote a
            // bare ``` fence: without it the Prism theme never applies a text
            // colour and the code is invisible against the dark block.
            renderer.code = (code, infostring, escaped) => {
                return this.renderCodeBlock(code, infostring, escaped);
            };

            // Configure marked ONCE with simple settings
            marked.setOptions({
                gfm: true,           // GitHub Flavored Markdown
                tables: true,        // Enable tables
                breaks: true,        // Line breaks
                pedantic: false,     // Not strict
                sanitize: false,     // Allow HTML (we control input)
                smartLists: true,    // Smart list handling
                smartypants: false,  // Disable smart quotes to avoid issues
                renderer
            });

            this.markedConfigured = true;

            console.log('Marked.js v5 renderer initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Marked.js:', error);
        }
    }

    render(content) {
        // ALWAYS ensure string - prevents "[object Object]"
        if (content === null || content === undefined) {
            content = '';
        } else if (typeof content !== 'string') {
            console.warn('MarkdownRenderer: content is not a string, converting:', typeof content);
            content = String(content || '');
        }

        // Check if marked is available
        if (typeof marked === 'undefined') {
            console.error('Marked.js not loaded, returning plain content');
            return `<div class="plain-content">${this.escapeHtml(content)}</div>`;
        }

        try {
            // Simple, direct rendering
            return marked.parse(content);
        } catch (error) {
            console.error('Markdown rendering error:', error);
            // Fallback: basic HTML conversion
            return `<div class="error-content">
                <p class="text-red-600 font-semibold">Markdown rendering error</p>
                <pre class="text-sm text-gray-600 mt-2">${this.escapeHtml(content.substring(0, 200))}</pre>
            </div>`;
        }
    }

    /**
     * Prism language aliases. Anything unknown (including a bare ``` fence)
     * falls back to "plaintext", which Prism leaves untouched but the theme
     * still colours - that is what keeps bare fences readable.
     */
    mapLanguageToPrism(language) {
        const languageMap = {
            js: 'javascript',
            jsx: 'javascript',
            ts: 'typescript',
            tsx: 'typescript',
            py: 'python',
            sh: 'bash',
            shell: 'bash',
            zsh: 'bash',
            console: 'bash',
            terminal: 'bash',
            cmd: 'bash',
            yml: 'yaml',
            html: 'markup',
            xml: 'markup',
            svg: 'markup',
            text: 'plaintext',
            txt: 'plaintext',
            plain: 'plaintext',
            none: 'plaintext'
        };

        const normalized = (language || '').toLowerCase().trim();

        if (!normalized) {
            return 'plaintext';
        }

        return languageMap[normalized] || normalized;
    }

    /**
     * Escape code for safe insertion into the <code> element
     * String based (not DOM based) so it behaves identically no matter when
     * during page load the markdown is rendered
     */
    escapeCode(text) {
        return String(text === null || text === undefined ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Render a fenced code block with a copy button in the top-right corner
     */
    renderCodeBlock(code, infostring, escaped) {
        const rawCode = String(code === null || code === undefined ? '' : code);
        const declaredLanguage = (infostring || '').trim().split(/\s+/)[0] || '';
        const prismLanguage = this.mapLanguageToPrism(declaredLanguage);
        const label = declaredLanguage || 'text';
        const codeHtml = escaped ? rawCode : this.escapeCode(rawCode);

        return `<div class="md-code-block" data-language="${this.escapeCode(label)}">` +
            `<button type="button" class="md-code-copy-btn" title="Copy code" aria-label="Copy code to clipboard">` +
            `<i class="fas fa-copy" aria-hidden="true"></i><span class="md-code-copy-label">Copy</span>` +
            `</button>` +
            `<pre class="language-${prismLanguage}"><code class="language-${prismLanguage}">${codeHtml}</code></pre>` +
            `</div>`;
    }

    /**
     * One delegated listener handles every copy button on the page, including
     * blocks cloned into the split-screen workspace or the image modal
     */
    setupCodeCopyDelegation() {
        if (typeof document === 'undefined' || window.__mdCodeCopyBound) {
            return;
        }

        window.__mdCodeCopyBound = true;

        document.addEventListener('click', (event) => {
            const button = event.target.closest && event.target.closest('.md-code-copy-btn');
            if (!button) return;

            event.preventDefault();
            event.stopPropagation();

            const block = button.closest('.md-code-block');
            const codeElement = block && block.querySelector('pre code');
            if (!codeElement) return;

            this.copyTextToClipboard(codeElement.textContent || '')
                .then(() => this.flashCopyFeedback(button, true))
                .catch((error) => {
                    console.warn('MarkdownRenderer: copy failed', error);
                    this.flashCopyFeedback(button, false);
                });
        });
    }

    copyTextToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }

        // Fallback for insecure contexts (some LMS iframes block the async API)
        return new Promise((resolve, reject) => {
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.setAttribute('readonly', '');
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();

                const copied = document.execCommand('copy');
                document.body.removeChild(textarea);

                copied ? resolve() : reject(new Error('execCommand copy failed'));
            } catch (error) {
                reject(error);
            }
        });
    }

    flashCopyFeedback(button, success) {
        if (button.dataset.resetting === 'true') return;

        const originalHtml = button.innerHTML;
        button.dataset.resetting = 'true';
        button.classList.add(success ? 'copied' : 'copy-failed');
        button.innerHTML = success
            ? '<i class="fas fa-check" aria-hidden="true"></i><span class="md-code-copy-label">Copied</span>'
            : '<i class="fas fa-triangle-exclamation" aria-hidden="true"></i><span class="md-code-copy-label">Failed</span>';

        setTimeout(() => {
            button.innerHTML = originalHtml;
            button.classList.remove('copied', 'copy-failed');
            delete button.dataset.resetting;
        }, 1800);
    }

    /**
     * Styles for the rendered code blocks
     * Injected here because the markdown renderer is shared by the topic and
     * capstone templates, which do not load a common content stylesheet
     */
    injectCodeBlockStyles() {
        if (typeof document === 'undefined' || document.getElementById('md-code-block-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'md-code-block-styles';
        style.textContent = `
        .md-code-block {
            position: relative;
            margin: 1rem 0;
            border-radius: 0.5rem;
            overflow: hidden;
        }

        .md-code-block pre {
            margin: 0 !important;
            /* room for the copy button so code never runs underneath it */
            padding-right: 6.25rem !important;
        }

        /* Guaranteed readable text, whatever the fence language was */
        .md-code-block pre,
        .md-code-block pre code {
            color: #e2e8f0;
        }

        .md-code-copy-btn {
            position: absolute;
            top: 0.5rem;
            right: 0.5rem;
            z-index: 2;
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.25rem 0.55rem;
            border: 1px solid rgba(255, 255, 255, 0.18);
            border-radius: 0.375rem;
            background: rgba(255, 255, 255, 0.1);
            color: #e2e8f0;
            font-size: 0.75rem;
            font-weight: 500;
            line-height: 1.2;
            cursor: pointer;
            opacity: 0.65;
            transition: opacity 0.2s ease, background 0.2s ease, color 0.2s ease;
        }

        .md-code-block:hover .md-code-copy-btn,
        .md-code-copy-btn:focus-visible {
            opacity: 1;
        }

        .md-code-copy-btn:hover {
            background: rgba(255, 255, 255, 0.2);
            color: #ffffff;
            opacity: 1;
        }

        .md-code-copy-btn.copied {
            background: rgba(34, 197, 94, 0.25);
            border-color: rgba(34, 197, 94, 0.5);
            color: #bbf7d0;
            opacity: 1;
        }

        .md-code-copy-btn.copy-failed {
            background: rgba(239, 68, 68, 0.25);
            border-color: rgba(239, 68, 68, 0.5);
            color: #fecaca;
            opacity: 1;
        }

        /* Touch devices have no hover, so keep the button visible */
        @media (hover: none) {
            .md-code-copy-btn { opacity: 1; }
        }

        /* Narrow panel (image modal instructions) - icon only button */
        .modal-instructions-content .md-code-copy-btn .md-code-copy-label {
            display: none;
        }

        .modal-instructions-content .md-code-block pre {
            padding-right: 2.75rem !important;
        }

        .modal-instructions-content .md-code-copy-btn {
            top: 0.35rem;
            right: 0.35rem;
            padding: 0.2rem 0.4rem;
        }
        `;

        (document.head || document.documentElement).appendChild(style);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    isExternalUrl(url) {
        return /^https?:\/\//i.test((url || '').trim());
    }

    addLinkAttributes(html) {
        if (!html || !html.includes('<a ')) {
            return html;
        }

        let updatedHtml = html;

        if (!/\btarget=/i.test(updatedHtml)) {
            updatedHtml = updatedHtml.replace('<a ', '<a target="_blank" ');
        }

        if (/\brel=/i.test(updatedHtml)) {
            updatedHtml = updatedHtml.replace(/rel="([^"]*)"/i, (match, relValue) => {
                const parts = relValue.split(/\s+/).filter(Boolean);

                if (!parts.includes('noopener')) {
                    parts.push('noopener');
                }

                if (!parts.includes('noreferrer')) {
                    parts.push('noreferrer');
                }

                return `rel="${parts.join(' ')}"`;
            });
        } else {
            updatedHtml = updatedHtml.replace('<a ', '<a rel="noopener noreferrer" ');
        }

        return updatedHtml;
    }

    getStatus() {
        return {
            initialized: this.initialized,
            ready: this.isReady && typeof marked !== 'undefined',
            parser: 'Marked.js v5',
            features: ['gfm', 'tables', 'breaks', 'smartLists'],
            cdnVersion: '5.1.2'
        };
    }
}

// Create global instance
window.markdownRenderer = new MarkdownRenderer();

console.log('MarkdownRenderer module loaded - waiting for Marked.js CDN...');
