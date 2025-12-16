export const detectBlur = (srcMat) => {
    try {
        const cv = window.cv;
        if (!cv) return 0;

        const gray = new cv.Mat();
        cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);

        const laplacian = new cv.Mat();
        cv.Laplacian(gray, laplacian, cv.CV_64F);

        const mean = new cv.Mat();
        const stdDev = new cv.Mat();
        cv.meanStdDev(laplacian, mean, stdDev);

        const variance = Math.pow(stdDev.data64F[0], 2);

        gray.delete();
        laplacian.delete();
        mean.delete();
        stdDev.delete();

        return variance;
    } catch (e) {
        console.error('CV Error', e);
        return 0;
    }
};

export const detectDocumentContour = (srcMat) => {
    // Find largest quad
    // Retuns points or bounding box?
    // Doing full auto-crop guides is complex on live video, 
    // but we can return if a document is detected.
    try {
        const cv = window.cv;
        const gray = new cv.Mat();
        cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
        // Blur to remove noise
        const blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

        // Canny
        const edges = new cv.Mat();
        cv.Canny(blurred, edges, 75, 200);

        // Contours
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

        let maxArea = 0;
        let maxContour = null;

        for (let i = 0; i < contours.size(); ++i) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);
            if (area > 5000) { // Min area
                // Approx poly
                const peri = cv.arcLength(contour, true);
                const approx = new cv.Mat();
                cv.approxPolyDP(contour, approx, 0.02 * peri, true);

                if (approx.rows === 4 && area > maxArea) {
                    maxArea = area;
                    maxContour = approx; // Needs formatting
                } else {
                    approx.delete();
                }
            }
        }

        // Cleanup
        gray.delete();
        blurred.delete();
        edges.delete();
        contours.delete();
        hierarchy.delete();

        return maxArea > 0; // Just return boolean if doc detected for now
    } catch (e) {
        return false;
    }
};
