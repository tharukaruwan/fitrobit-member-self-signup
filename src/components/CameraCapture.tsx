import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, X, CheckCircle2 } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

export const CameraCapture = ({ onCapture, onClose }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      setLoading(true);
      setError("");
      
      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode },
        audio: false,
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      setLoading(false);
    } catch (err) {
      console.error("Camera error:", err);
      setError("Unable to access camera. Please check permissions.");
      setLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    
    // Convert to base64 with compression
    const imageData = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(imageData);
  };

  const retake = () => {
    setCapturedImage(null);
  };

  const confirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      stopCamera();
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-black/80 backdrop-blur p-4 flex justify-between items-center">
        <h2 className="text-white font-bold text-lg">Take Photo</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative bg-black flex items-center justify-center">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin h-12 w-12 border-4 border-white border-t-transparent rounded-full"></div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-destructive/90 text-white p-6 rounded-lg text-center">
              <p className="font-semibold mb-2">Camera Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {!capturedImage ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="max-w-full max-h-full"
            />
            {/* Camera guide overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-64 h-80 border-4 border-white/50 rounded-lg"></div>
              </div>
            </div>
          </>
        ) : (
          <img
            src={capturedImage}
            alt="Captured"
            className="max-w-full max-h-full"
          />
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="bg-black/80 backdrop-blur p-6">
        {!capturedImage ? (
          <div className="flex justify-between items-center max-w-md mx-auto">
            <Button
              variant="outline"
              size="icon"
              onClick={switchCamera}
              className="h-14 w-14 rounded-full border-2 border-white text-white hover:bg-white/20"
            >
              <RotateCcw className="h-6 w-6 text-black" />
            </Button>

            <Button
              size="icon"
              onClick={capturePhoto}
              disabled={loading || !!error}
              className="h-20 w-20 rounded-full bg-white hover:bg-white/90"
            >
              <Camera className="h-8 w-8 text-black" />
            </Button>

            <div className="w-14"></div>
          </div>
        ) : (
          <div className="flex gap-3 max-w-md mx-auto">
            <Button
              variant="outline"
              size="lg"
              onClick={retake}
              className="flex-1 h-14 text-white border-white hover:bg-white/20 text-black"
            >
              <RotateCcw className="mr-2 h-5 w-5" />
              Retake
            </Button>
            <Button
              size="lg"
              onClick={confirm}
              className="flex-1 h-14 bg-primary hover:bg-primary/90"
            >
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Use Photo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};