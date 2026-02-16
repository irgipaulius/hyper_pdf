(function() {
    'use strict';

    function initFastReading() {
        if (typeof PDFViewerApplication === 'undefined' || !PDFViewerApplication.initialized) {
            setTimeout(initFastReading, 100);
            return;
        }

        // --- CSS Injection ---
        const style = document.createElement('style');
        style.textContent = `
            #fastReadingMode::before,
            #secondaryFastReadingMode::before {
                content: "";
                display: inline-block;
                width: 16px;
                height: 16px;
                background-color: var(--toolbar-icon-bg-color);
                -webkit-mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>');
                mask-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>');
                -webkit-mask-repeat: no-repeat;
                mask-repeat: no-repeat;
                -webkit-mask-position: center;
                mask-position: center;
                -webkit-mask-size: contain;
                mask-size: contain;
            }
            #secondaryFastReadingMode {
                text-align: start;
                padding-left: 0;
            }
            /* Dialog Styling */
            #fastReadingDialog {
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                border: 1px solid var(--doorhanger-border-color);
                border-radius: 4px;
                background-color: var(--doorhanger-bg-color);
                color: var(--main-color);
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
                padding: 16px;
                min-width: 300px;
                z-index: 10000;
            }
            #fastReadingDialog::backdrop {
                background-color: rgba(0, 0, 0, 0.5);
            }
            #fastReadingDialog .row {
                margin-bottom: 10px;
                display: flex;
                flex-direction: column;
            }
            #fastReadingDialog .buttonRow {
                text-align: right;
                margin-top: 15px;
                display: flex;
                justify-content: flex-end;
                gap: 8px;
            }
            #fastReadingDialog label {
                margin-bottom: 4px;
            }
            #fastReadingDialog input {
                padding: 4px;
            }
        `;
        document.head.appendChild(style);

        // --- DOM Elements ---
        const dialog = document.getElementById('fastReadingDialog');
        const speedInput = document.getElementById('fastReadingSpeed');
        const btnSubmit = document.getElementById('fastReadingSubmit');
        const btnCancel = document.getElementById('fastReadingCancel');

        // State
        let fastReadingInterval = null;
        let pendingStart = false;
        let currentSpeed = 2.0;

        function stopFastReading() {
            if (fastReadingInterval) {
                clearInterval(fastReadingInterval);
                fastReadingInterval = null;
            }
            pendingStart = false;
        }

        function startInterval() {
            // Clear existing to avoid duplicates
            if (fastReadingInterval) {
                clearInterval(fastReadingInterval);
                fastReadingInterval = null;
            }
            
            const intervalMs = currentSpeed * 1000;
            
            fastReadingInterval = setInterval(function() {
                // Double check we are still in presentation mode
                // PDFViewerApplication.pdfViewer.isInPresentationMode might be null/undefined in some versions?
                // But PDFViewerApplication.presentationModeState === 3 is definite.
                // Let's rely on the property if available, otherwise check state.
                const isFullscreen = (PDFViewerApplication.pdfViewer.presentationModeState === 3) || 
                                     (PDFViewerApplication.pdfViewer.isInPresentationMode);

                if (isFullscreen) {
                     if (PDFViewerApplication.page >= PDFViewerApplication.pagesCount) {
                        stopFastReading();
                    } else {
                        PDFViewerApplication.pdfViewer.nextPage();
                    }
                } else {
                    stopFastReading();
                }
            }, intervalMs);
        }

        // --- Dialog Handling ---

        function openDialog() {
            if (!dialog) return;
            speedInput.value = currentSpeed;
            if (typeof dialog.showModal === 'function') {
                dialog.showModal();
            } else {
                dialog.setAttribute('open', 'true');
                dialog.style.display = 'block';
            }
            speedInput.focus();
            speedInput.select();
        }

        function closeDialog() {
            if (!dialog) return;
            if (typeof dialog.close === 'function') {
                dialog.close();
            } else {
                dialog.removeAttribute('open');
                dialog.style.display = 'none';
            }
        }

        function onStartClick() {
            const val = parseFloat(speedInput.value);
            if (isNaN(val) || val < 0.1 || val > 60) {
                alert('Please enter a valid number between 0.1 and 60.');
                return;
            }
            currentSpeed = val;
            closeDialog();

            // CRITICAL: Request presentation mode synchronously within this user click event
            // to satisfy browser security requirements ("user gesture").
            // Check if we are already in presentation mode
            const isFullscreen = (PDFViewerApplication.pdfViewer.presentationModeState === 3) || 
                                 (PDFViewerApplication.pdfViewer.isInPresentationMode);

            if (!isFullscreen) {
                pendingStart = true;
                PDFViewerApplication.requestPresentationMode();
            } else {
                // Already in presentation mode? Just restart interval with new speed
                startInterval();
            }
        }

        if (btnSubmit) {
            btnSubmit.addEventListener('click', onStartClick);
        }
        if (btnCancel) {
            btnCancel.addEventListener('click', closeDialog);
        }
        
        if (speedInput) {
            speedInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    onStartClick();
                }
            });
        }

        // --- Toolbar Buttons ---
        const btnIds = ['fastReadingMode', 'secondaryFastReadingMode'];
        btnIds.forEach(function(id) {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', function(e) {
                    // Prevent default behavior if any
                    e.preventDefault();
                    openDialog();
                });
            }
        });

        // --- Event Bus / State Change ---
        if (PDFViewerApplication.eventBus) {
            PDFViewerApplication.eventBus.on('presentationmodechanged', function(evt) {
                const state = evt.state;
                // PresentationModeState: NORMAL: 1, FULLSCREEN: 3
                if (state === 3) { // FULLSCREEN
                    if (pendingStart) {
                        // Give it a slight delay to ensure the DOM is ready for page turning
                        setTimeout(startInterval, 500);
                        pendingStart = false;
                    }
                } else if (state === 1 || state === 0) { // NORMAL or UNKNOWN
                    stopFastReading();
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFastReading);
    } else {
        initFastReading();
    }
})();
