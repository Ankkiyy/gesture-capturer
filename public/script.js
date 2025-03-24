const socket = io();
const videoElement = document.getElementById('video');
const status = document.getElementById('status');

let capturing = false;
let points = [];
let handLandmarker = null;
let cameraRunning = false;

async function initializeHandLandmarker() {
    const { HandLandmarker, FilesetResolver } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0');

    const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
    );

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU'
        },
        runningMode: 'IMAGE', // Changed from 'VIDEO' to 'IMAGE'
        numHands: 2
    });
}

async function startCapture() {
    const gestureName = document.getElementById('gestureName').value.trim();
    if (!gestureName) {
        alert('Enter a gesture name!');
        return;
    }

    if (!handLandmarker) {
        await initializeHandLandmarker();
    }

    capturing = true;
    points = [];
    status.innerText = `Capturing: ${gestureName}`;

    const constraints = { video: { width: 640, height: 480 } };
    
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        videoElement.srcObject = stream;
        videoElement.onloadeddata = () => {
            cameraRunning = true;
            captureFrames();
        };
    }).catch((error) => {
        console.error('Error accessing camera:', error);
    });
}

async function captureFrames() {
    if (!cameraRunning || !capturing) return;

    const canvasElement = document.createElement('canvas');
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    const canvasCtx = canvasElement.getContext('2d');

    canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    const imageData = canvasCtx.getImageData(0, 0, canvasElement.width, canvasElement.height);

    // Update runningMode to 'IMAGE' for each frame
    await handLandmarker.setOptions({ runningMode: 'IMAGE' });
    const results = handLandmarker.detect(imageData);

    if (results.landmarks) {
        for (const landmarks of results.landmarks) {
            const frame = landmarks.map(p => ({
                x: p.x.toFixed(5),
                y: p.y.toFixed(5),
                z: p.z.toFixed(5)
            }));
            points.push(frame);
            console.log(`Captured frame ${points.length}`);

            // Draw landmarks and connectors on the canvas
            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                color: '#00FF00',
                lineWidth: 5
            });
            drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 2 });
            canvasCtx.restore();
        }
    }

    requestAnimationFrame(captureFrames);
}

function stopCapture() {
    capturing = false;
    cameraRunning = false;
    videoElement.srcObject.getTracks().forEach(track => track.stop());

    const gestureName = document.getElementById('gestureName').value.trim();
    
    if (points.length > 0) {
        socket.emit('saveGesture', { gestureName, points });
        status.innerText = `✅ Saved ${points.length} frames for '${gestureName}'`;
    } else {
        status.innerText = '❌ No frames captured.';
    }
}
