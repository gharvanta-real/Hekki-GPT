/**
 * MARIANO Web Canvas Engine — Renders real-time math waveforms using stippled particle matrices.
 */
export function initWaveCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let time = 0.0;

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function draw() {
        time += 0.02;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const width = canvas.width;
        const height = canvas.height;
        const midY = height / 2;

        // Draw thin background grid coordinates
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = 0; x < width; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        // Horizontal lines
        for (let y = 0; y < height; y += 30) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw 3 mathematical stippled wave lines
        ctx.fillStyle = '#ffffff';

        // Wave 1 (Base Frequency)
        for (let x = 0; x < width; x += 4) {
            const y = midY + Math.sin(x * 0.005 + time) * (height * 0.3) +
                      Math.cos(x * 0.012 - time * 0.8) * 15;
            ctx.fillRect(x, y, 1.5, 1.5);
        }

        // Wave 2 (High Frequency Detail)
        for (let x = 0; x < width; x += 6) {
            const y = midY + Math.cos(x * 0.008 - time * 1.5) * (height * 0.2) +
                      Math.sin(x * 0.02 + time) * 10;
            ctx.fillRect(x, y, 1, 1);
        }

        // Wave 3 (Slow Rolling Baseline)
        for (let x = 0; x < width; x += 8) {
            const y = midY + Math.sin(x * 0.002 + time * 0.4) * (height * 0.35);
            ctx.fillRect(x, y, 2, 2);
        }

        animationFrameId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
    };
}
