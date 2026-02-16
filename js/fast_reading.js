(function() {
    'use strict';

    function initFastReading() {
        if (typeof PDFViewerApplication === 'undefined' || !PDFViewerApplication.initialized) {
            setTimeout(initFastReading, 100);
            return;
        }

        // Add styles for the icon
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
            /* Ensure the secondary button aligns text correctly if needed */
            #secondaryFastReadingMode {
                text-align: start;
                padding-left: 0; /* Align with others */
            }
        `;
        document.head.appendChild(style);

        const btnIds = ['fastReadingMode', 'secondaryFastReadingMode'];
        let fastReadingInterval = null;
        let pendingFastReading = false;
        let currentSpeed = 2; // default

        function stopFastReading() {
            if (fastReadingInterval) {
                clearInterval(fastReadingInterval);
                fastReadingInterval = null;
            }
            pendingFastReading = false;
        }

        function runInterval() {
            stopFastReading(); // Clear existing to avoid duplicates
            
            const intervalMs = currentSpeed * 1000;
            fastReadingInterval = setInterval(function() {
                // Double check we are still in presentation mode
                if (PDFViewerApplication.pdfViewer.isInPresentationMode) {
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

        function startFastReading() {
            const speedInput = prompt('Enter seconds per page (0.1 - 60):', '2');
            
            if (speedInput === null) return; // User cancelled

            const speed = parseFloat(speedInput);

            if (isNaN(speed) || speed < 0.1 || speed > 60) {
                alert('Please enter a valid number between 0.1 and 60.');
                return;
            }
            
            currentSpeed = speed;

            if (PDFViewerApplication.pdfViewer.isInPresentationMode) {
                runInterval();
            } else {
                pendingFastReading = true;
                PDFViewerApplication.requestPresentationMode();
            }
        }

        btnIds.forEach(function(id) {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', startFastReading);
            }
        });

        // Listen for presentation mode changes
        if (PDFViewerApplication.eventBus) {
            PDFViewerApplication.eventBus.on('presentationmodechanged', function(evt) {
                const state = evt.state;
                // PresentationModeState: NORMAL: 1, FULLSCREEN: 3
                if (state === 3) { // FULLSCREEN
                    if (pendingFastReading) {
                        runInterval();
                        pendingFastReading = false;
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
