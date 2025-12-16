import { useState, useEffect } from 'react';

export const useOpenCV = () => {
    const [cvReady, setCvReady] = useState(false);

    useEffect(() => {
        if (window.cv && window.cv.Mat) {
            setCvReady(true);
            return;
        }

        const interval = setInterval(() => {
            if (window.cv && window.cv.Mat) {
                setCvReady(true);
                clearInterval(interval);
            }
        }, 100);

        return () => clearInterval(interval);
    }, []);

    return cvReady;
};
