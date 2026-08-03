import { useRef, useEffect, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface SignaturePadProps {
  onSave: (signature: string) => void;
  existingSignature?: string;
}

export const SignaturePad = ({ onSave, existingSignature }: SignaturePadProps) => {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(!existingSignature);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (sigCanvas.current) {
        const canvas = sigCanvas.current.getCanvas();
        const container = canvas.parentElement;
        if (container) {
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          canvas.width = container.offsetWidth * ratio;
          canvas.height = container.offsetHeight * ratio;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.scale(ratio, ratio);
            canvas.style.width = container.offsetWidth + "px";
            canvas.style.height = container.offsetHeight + "px";
          }
        }
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load existing signature when component mounts or existingSignature changes
  useEffect(() => {
    if (existingSignature && sigCanvas.current) {
      sigCanvas.current.fromDataURL(existingSignature);
      setIsEmpty(false);
      setHasChanges(false);
    }
  }, [existingSignature]);

  const handleClear = () => {
    sigCanvas.current?.clear();
    setIsEmpty(true);
    setHasChanges(true);
  };

  const handleSave = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      const signatureData = sigCanvas.current.toDataURL("image/png");
      onSave(signatureData);
      setHasChanges(false);
    }
  };

  const handleBegin = () => {
    setIsEmpty(false);
    setHasChanges(true);
  };

  return (
    <div className="space-y-4">
      <div className="relative border-2 border-dashed border-border rounded-xl overflow-hidden bg-white">
        <SignatureCanvas
          ref={sigCanvas}
          canvasProps={{
            className: "w-full h-64 cursor-crosshair touch-none",
            style: { touchAction: "none" }
          }}
          penColor="hsla(0, 0%, 0%, 1.00)"
          backgroundColor="white"
          onBegin={handleBegin}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-muted-foreground text-sm">Sign here with your finger or stylus</p>
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleClear}
          className="flex-1"
          disabled={isEmpty}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Clear
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          className="flex-1"
          disabled={isEmpty || !hasChanges}
        >
          Save Signature
        </Button>
      </div>
    </div>
  );
};