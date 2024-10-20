import { useState, useEffect, useRef } from 'react';
import { captureImage, saveImage } from '../utils/imageCapture';

export function useCamera() {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    }

    initCamera();

    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (videoRef.current) {
      const capturedImage = captureImage(videoRef.current);
      if (capturedImage) {
        saveImage(capturedImage);
      }
    }
  };

  return { videoRef, handleCapture };
}