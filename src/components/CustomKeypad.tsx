import { Button } from "@/components/ui/button";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomKeypadProps {
  onKeyPress: (value: string) => void;
  onBackspace: () => void;
  type?: "numeric" | "full";
  className?: string;
}

export const CustomKeypad = ({ onKeyPress, onBackspace, type = "numeric", className }: CustomKeypadProps) => {
  const numericKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  
  const alphabetKeys = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Z", "X", "C", "V", "B", "N", "M"]
  ];

  if (type === "numeric") {
    return (
      <div className={cn("grid grid-cols-3 gap-2 p-4 bg-card/80 backdrop-blur-md rounded-xl border border-border/50 shadow-lg", className)}>
        {numericKeys.map((key) => (
          <Button
            key={key}
            variant="secondary"
            size="lg"
            onClick={() => onKeyPress(key)}
            className="h-14 text-2xl font-semibold hover:scale-105 transition-transform active:scale-95"
          >
            {key}
          </Button>
        ))}
        <Button
          variant="secondary"
          size="lg"
          onClick={onBackspace}
          className="h-14 hover:scale-105 transition-transform active:scale-95 col-start-3"
        >
          <Delete className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("p-4 bg-card/80 backdrop-blur-md rounded-xl border border-border/50 shadow-lg space-y-2", className)}>
      {alphabetKeys.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-1 justify-center">
          {row.map((key) => (
            <Button
              key={key}
              variant="secondary"
              size="sm"
              onClick={() => onKeyPress(key)}
              className="h-12 w-10 text-lg font-semibold hover:scale-105 transition-transform active:scale-95"
            >
              {key}
            </Button>
          ))}
        </div>
      ))}
      <div className="flex gap-2 justify-center">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onKeyPress(" ")}
          className="h-12 flex-1 hover:scale-105 transition-transform active:scale-95"
        >
          SPACE
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onBackspace}
          className="h-12 w-20 hover:scale-105 transition-transform active:scale-95"
        >
          <Delete className="h-5 w-5" />
        </Button>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {numericKeys.map((key) => (
          <Button
            key={key}
            variant="secondary"
            size="sm"
            onClick={() => onKeyPress(key)}
            className="h-10 text-lg font-semibold hover:scale-105 transition-transform active:scale-95"
          >
            {key}
          </Button>
        ))}
      </div>
    </div>
  );
};
