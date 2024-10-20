export function captureImage(video: HTMLVideoElement): string | null {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg');
}

export function saveImage(imageData: string) {
    try {
        const timestamp = new Date().toISOString();
        const key = `capture-${timestamp}`;
        
        localStorage.setItem(key, imageData);
        
        console.log('Image saved successfully with key:', key);
        return key;
    } catch (error) {
        console.error('Error saving image:', error);
        throw error;
    }
}

export function getImage(key: string): string | null {
    return localStorage.getItem(key);
}

export function getAllImageKeys(): string[] {
    return Object.keys(localStorage).filter(key => key.startsWith('capture-'));
}

export function deleteImage(key: string): void {
    localStorage.removeItem(key);
}

export function getMostRecentImage(): string | null {
    const keys = getAllImageKeys();
    if (keys.length === 0) return null;
    
    const mostRecentKey = keys.sort().reverse()[0];
    return getImage(mostRecentKey);
}