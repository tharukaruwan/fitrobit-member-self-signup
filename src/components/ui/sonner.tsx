// src/components/ui/sonner.tsx
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { useEffect, useState } from "react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const [showBlur, setShowBlur] = useState(false);

  useEffect(() => {
    // Watch for toast changes
    const observer = new MutationObserver(() => {
      const toasts = document.querySelectorAll('[data-sonner-toast]');
      setShowBlur(toasts.length > 0);
    });

    // Observe the body for toast additions/removals
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Blur Backdrop */}
      {showBlur && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9998] animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)' }}
        />
      )}

      {/* Sonner Toaster */}
      <Sonner
        theme={theme as ToasterProps["theme"]}
        className="toaster group"
        position="top-center"
        expand={true}
        richColors
        closeButton={true}
        icons={{
          success: null,
          error: null,
          warning: null,
          info: null,
        }}
        toastOptions={{
          classNames: {
            toast:
              "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-2 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl",
            description: "group-[.toast]:text-muted-foreground",
            actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:px-3 group-[.toast]:py-2",
            cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
            success: "group-[.toaster]:border-green-500",
            error: "group-[.toaster]:border-red-500",
            warning: "group-[.toaster]:border-orange-500",
            info: "group-[.toaster]:border-blue-500",
            closeButton: "!w-5 !h-5 !min-w-[20px] !min-h-[20px] !max-w-[20px] !max-h-[20px] !flex !items-center !justify-center group-[.toast]:bg-black/10 group-[.toast]:text-foreground group-[.toast]:border-0 group-[.toast]:hover:bg-black/20 !absolute !top-2 !right-2 !rounded-md",
            icon: "!hidden", // Hide all icons completely
          },
          style: {
            fontSize: '16px',
            fontWeight: '600',
            padding: '20px',
            paddingRight: '40px', // Extra padding on right to make room for close button
            minHeight: '70px',
            textAlign: 'center',
          },
          duration: 5000,
        }}
        style={{ zIndex: 9999 }}
        {...props}
      />
    </>
  );
};

export { Toaster, toast };