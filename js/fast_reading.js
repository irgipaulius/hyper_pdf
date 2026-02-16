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
                padding: 20px;
                min-width: 350px;
                z-index: 10000;
            }
            #fastReadingDialog::backdrop {
                background-color: rgba(0, 0, 0, 0.5);
            }
            #fastReadingDialog .row {
                margin-bottom: 15px;
                display: flex;
                flex-direction: column;
            }
            #fastReadingDialog .buttonRow {
                text-align: right;
                margin-top: 20px;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
            #fastReadingDialog label {
                margin-bottom: 8px;
                font-size: 14px;
            }
            #fastReadingDialog input[type="range"] {
                width: 100%;
                cursor: pointer;
            }
            #fastReadingSpeedDisplay {
                font-family: monospace;
                font-size: 14px;
                font-weight: bold;
            }
        `;
        document.head.appendChild(style);

        // --- DOM Elements ---
        const dialog = document.getElementById('fastReadingDialog');
        const speedRange = document.getElementById('fastReadingSpeedRange');
        const speedDisplay = document.getElementById('fastReadingSpeedDisplay');
        const errorDiv = document.getElementById('fastReadingError');
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

        function updateDisplay() {
            if (speedDisplay && speedRange) {
                currentSpeed = parseFloat(speedRange.value);
                speedDisplay.textContent = currentSpeed.toFixed(1) + 's';
            }
        }

        function openDialog() {
            if (!dialog) return;
            
            // Sync UI
            if (speedRange) {
                speedRange.value = currentSpeed;
                updateDisplay();
            }

            // Clear errors
            if (errorDiv) {
                errorDiv.style.display = 'none';
                errorDiv.textContent = '';
            }

            if (typeof dialog.showModal === 'function') {
                dialog.showModal();
            } else {
                dialog.setAttribute('open', 'true');
                dialog.style.display = 'block';
            }
            
            if (speedRange) speedRange.focus();
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
            let val;
            if (speedRange) {
                val = parseFloat(speedRange.value);
            } else {
                // Fallback
                const speedInput = document.getElementById('fastReadingSpeed');
                val = parseFloat(speedInput ? speedInput.value : 0);
            }

            if (isNaN(val) || val < 0.1 || val > 60) {
                 if (errorDiv) {
                    errorDiv.textContent = 'Please select a valid speed between 0.1 and 60 seconds.';
                    errorDiv.style.display = 'block';
                } else {
                    alert('Please select a valid speed.');
                }
                return;
            }
            
            currentSpeed = val;
            closeDialog();

            // FORCE START FROM PAGE 1
            PDFViewerApplication.page = 1;

            // CRITICAL: Request presentation mode synchronously
            const isFullscreen = (PDFViewerApplication.pdfViewer.presentationModeState === 3) || 
                                 (PDFViewerApplication.pdfViewer.isInPresentationMode);

            if (!isFullscreen) {
                pendingStart = true;
                PDFViewerApplication.requestPresentationMode();
            } else {
                startInterval();
            }
        }

        if (btnSubmit) {
            btnSubmit.addEventListener('click', onStartClick);
        }
        if (btnCancel) {
            btnCancel.addEventListener('click', closeDialog);
        }
        
        if (speedRange) {
            speedRange.addEventListener('input', updateDisplay);
            // Allow Enter key to submit
            speedRange.addEventListener('keydown', function(e) {
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
