import React from 'react';
import { useCamera } from '../hooks/useCamera';
import { Button } from './button/Button';

export function CameraComponent() {
  const { videoRef, handleCapture } = useCamera();

  return (
    <div className="content-block">
      <div className="content-block-title">Camera</div>
      <div className="content-block-body">
        <video ref={videoRef} autoPlay playsInline muted />
        <Button onClick={handleCapture} label="Capture" />
      </div>
    </div>
  );
}